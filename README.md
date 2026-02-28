# x402-ton

x402 payment protocol implementation for [Tokamak Network](https://tokamak.network)'s Thanos L2 chain. Pay for APIs with USDC using EIP-3009 `transferWithAuthorization` — no deposits, no custom contracts, no gas from the payer.

## How it works

When a client requests a paid API endpoint, the server returns HTTP 402 with payment requirements. The client signs an EIP-3009 `TransferWithAuthorization` message off-chain, then retries the request with the signed payment. The facilitator verifies the signature and calls `transferWithAuthorization` on USDC to move funds directly from payer to recipient.

```
Client                    Server                   Facilitator
  |--- GET /api/data ------->|                          |
  |<-- 402 + payment-required|                          |
  |                          |                          |
  |  (sign EIP-3009 auth)    |                          |
  |                          |                          |
  |--- GET + payment-sig --->|--- POST /verify -------->|
  |                          |<-- { isValid: true } ----|
  |                          |                          |
  |                          |   (run handler)          |
  |                          |                          |
  |                          |--- POST /settle -------->|
  |                          |<-- { tx: 0x... } --------|
  |<-- 200 + payment-response|                          |
```

**Chain**: Thanos Sepolia (chain ID `111551119090`, CAIP-2: `eip155:111551119090`)
**Token**: USDC at `0x4200000000000000000000000000000000000778` (FiatTokenV2_2, 6 decimals)
**Settlement**: Direct `transferWithAuthorization` on USDC — payer's funds move directly to the payTo address

## Installation

```bash
# Server packages (sell APIs)
npm install @x402-ton/facilitator @x402-ton/scheme @x402/express @x402/core

# Client packages (buy APIs)
npm install @x402-ton/scheme @x402/fetch @x402/core viem
```

## Quick start: Sell an API (server)

Uses `@x402/express` middleware with the Thanos Sepolia scheme registered. The self-hosted facilitator handles on-chain verification and settlement since CDP doesn't support Thanos yet.

```typescript
import express from "express";
import { paymentMiddleware, x402ResourceServer } from "@x402/express";
import { HTTPFacilitatorClient } from "@x402/core/server";
import { registerExactTonServer } from "@x402-ton/scheme";
import { createFacilitatorServer } from "@x402-ton/facilitator";

// Self-hosted facilitator
createFacilitatorServer({ privateKey: "0x..." }).listen(4402);

const facilitatorClient = new HTTPFacilitatorClient({ url: "http://localhost:4402" });
const server = new x402ResourceServer(facilitatorClient);
registerExactTonServer(server);

const app = express();
app.use(paymentMiddleware({
  "GET /api/plasma": {
    accepts: [{
      scheme: "exact",
      price: "$0.10",
      network: "eip155:111551119090",
      payTo: "0xYourAddress",
    }],
    description: "Plasma channel state",
  },
}, server));

app.get("/api/plasma", (_req, res) => {
  res.json({ epoch: 42, throughput: "1800 tx/s" });
});

app.listen(4403);
```

## Quick start: Buy an API (client)

Uses `@x402/fetch` — wraps native `fetch` to automatically handle 402 responses.

```typescript
import { x402Client } from "@x402/core/client";
import { wrapFetchWithPayment } from "@x402/fetch";
import { registerExactTonScheme } from "@x402-ton/scheme";
import { privateKeyToAccount } from "viem/accounts";

const client = new x402Client();
registerExactTonScheme(client, { account: privateKeyToAccount("0x...") });

const fetchWithPayment = wrapFetchWithPayment(fetch, client);
const res = await fetchWithPayment("http://localhost:4403/api/plasma");
console.log(await res.json());
```

## Standalone usage (no @x402/core)

For Thanos-only integrations without the multi-chain framework:

### Server

```typescript
import express from "express";
import { paymentMiddleware } from "@x402-ton/server";

const app = express();
app.use(paymentMiddleware({
  facilitatorUrl: "http://localhost:4402",
  routes: {
    "GET /api/plasma": {
      price: "100000", // $0.10 USDC (6 decimals)
      payTo: "0xYourAddress",
    },
  },
}));

app.get("/api/plasma", (req, res) => {
  res.json({ payer: req.x402Payer, data: "..." });
});
app.listen(4403);
```

### Client

```typescript
import { createX402Fetch } from "@x402-ton/client";
import { privateKeyToAccount } from "viem/accounts";

const x402Fetch = createX402Fetch({ account: privateKeyToAccount("0x...") });
const res = await x402Fetch("http://localhost:4403/api/plasma");
```

## CLI

```bash
npm install -g @x402-ton/cli

# Check balances
PRIVATE_KEY=0x... x402-ton balance

# Pay for an API endpoint
PRIVATE_KEY=0x... x402-ton pay http://localhost:4403/api/plasma
```

## MCP server (AI agents)

x402-ton includes an MCP server that lets AI agents pay for APIs autonomously.

```json
{
  "mcpServers": {
    "x402-ton": {
      "command": "npx",
      "args": ["@x402-ton/mcp"],
      "env": { "PRIVATE_KEY": "0x..." }
    }
  }
}
```

Tools: `pay_for_api` (fetch URLs with automatic x402 payment), `check_balance` (USDC + native balance).

## HTTP headers

| Header | Direction | Description |
|--------|-----------|-------------|
| `PAYMENT-REQUIRED` | Server → Client | Base64-encoded payment requirements (on 402 response) |
| `PAYMENT-SIGNATURE` | Client → Server | Base64-encoded signed payment payload |
| `PAYMENT-RESPONSE` | Server → Client | Base64-encoded settlement result (on 200 response) |

## Types

```typescript
type Network = `${string}:${string}`; // "eip155:111551119090"

interface PaymentRequirements {
  scheme: "exact";
  network: Network;
  asset: `0x${string}`;
  amount: string;           // USDC amount in smallest units (6 decimals)
  payTo: `0x${string}`;
  maxTimeoutSeconds: number;
  extra: Record<string, unknown>;
}

interface TransferAuthorization {
  from: `0x${string}`;
  to: `0x${string}`;
  value: string;
  validAfter: string;
  validBefore: string;
  nonce: `0x${string}`;
}

interface PaymentPayload {
  x402Version: number;
  scheme: "exact";
  network: Network;
  payload: {
    signature: `0x${string}`;
    authorization: TransferAuthorization;
  };
}
```

## Testnet setup

The examples require USDC on Thanos Sepolia. This script automates bridging USDC from Sepolia L1 to Thanos L2:

```bash
PRIVATE_KEY=0x... npm run fund-testnet
```

It checks your L2 balance, and if needed, bridges your L1 Sepolia USDC through the OP Stack bridge. If you have no L1 USDC, it will direct you to the [Circle faucet](https://faucet.circle.com/).

## Examples

### Server (sell APIs)

```bash
cd examples/servers/express
cp .env.example .env   # add your keys
npm start              # starts facilitator (:4402) + API (:4403)
```

Endpoints: `GET /api/plasma` ($0.10), `GET /api/fusion` ($0.001), `GET /api/health` (free).

### Client (buy APIs)

```bash
cd examples/clients/fetch
cp .env.example .env   # add payer private key
npm start              # hits paid endpoints with automatic x402 payment
```

## Packages

| Package | Description |
|---------|-------------|
| [`@x402-ton/common`](packages/common/README.md) | Types, chain config, EIP-3009 constants, USDC ABI |
| [`@x402-ton/client`](packages/client/README.md) | EIP-3009 signing and fetch wrapper |
| [`@x402-ton/server`](packages/server/README.md) | Express payment middleware (standalone) |
| [`@x402-ton/facilitator`](packages/facilitator/README.md) | On-chain verification and settlement server |
| [`@x402-ton/scheme`](packages/scheme/README.md) | Plugin adapters for `@x402/core` multi-chain framework |
| [`@x402-ton/cli`](packages/cli/README.md) | CLI: check balances, pay for endpoints |
| [`@x402-ton/mcp`](packages/mcp/README.md) | MCP server for AI agent payments |

## Architecture

```
@x402-ton/common         Shared types, chain config, EIP-3009 constants, USDC ABI
@x402-ton/client         Sign EIP-3009 authorizations, fetch wrapper
@x402-ton/server         Express middleware — returns 402, verifies, settles
@x402-ton/facilitator    Verify + settle USDC payments on-chain, HTTP server
@x402-ton/scheme         Plugin adapters for @x402/core framework
@x402-ton/cli            CLI: balance, pay
@x402-ton/mcp            MCP server for AI agent payments
```

### When to use scheme vs standalone

| Scenario | Use |
|----------|-----|
| Thanos-only integration | `@x402-ton/client` + `@x402-ton/server` + `@x402-ton/facilitator` |
| Multi-chain with @x402/core | `@x402-ton/scheme` + `@x402/express` + `@x402/fetch` |
| AI agent payments | `@x402-ton/mcp` |
| Quick testing | `@x402-ton/cli` |

## Development

```bash
npm install
npm run typecheck   # Type-check all packages
npm test            # Run tests
```

## Network details

| Property | Value |
|----------|-------|
| Chain name | Thanos Sepolia |
| Chain ID | `111551119090` |
| CAIP-2 | `eip155:111551119090` |
| Native token | TON |
| USDC address | `0x4200000000000000000000000000000000000778` |
| USDC standard | FiatTokenV2_2 (EIP-3009 `transferWithAuthorization`) |
| RPC | `https://rpc.thanos-sepolia.tokamak.network` |
| Explorer | `https://explorer.thanos-sepolia.tokamak.network` |

## Related

- [x402 protocol](https://github.com/coinbase/x402) — the base protocol by Coinbase
- [Tokamak Network](https://tokamak.network) — L2 scaling for Ethereum
- [EIP-3009](https://eips.ethereum.org/EIPS/eip-3009) — Transfer With Authorization

## License

MIT
