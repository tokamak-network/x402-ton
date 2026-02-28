# x402-ton → Standard x402 USDC Migration

**Date:** 2026-02-27
**Status:** Approved

## Summary

Migrate x402-ton from a custom deposit-based native TON payment scheme to the standard x402 protocol using USDC with EIP-3009 `transferWithAuthorization` on Thanos. This makes x402-ton fully compatible with the existing x402 ecosystem (1,100+ projects, 63M+ tx/month).

## Why

The current deposit model (`exact-ton` scheme) requires users to pre-fund a custom facilitator contract before making payments. This is incompatible with the standard x402 protocol and creates friction that no other x402 chain has.

Thanos already has USDC predeployed at `0x4200000000000000000000000000000000000778` with EIP-3009 support built in. The standard x402 `exact` scheme works on Thanos with zero new contracts.

## Architecture

### Payment Flow (After Migration)

```
1. Client → GET /api/data
2. Server → 402 + payment-required header
   { scheme: "exact", network: "eip155:111551119090", asset: "0x4200...0778" }
3. Client signs EIP-3009 TransferWithAuthorization (off-chain, free)
4. Client → GET /api/data + X-PAYMENT header (base64 signed payload)
5. Server → POST /verify to facilitator
6. Facilitator recovers signer, checks amount/recipient/nonce/deadline
7. Server → 200 + response data
8. Facilitator → USDC.transferWithAuthorization(from, to, value, validAfter, validBefore, nonce, v, r, s)
9. USDC moves directly: client wallet → API owner wallet
```

### Constants

| Constant | Value |
|----------|-------|
| USDC address | `0x4200000000000000000000000000000000000778` |
| USDC decimals | 6 |
| Chain ID | 111551119090 |
| CAIP-2 | `eip155:111551119090` |
| EIP-3009 domain name | `USD Coin` |
| EIP-3009 domain version | `2` |
| RPC | `https://rpc.thanos-sepolia.tokamak.network` |

### EIP-3009 Signed Message

```
domain = {
  name: "USD Coin",
  version: "2",
  chainId: 111551119090,
  verifyingContract: "0x4200000000000000000000000000000000000778"
}

types = {
  TransferWithAuthorization: [
    { name: "from",        type: "address" },
    { name: "to",          type: "address" },
    { name: "value",       type: "uint256" },
    { name: "validAfter",  type: "uint256" },
    { name: "validBefore", type: "uint256" },
    { name: "nonce",       type: "bytes32" },
  ]
}
```

## Package Changes

### packages/common

- Replace `PaymentAuthorization` with EIP-3009 `TransferAuthorization` type
- Replace `PAYMENT_AUTH_TYPES` with `TRANSFER_WITH_AUTHORIZATION_TYPES`
- Replace `getFacilitatorDomain()` with `getUsdcDomain()`
- Replace `FACILITATOR_ABI` with `USDC_ABI` (transferWithAuthorization + balanceOf)
- Remove `ENTRY_POINT_ABI`, `STEALTH_ACCOUNT_ABI`, `STEALTH_ACCOUNT_FACTORY_ABI`
- Update `CONTRACTS` to just `{ usdc: "0x4200...0778" }`
- Change scheme from `"exact-ton"` to `"exact"`
- Change asset from `"native"` to USDC address
- Amounts change from 18 decimals (TON) to 6 decimals (USDC)

### packages/client

- Rewrite `signPayment()` to sign EIP-3009 `TransferWithAuthorization`
- Delete `deposit.ts` entirely (no deposits needed)
- Simplify `createX402Fetch()` — remove autoDeposit/ensureBalance logic
- Add `getUsdcBalance()` helper

### packages/server

- Update middleware types to use `"exact"` scheme
- Update payment-required header to include USDC asset address
- Remove gasless settlement path
- Verify/settle calls remain the same HTTP pattern

### packages/facilitator

- Rewrite `verify.ts` to recover EIP-3009 signer and validate fields
- Rewrite `settle.ts` to call `USDC.transferWithAuthorization()`
- Delete `gasless.ts` entirely
- Facilitator wallet only needs gas for settle tx (not TON balance)

### packages/scheme

- Register as standard `exact` scheme on `eip155:111551119090`
- Adapt type converters for EIP-3009 payload format

### packages/cli

- Remove `deposit` and `withdraw` commands
- Update `balance` to show USDC balance
- Update `pay` to use EIP-3009 signing

### packages/mcp

- Remove deposit/withdraw tools
- Update `pay_for_api` to use EIP-3009
- Update `check_balance` to show USDC

### contracts/

- Delete entirely. No custom contract needed.

### examples/

- Update all examples for USDC flow
- Update react-demo for new client API

## What Gets Deleted

- `contracts/` directory
- `packages/common/src/abi.ts` (custom contract ABIs)
- `packages/client/src/deposit.ts` (deposit/withdraw/ensureBalance)
- `packages/facilitator/src/gasless.ts` (ERC-4337 gasless settlement)
- All deposit/withdraw related code across CLI, MCP, examples

## Testing

- Facilitator: verify recovers correct signer, settle calls USDC correctly
- Client: signs valid EIP-3009 messages
- Server: returns correct 402 headers, verifies payments, settles
- E2E: full flow from 402 → sign → verify → 200 → settle on Thanos Sepolia
