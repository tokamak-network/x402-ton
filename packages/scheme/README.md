# @x402-ton/scheme

Plugin adapters that integrate x402-ton with the [`@x402/core`](https://github.com/coinbase/x402) framework. Register Thanos Sepolia USDC payment support alongside other chains (Base, Solana, etc.) using the standard `@x402/core` client, facilitator, and server classes.

## Installation

```bash
npm install @x402-ton/scheme @x402/core viem
```

Peer dependencies: `@x402/core >= 2.5.0`, `viem >= 2.0.0`

## When to use this vs standalone packages

| Scenario | Use |
|----------|-----|
| Multi-chain app (Thanos + Base + Solana) | **This package** — register alongside other `@x402/core` schemes |
| Thanos-only integration | `@x402-ton/client` + `@x402-ton/server` + `@x402-ton/facilitator` |

## Registration helpers

### Client — sign payments

Registers the Thanos EIP-3009 signing scheme with an `x402Client`:

```typescript
import { x402Client } from "@x402/core/client";
import { wrapFetchWithPayment } from "@x402/fetch";
import { registerExactTonScheme } from "@x402-ton/scheme";
import { privateKeyToAccount } from "viem/accounts";

const client = new x402Client();
registerExactTonScheme(client, {
  account: privateKeyToAccount("0x..."),
});

// Now this client can pay for both Base and Thanos endpoints
const fetchWithPayment = wrapFetchWithPayment(fetch, client);
const res = await fetchWithPayment("http://localhost:4403/api/plasma");
```

### Facilitator — verify and settle

Registers the Thanos verification and settlement scheme with an `x402Facilitator`:

```typescript
import { x402Facilitator } from "@x402/core/facilitator";
import { registerExactTonFacilitator } from "@x402-ton/scheme";
import { createPublicClient, createWalletClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { thanosSepolia } from "@x402-ton/common";

const account = privateKeyToAccount("0x...");

const facilitator = new x402Facilitator();
registerExactTonFacilitator(facilitator, {
  publicClient: createPublicClient({ chain: thanosSepolia, transport: http() }),
  walletClient: createWalletClient({ account, chain: thanosSepolia, transport: http() }),
});
```

### Server — price resources

Registers the USDC price parser with an `x402ResourceServer`:

```typescript
import { x402ResourceServer } from "@x402/core/server";
import { HTTPFacilitatorClient } from "@x402/core/server";
import { registerExactTonServer } from "@x402-ton/scheme";

const facilitatorClient = new HTTPFacilitatorClient({ url: "http://localhost:4402" });
const server = new x402ResourceServer(facilitatorClient);
registerExactTonServer(server);
```

## Multi-chain example

Register Thanos alongside Base in the same application:

```typescript
import { x402Client } from "@x402/core/client";
import { ExactEvmScheme } from "@x402/evm/exact/client";
import { registerExactTonScheme } from "@x402-ton/scheme";

const client = new x402Client()
  .register("eip155:8453", new ExactEvmScheme(evmSigner)); // Base

registerExactTonScheme(client, { account }); // Thanos Sepolia
```

## Type conversion utilities

The scheme package converts between `@x402/core` generic types and `@x402-ton/common` concrete types:

```typescript
import {
  toInternalRequirement,
  toInternalVerifyRequest,
  toInternalSettleRequest,
  toPayloadResult,
} from "@x402-ton/scheme";
```

| Function | Direction | Purpose |
|----------|-----------|---------|
| `toInternalRequirement` | core → internal | Convert generic `PaymentRequirements` to typed internal format |
| `toInternalVerifyRequest` | core → internal | Build `VerifyRequest` from core payload + requirements |
| `toInternalSettleRequest` | core → internal | Build `SettleRequest` from core payload + requirements |
| `toPayloadResult` | internal → core | Convert signed `PaymentPayload` to `Record<string, unknown>` |

## Classes

| Class | Implements | Description |
|-------|-----------|-------------|
| `ExactTonClient` | `SchemeNetworkClient` | Signs EIP-3009 authorizations via `createPaymentPayload()` |
| `ExactTonFacilitator` | `SchemeNetworkFacilitator` | Verifies signatures and settles USDC transfers on-chain |
| `ExactTonServer` | `SchemeNetworkServer` | Parses USDC prices (6 decimals) and enhances payment requirements |
