# @x402-ton/server

Express middleware that adds x402 paywalls to API endpoints. Returns HTTP 402 with payment requirements, verifies incoming payments via a facilitator, and settles after the handler responds.

## Installation

```bash
npm install @x402-ton/server @x402-ton/common express
```

## Usage

```ts
import express from "express";
import { parseEther } from "viem";
import { paymentMiddleware } from "@x402-ton/server";

const app = express();

app.use(
  paymentMiddleware({
    facilitatorUrl: "http://localhost:4402",
    routes: {
      "GET /api/weather": {
        price: parseEther("0.001").toString(),
        payTo: "0xYourAddress",
        description: "Weather data",
      },
      "GET /api/premium/[id]": {
        price: parseEther("0.01").toString(),
        payTo: "0xYourAddress",
        description: "Premium content",
      },
    },
  })
);

app.get("/api/weather", (req, res) => {
  // req.x402Payer is the verified payer address
  res.json({ temp: "42C", payer: req.x402Payer });
});

app.listen(3000);
```

## Behavior

1. Request arrives without `payment-signature` header -- middleware returns HTTP 402 with a base64-encoded `payment-required` header containing the route's `PaymentRequirement`.
2. Request arrives with `payment-signature` header -- middleware decodes the payment payload, calls `POST /verify` on the facilitator, and on success sets `req.x402Payer` to the verified payer address.
3. After the route handler calls `res.json()`, the middleware calls `POST /settle` (or `/settle-gasless`) on the facilitator and includes the settlement result in the `payment-response` header.

Unmatched routes (not in `config.routes`) pass through without payment checks.

## RouteConfig

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `price` | `string` | required | Payment amount in wei |
| `payTo` | `` `0x${string}` `` | required | Recipient address |
| `description` | `string` | `""` | Human-readable description |
| `mimeType` | `string` | `"application/json"` | Response MIME type |
| `maxTimeoutSeconds` | `number` | `60` | EIP-712 signature validity window |

Route patterns support bracket-style params: `"GET /api/premium/[id]"` matches `GET /api/premium/123`.

## MiddlewareConfig

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `routes` | `Record<string, RouteConfig>` | required | Route pattern to config map |
| `facilitatorUrl` | `string` | required | Facilitator HTTP endpoint |
| `network` | `string` | `"eip155:111551119090"` | CAIP-2 network identifier |
| `gasless` | `boolean` | `false` | Use `/settle-gasless` (ERC-4337) instead of `/settle` |

## req.x402Payer

After successful verification, `req.x402Payer` contains the payer's Ethereum address (`` `0x${string}` ``). Available in route handlers via the augmented Express `Request` type.
