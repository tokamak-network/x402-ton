# @x402-ton/server

Standalone Express middleware that adds x402 paywalls to API endpoints on Tokamak Network's Thanos L2. Returns HTTP 402 with payment requirements, verifies incoming payments via a facilitator, and settles after the handler responds successfully.

## Installation

```bash
npm install @x402-ton/server @x402-ton/common express
```

## Quick start

```typescript
import express from "express";
import { paymentMiddleware } from "@x402-ton/server";

const app = express();

app.use(paymentMiddleware({
  facilitatorUrl: "http://localhost:4402",
  routes: {
    "GET /api/plasma": {
      price: "100000",  // $0.10 USDC (6 decimals)
      payTo: "0xYourAddress",
    },
    "GET /api/premium/[id]": {
      price: "1000000", // $1.00 USDC
      payTo: "0xYourAddress",
    },
  },
}));

app.get("/api/plasma", (req, res) => {
  // req.x402Payer is the verified payer address after successful payment
  res.json({ epoch: 42, payer: req.x402Payer });
});

app.listen(3000);
```

## How it works

1. **No payment header** — middleware returns HTTP 402 with a base64-encoded `payment-required` header containing `PaymentRequirements`.
2. **With payment header** — middleware decodes the `payment-signature` header, calls `POST /verify` on the facilitator. On success, sets `req.x402Payer` to the verified payer address.
3. **After handler completes** — middleware buffers the response, calls `POST /settle` on the facilitator. If settlement succeeds, flushes the response with a `payment-response` header. If settlement fails, returns 402 instead (payer keeps their USDC).

Unmatched routes pass through without payment checks.

## RouteConfig

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `price` | `string` | required | USDC amount in smallest units (6 decimals). `"100000"` = $0.10 |
| `payTo` | `` `0x${string}` `` | required | Recipient address |
| `description` | `string` | — | Human-readable description |
| `mimeType` | `string` | — | Response MIME type |
| `maxTimeoutSeconds` | `number` | `60` | EIP-712 signature validity window |

Route patterns support bracket-style params: `"GET /api/premium/[id]"` matches `GET /api/premium/123`.

## MiddlewareConfig

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `routes` | `Record<string, RouteConfig>` | required | Route pattern to config map |
| `facilitatorUrl` | `string` | required | Facilitator HTTP endpoint |
| `network` | `Network` | `"eip155:111551119090"` | CAIP-2 network identifier |
| `usdcAddress` | `` `0x${string}` `` | Thanos USDC | Override USDC contract address |

## `req.x402Payer`

After successful verification, `req.x402Payer` contains the payer's Ethereum address (`` `0x${string}` ``). Available in route handlers via the augmented Express `Request` type.

## When to use this vs @x402/express

| Scenario | Use |
|----------|-----|
| Thanos-only, no `@x402/core` | `@x402-ton/server` (this package) |
| Multi-chain with `@x402/core` | `@x402/express` + `@x402-ton/scheme` |
