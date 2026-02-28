# @x402-ton/client

Client library for signing x402 USDC payments via EIP-3009 and auto-handling HTTP 402 responses on Tokamak Network's Thanos L2.

## Installation

```bash
npm install @x402-ton/client @x402-ton/common viem
```

## API

### `signPayment(account, requirement)`

Signs an EIP-3009 `TransferWithAuthorization` message authorizing a USDC transfer directly from the signer's wallet to the recipient. No on-chain transaction — just an off-chain signature.

```typescript
import { privateKeyToAccount } from "viem/accounts";
import { signPayment } from "@x402-ton/client";
import type { PaymentRequirements } from "@x402-ton/common";

const account = privateKeyToAccount("0x...");

const requirement: PaymentRequirements = {
  scheme: "exact",
  network: "eip155:111551119090",
  asset: "0x4200000000000000000000000000000000000778",
  amount: "100000", // $0.10 USDC (6 decimals)
  payTo: "0xRecipient",
  maxTimeoutSeconds: 60,
  extra: { name: "Bridged USDC (Tokamak Network)", version: "2" },
};

const payload = await signPayment(account, requirement);
// payload.payload.signature     — EIP-712 signature (0x...)
// payload.payload.authorization — { from, to, value, validAfter, validBefore, nonce }
```

**Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `account` | `LocalAccount` | viem local account for signing |
| `requirement` | `PaymentRequirements` | Payment requirements from the server |

**Returns:** `PaymentPayload` with the signed authorization and EIP-712 signature.

**Behavior:**
- Sets `validAfter` to 10 minutes before now (clock skew tolerance)
- Sets `validBefore` to `now + maxTimeoutSeconds`
- Generates a random 32-byte nonce
- Signs using the EIP-712 domain from `requirement.extra` (defaults to Bridged USDC on Tokamak)

### `createX402Fetch(config)`

Wraps native `fetch` to automatically handle HTTP 402 responses: decodes the `payment-required` header, signs an EIP-3009 authorization, and retries the request with the `payment-signature` header.

```typescript
import { createX402Fetch } from "@x402-ton/client";
import { privateKeyToAccount } from "viem/accounts";

const x402Fetch = createX402Fetch({ account: privateKeyToAccount("0x...") });

// Automatically handles 402 → sign → retry
const res = await x402Fetch("http://localhost:4403/api/plasma");
console.log(await res.json());
```

**Config:**

| Field | Type | Description |
|-------|------|-------------|
| `account` | `LocalAccount` | viem local account for signing |

**Returns:** A `fetch`-compatible function that transparently handles x402 payments.

## When to use this vs @x402-ton/scheme

- **This package**: Standalone Thanos-only integration, no `@x402/core` dependency
- **`@x402-ton/scheme`**: Multi-chain integration via `@x402/core` + `@x402/fetch`
