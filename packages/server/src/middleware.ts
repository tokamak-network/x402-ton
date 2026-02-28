import { type Request, type Response, type NextFunction } from "express";
import {
  type PaymentRequired,
  type PaymentPayload,
  type PaymentRequirements,
  type Network,
  type VerifyResponse,
  type SettlementResponse,
  CAIP2_THANOS_SEPOLIA,
  THANOS_USDC,
} from "@x402-ton/common";

declare module "express-serve-static-core" {
  interface Request {
    x402Payer?: `0x${string}`;
  }
}

export interface RouteConfig {
  price: string;
  payTo: `0x${string}`;
  description?: string;
  mimeType?: string;
  maxTimeoutSeconds?: number;
}

export interface MiddlewareConfig {
  routes: Record<string, RouteConfig>;
  facilitatorUrl: string;
  network?: Network;
  usdcAddress?: `0x${string}`;
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function matchRoute(
  method: string,
  path: string,
  routes: Record<string, RouteConfig>
): RouteConfig | null {
  const key = `${method.toUpperCase()} ${path}`;
  for (const [pattern, config] of Object.entries(routes)) {
    const escaped = escapeRegex(pattern).replace(/\\\[(\w+)\\\]/g, "[^/]+");
    const regex = new RegExp("^" + escaped + "$");
    if (regex.test(key)) return config;
  }
  return null;
}

export function paymentMiddleware(config: MiddlewareConfig) {
  const network = config.network ?? CAIP2_THANOS_SEPOLIA;
  const usdcAddress = config.usdcAddress ?? THANOS_USDC;
  const facilitatorUrl = config.facilitatorUrl.replace(/\/+$/, "");

  return async (req: Request, res: Response, next: NextFunction) => {
    const route = matchRoute(req.method, req.path, config.routes);
    if (!route) return next();

    const raw = req.headers["payment-signature"];
    const paymentHeader = Array.isArray(raw) ? raw[0] : raw;

    if (!paymentHeader) {
      const requirement: PaymentRequirements = {
        scheme: "exact",
        network,
        asset: usdcAddress,
        amount: route.price,
        payTo: route.payTo,
        maxTimeoutSeconds: route.maxTimeoutSeconds ?? 60,
        extra: { name: "Bridged USDC (Tokamak Network)", version: "2" },
      };

      const paymentRequired: PaymentRequired = {
        x402Version: 2,
        accepts: [requirement],
      };

      const encoded = Buffer.from(JSON.stringify(paymentRequired)).toString("base64");
      res.status(402).set("payment-required", encoded).json({
        error: "Payment Required",
        message: "This resource requires USDC payment via x402",
      });
      return;
    }

    let payload: PaymentPayload;
    try {
      payload = JSON.parse(Buffer.from(paymentHeader, "base64").toString("utf-8"));
    } catch {
      res.status(400).json({ error: "Invalid payment header" });
      return;
    }

    const requirements: PaymentRequirements = {
      scheme: "exact",
      network,
      asset: usdcAddress,
      amount: route.price,
      payTo: route.payTo,
      maxTimeoutSeconds: route.maxTimeoutSeconds ?? 60,
      extra: { name: "Bridged USDC (Tokamak Network)", version: "2" },
    };

    try {
      const verifyRes = await fetch(`${facilitatorUrl}/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          x402Version: 2,
          paymentPayload: payload,
          paymentRequirements: requirements,
        }),
        signal: AbortSignal.timeout(30_000),
      });

      if (!verifyRes.ok) {
        throw new Error(`Facilitator returned ${verifyRes.status} ${verifyRes.statusText}`);
      }

      const verify: VerifyResponse = await verifyRes.json();
      if (!verify.isValid) {
        res.status(402).json({
          error: "Payment verification failed",
          reason: verify.invalidReason,
        });
        return;
      }

      req.x402Payer = verify.payer;
    } catch {
      res.status(502).json({ error: "Facilitator unreachable" });
      return;
    }

    // Buffer the response: intercept write/end, let handler run, settle, then flush.
    // Matches x402 base pattern: verify before handler, settle after handler succeeds.
    const chunks: { data: Buffer; encoding: BufferEncoding }[] = [];
    let capturedStatusCode = 200;

    const originalWrite = res.write.bind(res);
    const originalEnd = res.end.bind(res);
    const originalWriteHead = res.writeHead.bind(res);

    const endPromise = new Promise<void>((resolve) => {
      res.writeHead = function (statusCode: number, ..._args: unknown[]) {
        capturedStatusCode = statusCode;
        return res;
      } as typeof res.writeHead;

      res.write = function (chunk: unknown, ...args: unknown[]) {
        const buf = typeof chunk === "string" ? Buffer.from(chunk) : Buffer.from(chunk as Buffer);
        const encoding = (typeof args[0] === "string" ? args[0] : "utf-8") as BufferEncoding;
        chunks.push({ data: buf, encoding });
        const cb = typeof args[0] === "function" ? args[0] : typeof args[1] === "function" ? args[1] : undefined;
        if (cb) (cb as () => void)();
        return true;
      } as typeof res.write;

      res.end = function (chunk?: unknown, ...args: unknown[]) {
        if (chunk != null) {
          const buf = typeof chunk === "string" ? Buffer.from(chunk) : Buffer.from(chunk as Buffer);
          const encoding = (typeof args[0] === "string" ? args[0] : "utf-8") as BufferEncoding;
          chunks.push({ data: buf, encoding });
        }
        resolve();
        return res;
      } as typeof res.end;
    });

    next();
    await endPromise;

    // Restore originals
    res.write = originalWrite;
    res.end = originalEnd;
    res.writeHead = originalWriteHead;

    capturedStatusCode = res.statusCode;

    // Only settle if handler succeeded (status < 400)
    if (capturedStatusCode < 400) {
      try {
        const settleRes = await fetch(`${facilitatorUrl}/settle`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            x402Version: 2,
            paymentPayload: payload,
            paymentRequirements: requirements,
          }),
        });
        const settlement: SettlementResponse = await settleRes.json();
        if (settlement.success && settlement.transaction) {
          res.set(
            "payment-response",
            Buffer.from(JSON.stringify(settlement)).toString("base64")
          );
        } else {
          res.status(402).json({
            error: "Settlement failed",
            reason: settlement.errorReason,
          });
          return;
        }
      } catch (err) {
        res.status(502).json({
          error: "Settlement failed",
          reason: err instanceof Error ? err.message : "Facilitator unreachable",
        });
        return;
      }
    }

    // Flush buffered response
    for (const { data, encoding } of chunks) {
      originalWrite(data, encoding);
    }
    originalEnd();
  };
}
