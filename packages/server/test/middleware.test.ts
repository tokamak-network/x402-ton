import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Request, Response, NextFunction } from "express";
import { matchRoute, paymentMiddleware, type RouteConfig } from "../src/middleware.js";

function mockReq(overrides: Partial<Request> = {}): Request {
  return {
    method: "GET",
    path: "/api/data",
    originalUrl: "/api/data",
    headers: {},
    ...overrides,
  } as Request;
}

function mockRes(): Response {
  const res = {
    statusCode: 200,
    _headers: {} as Record<string, string>,
    _body: null as unknown,
    status(code: number) {
      res.statusCode = code;
      return res;
    },
    set(key: string, value: string) {
      res._headers[key] = value;
      return res;
    },
    json(body: unknown) {
      res._body = body;
      return res;
    },
    write(_chunk: unknown, ..._args: unknown[]) {
      return true;
    },
    end(_chunk?: unknown, ..._args: unknown[]) {
      return res;
    },
    writeHead(_statusCode: number, ..._args: unknown[]) {
      return res;
    },
  };
  return res as unknown as Response;
}

const ROUTES: Record<string, RouteConfig> = {
  "GET /api/data": {
    price: "1000000000000000000",
    payTo: "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb" as `0x${string}`,
    description: "Premium data",
  },
  "POST /api/items/[id]": {
    price: "500000000000000000",
    payTo: "0xcccccccccccccccccccccccccccccccccccccccc" as `0x${string}`,
  },
};

describe("matchRoute", () => {
  it("matches exact route patterns", () => {
    // #when
    const result = matchRoute("GET", "/api/data", ROUTES);

    // #then
    expect(result).not.toBeNull();
    expect(result!.price).toBe("1000000000000000000");
  });

  it("returns null for non-matching routes", () => {
    // #when
    const result = matchRoute("GET", "/api/unknown", ROUTES);

    // #then
    expect(result).toBeNull();
  });

  it("matches routes with bracket param syntax", () => {
    // #when
    const result = matchRoute("POST", "/api/items/123", ROUTES);

    // #then
    expect(result).not.toBeNull();
    expect(result!.price).toBe("500000000000000000");
  });

  it("rejects wrong HTTP method", () => {
    // #when
    const result = matchRoute("POST", "/api/data", ROUTES);

    // #then
    expect(result).toBeNull();
  });

  it("handles case-insensitive HTTP methods", () => {
    // #when
    const result = matchRoute("get", "/api/data", ROUTES);

    // #then
    expect(result).not.toBeNull();
  });

  it("treats dots as literal characters, not regex wildcards", () => {
    // #given — dots are regex metacharacters; the escapeRegex fix handles this
    const dotRoutes: Record<string, RouteConfig> = {
      "GET /api/v1.0/data": {
        price: "100",
        payTo: "0xaaaa" as `0x${string}`,
      },
    };

    // #when
    const match = matchRoute("GET", "/api/v1.0/data", dotRoutes);
    const noMatch = matchRoute("GET", "/api/v1X0/data", dotRoutes);

    // #then
    expect(match).not.toBeNull();
    expect(noMatch).toBeNull();
  });
});

describe("paymentMiddleware", () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
    globalThis.fetch = originalFetch;
  });

  it("calls next() for non-gated routes", async () => {
    // #given
    const middleware = paymentMiddleware({
      routes: ROUTES,
      facilitatorUrl: "http://localhost:4020",
    });
    const req = mockReq({ method: "GET", path: "/public/free" });
    const res = mockRes();
    const next = vi.fn();

    // #when
    await middleware(req, res, next);

    // #then
    expect(next).toHaveBeenCalledOnce();
  });

  it("returns 402 when no payment header is present for gated route", async () => {
    // #given
    const middleware = paymentMiddleware({
      routes: ROUTES,
      facilitatorUrl: "http://localhost:4020",
    });
    const req = mockReq({ method: "GET", path: "/api/data", headers: {} });
    const res = mockRes();
    const next = vi.fn();

    // #when
    await middleware(req, res, next);

    // #then
    expect(res.statusCode).toBe(402);
    expect(next).not.toHaveBeenCalled();
    expect(res._headers["payment-required"]).toBeDefined();

    const decoded = JSON.parse(
      Buffer.from(res._headers["payment-required"], "base64").toString("utf-8")
    );
    expect(decoded.x402Version).toBe(2);
    expect(decoded.accepts).toHaveLength(1);
    expect(decoded.accepts[0].scheme).toBe("exact");
  });

  it("returns 400 for invalid payment header (bad base64/JSON)", async () => {
    // #given
    const middleware = paymentMiddleware({
      routes: ROUTES,
      facilitatorUrl: "http://localhost:4020",
    });
    const req = mockReq({
      method: "GET",
      path: "/api/data",
      headers: { "payment-signature": "!!!invalid-base64!!!" },
    });
    const res = mockRes();
    const next = vi.fn();

    // #when
    await middleware(req, res, next);

    // #then
    expect(res.statusCode).toBe(400);
    expect((res._body as Record<string, string>).error).toBe("Invalid payment header");
    expect(next).not.toHaveBeenCalled();
  });

  it("returns 502 when facilitator is unreachable", async () => {
    // #given
    const validPayload = Buffer.from(JSON.stringify({
      x402Version: 2,
      scheme: "exact-ton",
      network: "eip155:111551119090",
      payload: {
        signature: "0xdeadbeef",
        authorization: {
          from: "0xaaaa",
          to: "0xbbbb",
          amount: "1000",
          deadline: "9999999999",
          nonce: "0x0000000000000000000000000000000000000000000000000000000000000001",
        },
      },
    })).toString("base64");

    globalThis.fetch = vi.fn().mockRejectedValue(new Error("ECONNREFUSED"));

    const middleware = paymentMiddleware({
      routes: ROUTES,
      facilitatorUrl: "http://localhost:4020",
    });
    const req = mockReq({
      method: "GET",
      path: "/api/data",
      headers: { "payment-signature": validPayload },
    });
    const res = mockRes();
    const next = vi.fn();

    // #when
    await middleware(req, res, next);

    // #then
    expect(res.statusCode).toBe(502);
    expect((res._body as Record<string, string>).error).toBe("Facilitator unreachable");
  });

  it("returns 402 when verification fails", async () => {
    // #given
    const validPayload = Buffer.from(JSON.stringify({
      x402Version: 2,
      scheme: "exact-ton",
      network: "eip155:111551119090",
      payload: {
        signature: "0xdeadbeef",
        authorization: {
          from: "0xaaaa",
          to: "0xbbbb",
          amount: "1000",
          deadline: "9999999999",
          nonce: "0x0000000000000000000000000000000000000000000000000000000000000001",
        },
      },
    })).toString("base64");

    const verifyResponse = new Response(
      JSON.stringify({ isValid: false, invalidReason: "expired" }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
    globalThis.fetch = vi.fn().mockResolvedValue(verifyResponse);

    const middleware = paymentMiddleware({
      routes: ROUTES,
      facilitatorUrl: "http://localhost:4020",
    });
    const req = mockReq({
      method: "GET",
      path: "/api/data",
      headers: { "payment-signature": validPayload },
    });
    const res = mockRes();
    const next = vi.fn();

    // #when
    await middleware(req, res, next);

    // #then
    expect(res.statusCode).toBe(402);
    expect((res._body as Record<string, string>).reason).toBe("expired");
  });

  it("sets x402Payer and calls next() on successful verification", async () => {
    // #given
    const validPayload = Buffer.from(JSON.stringify({
      x402Version: 2,
      scheme: "exact",
      network: "eip155:111551119090",
      payload: {
        signature: "0xdeadbeef",
        authorization: {
          from: "0xaaaa",
          to: "0xbbbb",
          value: "1000",
          validAfter: "0",
          validBefore: "9999999999",
          nonce: "0x0000000000000000000000000000000000000000000000000000000000000001",
        },
      },
    })).toString("base64");

    const verifyResponse = new Response(
      JSON.stringify({ isValid: true, payer: "0xaaaa" }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
    const settleResponse = new Response(
      JSON.stringify({ success: true, transaction: "0xdeadbeef", network: "eip155:111551119090" }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
    globalThis.fetch = vi.fn()
      .mockResolvedValueOnce(verifyResponse)
      .mockResolvedValueOnce(settleResponse);

    const middleware = paymentMiddleware({
      routes: ROUTES,
      facilitatorUrl: "http://localhost:4020",
    });
    const req = mockReq({
      method: "GET",
      path: "/api/data",
      headers: { "payment-signature": validPayload },
    });
    const res = mockRes();
    // Simulate a handler that writes a response body and calls end()
    const next = vi.fn(() => {
      res.end(JSON.stringify({ data: "ok" }));
    });

    // #when
    await middleware(req, res, next);

    // #then
    expect(req.x402Payer).toBe("0xaaaa");
    expect(next).toHaveBeenCalledOnce();
  });
});
