# x402-ton

x402 payment protocol implementation for Tokamak Network's Thanos L2 chain (native TON token).

## Architecture

```
@x402-ton/common         Types, chain config, EIP-712 domain, contract ABI
@x402-ton/client         Sign payments, deposit/withdraw, fetch wrapper
@x402-ton/server         Express middleware — returns 402, verifies, settles
@x402-ton/facilitator    Verify + settle payments on-chain, HTTP server
@x402-ton/scheme         Plugin adapters for @x402/core framework
@x402-ton/cli            CLI: balance, deposit, pay

contracts/               TonPaymentFacilitator.sol (Foundry)
```

**Chain**: Thanos Sepolia (chain ID `111551119090`, CAIP-2: `eip155:111551119090`)
**Facilitator contract**: `0x0af530d6d66947aD930a7d1De60E58c43D40a308`

## How it works

Payers deposit TON into the facilitator contract. When accessing a paid API, the client signs an EIP-712 `PaymentAuth` message authorizing transfer from their deposit to the API operator. The facilitator verifies the signature on-chain and settles by moving funds.

```
Client                    Server                   Facilitator
  |--- GET /api/data ------->|                          |
  |<-- 402 + payment-required|                          |
  |                          |                          |
  |  (sign EIP-712 auth)     |                          |
  |                          |                          |
  |--- GET + payment-sig --->|--- POST /verify -------->|
  |                          |<-- { isValid: true } ----|
  |                          |--- POST /settle -------->|
  |                          |<-- { tx: 0x... } --------|
  |<-- 200 + payment-response|                          |
```

## Quick start: Protect an API (server)

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
        description: "Weather data (0.001 TON)",
      },
    },
  })
);

app.get("/api/weather", (req, res) => {
  res.json({ temp: "42C", payer: req.x402Payer });
});

app.listen(3000);
```

## Quick start: Pay for an API (client)

```ts
import { createPublicClient, createWalletClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { thanosSepolia } from "@x402-ton/common";
import { createX402TonFetch } from "@x402-ton/client";

const account = privateKeyToAccount("0xYourPrivateKey");
const publicClient = createPublicClient({ chain: thanosSepolia, transport: http() });
const walletClient = createWalletClient({ account, chain: thanosSepolia, transport: http() });

const x402Fetch = createX402TonFetch({
  account,
  publicClient,
  walletClient,
  autoDeposit: true,
});

const res = await x402Fetch("http://localhost:3000/api/weather");
console.log(await res.json());
```

## Quick start: @x402/core plugin

Use `@x402-ton/scheme` to plug TON payments into the `@x402/core` framework alongside other chains.

```ts
import { x402Client } from "@x402/core/client";
import { x402Facilitator } from "@x402/core/facilitator";
import { x402ResourceServer } from "@x402/core/server";
import {
  registerExactTonScheme,
  registerExactTonFacilitator,
  registerExactTonServer,
} from "@x402-ton/scheme";

const client = new x402Client();
registerExactTonScheme(client, { account });

const facilitator = new x402Facilitator();
registerExactTonFacilitator(facilitator, { publicClient, walletClient });

const server = new x402ResourceServer(facilitatorClient);
registerExactTonServer(server);
```

## CLI

```bash
# Install
npm install -g @x402-ton/cli

# Check balances
PRIVATE_KEY=0x... x402-ton balance

# Deposit TON into facilitator
PRIVATE_KEY=0x... x402-ton deposit 1.0

# Pay for an API endpoint
PRIVATE_KEY=0x... x402-ton pay http://localhost:3000/api/weather
```

## Contract deployment

```bash
cd contracts
forge install
forge build
forge test

# Deploy to Thanos Sepolia
PRIVATE_KEY=0x... forge script script/Deploy.s.sol \
  --rpc-url https://rpc.thanos-sepolia.tokamak.network \
  --broadcast
```

## Development

```bash
npm install
npm run build       # Build all packages
npm run typecheck   # Type-check all packages
```

## Examples

| Example | Description |
|---------|-------------|
| `examples/demo-api` | Express API with x402 paywall |
| `examples/scheme-plugin` | Full @x402/core plugin flow |
| `examples/standalone-e2e` | HTTP E2E test with real servers |
| `examples/hybrid-interop` | Cross-compatibility between standalone and plugin modes |

## Packages

- [`@x402-ton/common`](packages/common/README.md) -- Types, chain config, ABI
- [`@x402-ton/client`](packages/client/README.md) -- Client signing and deposit
- [`@x402-ton/server`](packages/server/README.md) -- Express payment middleware
- [`@x402-ton/facilitator`](packages/facilitator/README.md) -- On-chain verification and settlement
- [`@x402-ton/scheme`](packages/scheme/README.md) -- @x402/core plugin adapters
- [`@x402-ton/cli`](packages/cli/README.md) -- CLI tool

## License

MIT
