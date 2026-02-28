# x402-ton Examples Alignment with Base x402

**Date**: 2026-02-27
**Status**: Approved

## Goal

Replace all custom examples with two canonical examples that mirror base coinbase/x402's developer experience exactly. Packages stay as-is — only examples change.

## Changes

### Delete

All existing examples:
- `examples/react-demo/`
- `examples/demo-api/`
- `examples/standalone-e2e/`
- `examples/scheme-plugin/`
- `examples/hybrid-interop/`

### Create

```
examples/
├── clients/
│   └── fetch/
│       ├── package.json      # @x402/core, @x402/fetch, @x402-ton/scheme, viem
│       ├── .env.example
│       └── src/index.ts
└── servers/
    └── express/
        ├── package.json      # @x402/core, @x402/express, @x402-ton/scheme, @x402-ton/facilitator, express, viem
        ├── .env.example
        └── src/index.ts
```

## clients/fetch

The buyer side. Uses `@x402/fetch` with `wrapFetchWithPayment` — identical pattern to base x402's `examples/typescript/clients/fetch`.

```ts
import { x402Client } from "@x402/core/client";
import { wrapFetchWithPayment } from "@x402/fetch";
import { registerExactTonScheme } from "@x402-ton/scheme";
import { privateKeyToAccount } from "viem/accounts";

const client = new x402Client();
registerExactTonScheme(client, {
  account: privateKeyToAccount(process.env.PRIVATE_KEY as `0x${string}`),
});

const fetchWithPayment = wrapFetchWithPayment(fetch, client);

// Hit a paid endpoint — 402 handling is automatic
const res = await fetchWithPayment("http://localhost:4403/api/weather");
console.log(await res.json());
```

Env: `PRIVATE_KEY` — payer wallet with USDC on Thanos Sepolia.

## servers/express

The seller side. Uses `@x402/express` with `paymentMiddleware` and `x402ResourceServer` — identical pattern to base x402's `examples/typescript/servers/express`. Runs self-hosted facilitator inline since CDP doesn't support Thanos Sepolia.

```ts
import express from "express";
import { paymentMiddleware, x402ResourceServer } from "@x402/express";
import { HTTPFacilitatorClient } from "@x402/core/server";
import { registerExactTonServer } from "@x402-ton/scheme";
import { registerExactTonFacilitator } from "@x402-ton/scheme";
import { createFacilitatorServer } from "@x402-ton/facilitator";

// Start self-hosted facilitator
const fac = createFacilitatorServer({ privateKey: process.env.FACILITATOR_PRIVATE_KEY as `0x${string}` });
fac.listen(4402, () => console.log("Facilitator on :4402"));

// Wire x402 resource server
const facilitatorClient = new HTTPFacilitatorClient({ url: "http://localhost:4402" });
const server = new x402ResourceServer(facilitatorClient);
registerExactTonServer(server);
await server.initialize();

// Express app
const app = express();
app.use(paymentMiddleware({
  "GET /api/weather": {
    accepts: [{
      scheme: "exact",
      price: "$0.10",
      network: "eip155:111551119090",
      payTo: process.env.PAY_TO_ADDRESS as `0x${string}`,
    }],
    description: "Current weather data",
    mimeType: "application/json",
  },
  "GET /api/joke": {
    accepts: [{
      scheme: "exact",
      price: "$0.001",
      network: "eip155:111551119090",
      payTo: process.env.PAY_TO_ADDRESS as `0x${string}`,
    }],
    description: "A random joke",
    mimeType: "application/json",
  },
}, server));

app.get("/api/weather", (req, res) => {
  res.json({ location: "Thanos Sepolia", temperature: "42°C" });
});

app.get("/api/joke", (req, res) => {
  res.json({ joke: "Why do blockchain devs never get cold? Too many layers." });
});

app.get("/api/free", (req, res) => {
  res.json({ message: "This endpoint is free!" });
});

app.listen(4403, () => console.log("API on :4403"));
```

Env: `FACILITATOR_PRIVATE_KEY`, `PAY_TO_ADDRESS`.

## Route config format

Matches base x402 exactly — uses `accepts` array (not flat `price`/`payTo`):

```ts
{
  "GET /api/weather": {
    accepts: [{
      scheme: "exact",
      price: "$0.10",
      network: "eip155:111551119090",
      payTo: "0x...",
    }],
    description: "...",
    mimeType: "application/json",
  }
}
```

## Key properties

- Identical DX to base x402 — same imports, same patterns, same route config shape
- Only x402-ton-specific: `registerExactTonScheme/Server` and self-hosted facilitator
- Self-contained: each example runs with `npx tsx src/index.ts`
- No React, no wallet connect, no browser — pure server-to-server
