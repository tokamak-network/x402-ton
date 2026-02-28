# @x402-ton/common

Shared types, chain configuration, EIP-3009 constants, and USDC ABI for the x402-ton protocol.

## Installation

```bash
npm install @x402-ton/common
```

Peer dependency: `viem >= 2.0.0`

## Chain configuration

```typescript
import { thanosSepolia, CAIP2_THANOS_SEPOLIA, THANOS_USDC } from "@x402-ton/common";

thanosSepolia.id;           // 111551119090
thanosSepolia.name;         // "Thanos Sepolia"
CAIP2_THANOS_SEPOLIA;       // "eip155:111551119090"
THANOS_USDC;                // "0x4200000000000000000000000000000000000778"
```

`thanosSepolia` is a [viem chain definition](https://viem.sh/docs/chains/introduction) with RPC and block explorer pre-configured:

| Property | Value |
|----------|-------|
| RPC | `https://rpc.thanos-sepolia.tokamak.network` |
| WebSocket | `wss://rpc.thanos-sepolia.tokamak.network` |
| Explorer | `https://explorer.thanos-sepolia.tokamak.network` |

Override via environment variables: `THANOS_RPC_URL`, `THANOS_WS_URL`, `USDC_ADDRESS`.

## EIP-3009 constants

```typescript
import { TRANSFER_WITH_AUTHORIZATION_TYPES, getUsdcDomain } from "@x402-ton/common";

// EIP-712 domain for Thanos Sepolia USDC
const domain = getUsdcDomain("0x4200000000000000000000000000000000000778", 111551119090);
// { name: "Bridged USDC (Tokamak Network)", version: "2", chainId, verifyingContract }
```

`TRANSFER_WITH_AUTHORIZATION_TYPES` defines the EIP-712 typed data structure:

```
TransferWithAuthorization(address from, address to, uint256 value, uint256 validAfter, uint256 validBefore, bytes32 nonce)
```

The `getUsdcDomain` function accepts an optional `extra` parameter to override the domain name and version for different USDC deployments.

## USDC ABI

```typescript
import { USDC_ABI } from "@x402-ton/common";
```

Covers: `transferWithAuthorization`, `balanceOf`, `version`, `allowance`, `approve`.

## Types

| Type | Description |
|------|-------------|
| `Network` | CAIP-2 network identifier (`` `${string}:${string}` ``) |
| `PaymentRequirements` | What a server requires: scheme, network, asset, amount, payTo, timeout, extra |
| `PaymentRequired` | HTTP 402 response body: `{ x402Version, accepts: PaymentRequirements[] }` |
| `TransferAuthorization` | EIP-3009 fields: from, to, value, validAfter, validBefore, nonce |
| `PaymentPayload` | Client's payment: x402Version, scheme, network, signature + authorization |
| `VerifyRequest` | Facilitator verify input: x402Version, payload + requirements |
| `VerifyResponse` | Facilitator verify output: isValid, invalidReason, payer |
| `SettleRequest` | Facilitator settle input: x402Version, payload + requirements |
| `SettlementResponse` | Facilitator settle output: success, payer, transaction, network |

## Exports

```typescript
// Types
export type {
  Network, PaymentRequirements, PaymentRequired, TransferAuthorization,
  PaymentPayload, VerifyRequest, VerifyResponse, SettleRequest, SettlementResponse,
};

// Chain config
export { thanosSepolia, CAIP2_THANOS_SEPOLIA, THANOS_USDC };

// EIP-3009
export { TRANSFER_WITH_AUTHORIZATION_TYPES, getUsdcDomain };

// ABI
export { USDC_ABI };
```
