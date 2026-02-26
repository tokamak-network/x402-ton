# @x402-ton/client

Client library for signing x402 payments, managing facilitator deposits, and auto-handling HTTP 402 responses.

## Installation

```bash
npm install @x402-ton/client @x402-ton/common viem
```

## signPayment

Signs an EIP-712 `PaymentAuth` message authorizing a payment from the signer's facilitator deposit.

```ts
import { privateKeyToAccount } from "viem/accounts";
import { signPayment } from "@x402-ton/client";
import { type PaymentRequirement } from "@x402-ton/common";

const account = privateKeyToAccount("0x...");

const requirement: PaymentRequirement = {
  scheme: "exact-ton",
  network: "eip155:111551119090",
  maxAmountRequired: "1000000000000000", // 0.001 TON in wei
  payTo: "0xRecipient",
  maxTimeoutSeconds: 60,
  asset: "native",
  resource: "/api/data",
  description: "Data endpoint",
  mimeType: "application/json",
};

const payload = await signPayment({ account }, requirement);
// payload.payload.signature   — EIP-712 signature
// payload.payload.authorization — { from, to, amount, deadline, nonce }
```

### SignerConfig

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `account` | `LocalAccount` | required | viem local account for signing |
| `facilitatorAddress` | `` `0x${string}` `` | `CONTRACTS.facilitator` | Override facilitator contract |
| `chainId` | `number` | `111551119090` | Override chain ID |

## Deposit management

```ts
import { createPublicClient, createWalletClient, http, parseEther } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { thanosSepolia } from "@x402-ton/common";
import { deposit, getBalance, withdraw, ensureBalance } from "@x402-ton/client";

const account = privateKeyToAccount("0x...");
const publicClient = createPublicClient({ chain: thanosSepolia, transport: http() });
const walletClient = createWalletClient({ account, chain: thanosSepolia, transport: http() });

// Check facilitator balance
const balance = await getBalance(publicClient, account.address);

// Deposit 1 TON
const txHash = await deposit(walletClient, parseEther("1.0"));

// Withdraw 0.5 TON
const withdrawHash = await withdraw(walletClient, parseEther("0.5"));

// Deposit only if balance is below the required amount
const topUpHash = await ensureBalance(publicClient, walletClient, parseEther("2.0"));
// Returns null if balance is already sufficient
```

## createX402TonFetch

A `fetch` wrapper that automatically handles HTTP 402 responses: decodes the `payment-required` header, signs a payment, and retries the request with the `payment-signature` header.

```ts
import { createX402TonFetch } from "@x402-ton/client";

const x402Fetch = createX402TonFetch({
  account,
  publicClient,
  walletClient,
  autoDeposit: true, // auto-deposit if facilitator balance is too low
});

const res = await x402Fetch("http://localhost:3000/api/weather");
console.log(await res.json());
```

### X402TonClientConfig

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `account` | `LocalAccount` | required | viem local account |
| `publicClient` | `PublicClient` | required | For balance checks |
| `walletClient` | `WalletClient` | required | For deposit transactions |
| `facilitatorAddress` | `` `0x${string}` `` | `CONTRACTS.facilitator` | Override facilitator contract |
| `chainId` | `number` | `111551119090` | Override chain ID |
| `autoDeposit` | `boolean` | `false` | Auto-deposit if balance insufficient |

If `autoDeposit` is false and the facilitator balance is too low, the payment will fail at verification time.
