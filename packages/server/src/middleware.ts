import { type Request, type Response, type NextFunction } from "express";
import {
  type PaymentRequired,
  type PaymentPayload,
  type PaymentRequirement,
  type VerifyResponse,
  type SettlementResponse,
  CAIP2_THANOS_SEPOLIA,
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
  network?: string;
  gasless?: boolean;
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Matches "METHOD /path" against route patterns with [param] bracket syntax
export function matchRoute(
  method: string,
  path: string,
  routes: Record<string, RouteConfig>
): RouteConfig | null {
  const key = `${method.toUpperCase()} ${path}`;
  for (const [pattern, config] of Object.entries(routes)) {
    const escaped = escapeRegex(pattern);
    const regex = new RegExp(
      "^" + escaped.replace(/\\\[(\w+)\\\]/g, "[^/]+") + "$"
    );
    if (regex.test(key)) return config;
  }
  return null;
}

export function paymentMiddleware(config: MiddlewareConfig) {
  const network = config.network ?? CAIP2_THANOS_SEPOLIA;
  const facilitatorUrl = config.facilitatorUrl.replace(/\/+$/, "");

  return async (req: Request, res: Response, next: NextFunction) => {
    const route = matchRoute(req.method, req.path, config.routes);
    if (!route) return next();

    const requirement: PaymentRequirement = {
      scheme: "exact-ton",
      network,
      maxAmountRequired: route.price,
      resource: req.originalUrl,
      description: route.description ?? "",
      mimeType: route.mimeType ?? "application/json",
      payTo: route.payTo,
      maxTimeoutSeconds: route.maxTimeoutSeconds ?? 60,
      asset: "native",
    };

    const raw = req.headers["payment-signature"];
    const paymentHeader = Array.isArray(raw) ? raw[0] : raw;

    if (!paymentHeader) {
      const paymentRequired: PaymentRequired = {
        version: 2,
        accepts: [requirement],
      };

      const encoded = Buffer.from(JSON.stringify(paymentRequired)).toString("base64");
      res.status(402).set("payment-required", encoded).json({
        error: "Payment Required",
        message: "This resource requires TON payment",
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

    try {
      const verifyRes = await fetch(`${facilitatorUrl}/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          paymentPayload: payload,
          paymentRequirements: requirement,
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

    // Intercept res.json to settle BEFORE sending response
    const originalJson = res.json.bind(res);
    res.json = function (body: unknown) {
      (async () => {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30_000);
        try {
          const settleEndpoint = config.gasless ? "/settle-gasless" : "/settle";
          const settleRes = await fetch(`${facilitatorUrl}${settleEndpoint}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              paymentPayload: payload,
              paymentRequirements: requirement,
            }),
            signal: controller.signal,
          });
          const settlement: SettlementResponse = await settleRes.json();
          if (settlement.success && settlement.transaction) {
            res.set(
              "payment-response",
              Buffer.from(JSON.stringify(settlement)).toString("base64")
            );
          }
        } catch (err) {
          console.warn("[x402-ton] settlement failed:", err instanceof Error ? err.message : err);
        } finally {
          clearTimeout(timeoutId);
        }
        originalJson(body);
      })();
      return res;
    } as Response["json"];

    next();
  };
}
