# @x402-ton/scheme

Plugin adapters that integrate x402-ton with the `@x402/core` framework. Register TON payment support alongside other chains using the standard `@x402/core` client, facilitator, and server classes.

## Installation

```bash
npm install @x402-ton/scheme @x402/core viem
```

Peer dependencies: `@x402/core >= 2.5.0`, `viem >= 2.0.0`

## When to use this vs standalone packages

- **Standalone** (`@x402-ton/client`, `@x402-ton/server`, `@x402-ton/facilitator`): Use when building a TON-only integration. Simpler setup, no `@x402/core` dependency.
- **Scheme plugin** (`@x402-ton/scheme`): Use when integrating TON payments into a multi-chain `@x402/core` application alongside other payment schemes.

## Registration helpers

### Client

Teaches an `x402Client` how to sign TON payments.

```ts
import { x402Client } from "@x402/core/client";
import { registerExactTonScheme } from "@x402-ton/scheme";
import { privateKeyToAccount } from "viem/accounts";

const client = new x402Client();
registerExactTonScheme(client, {
  account: privateKeyToAccount("0x..."),
  facilitatorAddress: "0x...", // optional, defaults to CONTRACTS.facilitator
});
```

### Facilitator

Teaches an `x402Facilitator` how to verify and settle TON payments.

```ts
import { x402Facilitator } from "@x402/core/facilitator";
import { registerExactTonFacilitator } from "@x402-ton/scheme";

const facilitator = new x402Facilitator();
registerExactTonFacilitator(facilitator, {
  publicClient,
  walletClient,
  facilitatorAddress: "0x...", // optional
  networks: ["eip155:111551119090"], // optional, defaults to Thanos Sepolia
});
```

### Server

Teaches an `x402ResourceServer` how to price resources in TON.

```ts
import { x402ResourceServer } from "@x402/core/server";
import { registerExactTonServer } from "@x402-ton/scheme";

const server = new x402ResourceServer(facilitatorClient);
registerExactTonServer(server);
await server.initialize();

const requirements = await server.buildPaymentRequirements({
  scheme: "exact",
  payTo: "0xRecipient",
  price: "0.001", // interpreted as TON, converted to wei
  network: "eip155:111551119090",
  maxTimeoutSeconds: 300,
});
```

## Type conversion utilities

The scheme package converts between `@x402/core` types (scheme `"exact"`, field `amount`) and internal `@x402-ton` types (scheme `"exact-ton"`, field `maxAmountRequired`).

```ts
import {
  toInternalRequirement,
  toInternalVerifyRequest,
  toInternalSettleRequest,
  toPayloadResult,
} from "@x402-ton/scheme";
```

| Function | Direction | Purpose |
|----------|-----------|---------|
| `toInternalRequirement` | core -> internal | Convert `PaymentRequirements` to `PaymentRequirement` |
| `toInternalVerifyRequest` | core -> internal | Build `VerifyRequest` from core payload + requirements |
| `toInternalSettleRequest` | core -> internal | Build `SettleRequest` from core payload + requirements |
| `toPayloadResult` | internal -> core | Convert signed `PaymentPayload` to core's `Record<string, unknown>` |

## Classes

| Class | Implements | Description |
|-------|-----------|-------------|
| `ExactTonClient` | `SchemeNetworkClient` | Signs TON payments via `createPaymentPayload()` |
| `ExactTonFacilitator` | `SchemeNetworkFacilitator` | Verifies and settles TON payments via on-chain calls |
| `ExactTonServer` | `SchemeNetworkServer` | Parses TON prices and enhances payment requirements |
