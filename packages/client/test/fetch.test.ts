import { describe, it, expect, vi, beforeEach } from "vitest";
import type { PaymentRequired, PaymentPayload } from "@x402-ton/common";

vi.mock("../src/signer.js", () => ({
  signPayment: vi.fn(),
}));

vi.mock("../src/deposit.js", () => ({
  ensureBalance: vi.fn().mockResolvedValue(null),
}));

import { createX402TonFetch } from "../src/fetch.js";
import { signPayment } from "../src/signer.js";
import { ensureBalance } from "../src/deposit.js";

function mockAccount() {
  return { address: "0xaaaa" } as Parameters<typeof createX402TonFetch>[0]["account"];
}

function mockClients() {
  return {
    publicClient: {} as Parameters<typeof createX402TonFetch>[0]["publicClient"],
    walletClient: {} as Parameters<typeof createX402TonFetch>[0]["walletClient"],
  };
}

function makePaymentRequired(): PaymentRequired {
  return {
    version: 2,
    accepts: [
      {
        scheme: "exact-ton",
        network: "eip155:111551119090",
        maxAmountRequired: "1000",
        resource: "https://example.com/api",
        description: "test",
        mimeType: "application/json",
        payTo: "0xbbbb" as `0x${string}`,
        maxTimeoutSeconds: 60,
        asset: "native",
      },
    ],
  };
}

function encodePaymentRequired(pr: PaymentRequired): string {
  return Buffer.from(JSON.stringify(pr)).toString("base64");
}

const MOCK_PAYLOAD: PaymentPayload = {
  x402Version: 2,
  scheme: "exact-ton",
  network: "eip155:111551119090",
  payload: {
    signature: "0xdeadbeef" as `0x${string}`,
    authorization: {
      from: "0xaaaa" as `0x${string}`,
      to: "0xbbbb" as `0x${string}`,
      amount: "1000",
      deadline: "9999999999",
      nonce: "0x0000000000000000000000000000000000000000000000000000000000000001" as `0x${string}`,
    },
  },
};

describe("createX402TonFetch", () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.clearAllMocks();
    globalThis.fetch = originalFetch;
  });

  it("returns a function", () => {
    // #given
    const config = {
      account: mockAccount(),
      ...mockClients(),
    };

    // #when
    const x402Fetch = createX402TonFetch(config);

    // #then
    expect(typeof x402Fetch).toBe("function");
  });

  it("passes through 200 responses unchanged", async () => {
    // #given
    const okResponse = new Response(JSON.stringify({ data: "ok" }), { status: 200 });
    globalThis.fetch = vi.fn().mockResolvedValue(okResponse);
    const x402Fetch = createX402TonFetch({ account: mockAccount(), ...mockClients() });

    // #when
    const result = await x402Fetch("https://example.com/api");

    // #then
    expect(result).toBe(okResponse);
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
  });

  it("triggers payment flow on 402 with valid payment-required header", async () => {
    // #given
    const pr = makePaymentRequired();
    const headers402 = new Headers({ "payment-required": encodePaymentRequired(pr) });
    const response402 = new Response("Payment Required", { status: 402, headers: headers402 });
    const paidResponse = new Response(JSON.stringify({ data: "paid" }), { status: 200 });
    globalThis.fetch = vi.fn()
      .mockResolvedValueOnce(response402)
      .mockResolvedValueOnce(paidResponse);

    vi.mocked(signPayment).mockResolvedValue(MOCK_PAYLOAD);

    const x402Fetch = createX402TonFetch({ account: mockAccount(), ...mockClients() });

    // #when
    const result = await x402Fetch("https://example.com/api");

    // #then
    expect(result).toBe(paidResponse);
    expect(globalThis.fetch).toHaveBeenCalledTimes(2);
    expect(signPayment).toHaveBeenCalledOnce();

    const secondCallArgs = vi.mocked(globalThis.fetch).mock.calls[1];
    const sentHeaders = secondCallArgs[1]?.headers as Record<string, string>;
    expect(sentHeaders["payment-signature"]).toBeDefined();
  });

  it("returns original 402 response when payment-required header is missing", async () => {
    // #given
    const response402 = new Response("Payment Required", { status: 402 });
    globalThis.fetch = vi.fn().mockResolvedValue(response402);
    const x402Fetch = createX402TonFetch({ account: mockAccount(), ...mockClients() });

    // #when
    const result = await x402Fetch("https://example.com/api");

    // #then
    expect(result).toBe(response402);
    expect(result.status).toBe(402);
    expect(signPayment).not.toHaveBeenCalled();
  });

  it("returns original response when no exact-ton scheme in accepts", async () => {
    // #given
    const pr: PaymentRequired = {
      version: 2,
      accepts: [
        {
          scheme: "exact-ton",
          network: "eip155:111551119090",
          maxAmountRequired: "1000",
          resource: "https://example.com/api",
          description: "test",
          mimeType: "application/json",
          payTo: "0xbbbb" as `0x${string}`,
          maxTimeoutSeconds: 60,
          asset: "native",
        },
      ],
    };
    // Override scheme to something else to simulate no match
    (pr.accepts[0] as Record<string, unknown>).scheme = "other-scheme";

    const headers402 = new Headers({ "payment-required": encodePaymentRequired(pr) });
    const response402 = new Response("Payment Required", { status: 402, headers: headers402 });
    globalThis.fetch = vi.fn().mockResolvedValue(response402);
    const x402Fetch = createX402TonFetch({ account: mockAccount(), ...mockClients() });

    // #when
    const result = await x402Fetch("https://example.com/api");

    // #then
    expect(result).toBe(response402);
    expect(signPayment).not.toHaveBeenCalled();
  });

  it("throws on invalid base64 in payment-required header", async () => {
    // #given — invalid base64 that will produce invalid JSON
    const headers402 = new Headers({ "payment-required": "!!!not-base64!!!" });
    const response402 = new Response("Payment Required", { status: 402, headers: headers402 });
    globalThis.fetch = vi.fn().mockResolvedValue(response402);
    const x402Fetch = createX402TonFetch({ account: mockAccount(), ...mockClients() });

    // #when / #then
    await expect(x402Fetch("https://example.com/api")).rejects.toThrow();
  });

  it("calls ensureBalance when autoDeposit is enabled", async () => {
    // #given
    const pr = makePaymentRequired();
    const headers402 = new Headers({ "payment-required": encodePaymentRequired(pr) });
    const response402 = new Response("Payment Required", { status: 402, headers: headers402 });
    const paidResponse = new Response(JSON.stringify({ data: "paid" }), { status: 200 });
    globalThis.fetch = vi.fn()
      .mockResolvedValueOnce(response402)
      .mockResolvedValueOnce(paidResponse);

    vi.mocked(signPayment).mockResolvedValue(MOCK_PAYLOAD);
    vi.mocked(ensureBalance).mockResolvedValue(null);

    const x402Fetch = createX402TonFetch({
      account: mockAccount(),
      ...mockClients(),
      autoDeposit: true,
    });

    // #when
    await x402Fetch("https://example.com/api");

    // #then
    expect(ensureBalance).toHaveBeenCalledOnce();
  });
});
