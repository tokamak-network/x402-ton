# @x402-ton/common

Shared types, chain configuration, EIP-712 domain utilities, and contract ABI for the x402-ton protocol.

## Installation

```bash
npm install @x402-ton/common
```

Peer dependency: `viem >= 2.0.0`

## Exports

### Types

| Type | Description |
|------|-------------|
| `PaymentRequirement` | What a server requires: scheme, network, amount, payTo, asset, timeout |
| `PaymentRequired` | HTTP 402 response body: `{ version: 2, accepts: PaymentRequirement[] }` |
| `PaymentAuthorization` | Signed authorization fields: from, to, amount, deadline, nonce |
| `PaymentPayload` | Client's payment submission: version, scheme, network, signature + authorization |
| `VerifyRequest` | Facilitator verify input: payload + requirements |
| `VerifyResponse` | Facilitator verify output: isValid, invalidReason, payer |
| `SettleRequest` | Facilitator settle input: payload + requirements |
| `SettlementResponse` | Facilitator settle output: success, payer, transaction, network |

### Chain config

```ts
import { thanosSepolia, CAIP2_THANOS_SEPOLIA, CONTRACTS } from "@x402-ton/common";

thanosSepolia.id;           // 111551119090
thanosSepolia.name;         // "Thanos Sepolia"
CAIP2_THANOS_SEPOLIA;       // "eip155:111551119090"

CONTRACTS.facilitator;      // "0x0af530d6d66947aD930a7d1De60E58c43D40a308"
CONTRACTS.entryPoint;       // ERC-4337 EntryPoint (for gasless settlement)
CONTRACTS.paymaster;        // DustPaymaster
CONTRACTS.accountFactory;   // StealthAccountFactory
```

`thanosSepolia` is a viem chain definition with RPC (`https://rpc.thanos-sepolia.tokamak.network`) and block explorer (`https://explorer.thanos-sepolia.tokamak.network`) configured.

### EIP-712 utilities

```ts
import { PAYMENT_AUTH_TYPES, getFacilitatorDomain } from "@x402-ton/common";

const domain = getFacilitatorDomain(
  "0x0af530d6d66947aD930a7d1De60E58c43D40a308",
  111551119090
);
// { name: "x402-TON Payment Facilitator", version: "1", chainId, verifyingContract }
```

`PAYMENT_AUTH_TYPES` defines the EIP-712 typed data structure for `PaymentAuth(address from, address to, uint256 amount, uint256 deadline, bytes32 nonce)`.

### Contract ABI

```ts
import { FACILITATOR_ABI, ENTRY_POINT_ABI } from "@x402-ton/common";
```

`FACILITATOR_ABI` covers: `deposit`, `withdraw`, `settle`, `verify`, `balances`, `usedNonces`, `domainSeparator`, and events (`Deposited`, `Withdrawn`, `PaymentSettled`).

### Runtime helpers

```ts
import { setFacilitatorAddress } from "@x402-ton/common";

// Override the default facilitator address at runtime
setFacilitatorAddress("0xNewAddress");
```
