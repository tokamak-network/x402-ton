# @x402-ton/facilitator

On-chain payment verification and settlement for the x402-ton protocol. Includes an HTTP server and programmatic API.

## Installation

```bash
npm install @x402-ton/facilitator @x402-ton/common express viem
```

## Running the facilitator server

```bash
FACILITATOR_PRIVATE_KEY=0x... \
FACILITATOR_CONTRACT=0x0af530d6d66947aD930a7d1De60E58c43D40a308 \
FACILITATOR_PORT=4402 \
npm start
```

Or programmatically:

```ts
import { createFacilitatorServer } from "@x402-ton/facilitator";

const app = createFacilitatorServer({
  privateKey: "0x...",
  facilitatorAddress: "0x0af530d6d66947aD930a7d1De60E58c43D40a308",
});

app.listen(4402);
```

## Environment variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `FACILITATOR_PRIVATE_KEY` | yes | -- | Private key for the settlement wallet |
| `FACILITATOR_CONTRACT` | yes | -- | TonPaymentFacilitator contract address |
| `FACILITATOR_PORT` | no | `4402` | HTTP server port |

The private key is used to send `settle()` transactions on-chain. For gasless settlement, it also signs ERC-4337 UserOp paymaster data.

## API endpoints

### POST /verify

Verifies an EIP-712 payment authorization on-chain without executing it.

Request body: `{ paymentPayload, paymentRequirements }`

Response: `{ isValid: boolean, invalidReason?: string, payer?: string }`

### POST /settle

Settles a payment by calling `TonPaymentFacilitator.settle()` on-chain. Moves funds from the payer's deposit to the recipient.

Request body: `{ paymentPayload, paymentRequirements }`

Response: `{ success: boolean, payer?: string, transaction?: string, network: string, errorReason?: string }`

### POST /settle-gasless

Settles via ERC-4337 UserOperation with gas sponsored by DustPaymaster. Same request/response format as `/settle`. Automatically tops up the paymaster's EntryPoint deposit if it falls below 0.1 TON.

### GET /health

Returns `{ status: "ok", address: "0x..." }` with the settlement wallet address.

## Programmatic API

```ts
import { createPublicClient, createWalletClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { thanosSepolia, CONTRACTS } from "@x402-ton/common";
import { verifyPayment, settlePayment, settleGasless } from "@x402-ton/facilitator";

const account = privateKeyToAccount("0x...");
const publicClient = createPublicClient({ chain: thanosSepolia, transport: http() });
const walletClient = createWalletClient({ account, chain: thanosSepolia, transport: http() });

// Verify a payment (read-only, no gas)
const verifyResult = await verifyPayment(publicClient, CONTRACTS.facilitator, {
  paymentPayload,
  paymentRequirements,
});

// Settle a payment (sends transaction)
const settleResult = await settlePayment(
  publicClient, walletClient, CONTRACTS.facilitator,
  { paymentPayload, paymentRequirements }
);

// Settle via ERC-4337 (gas sponsored)
const gaslessResult = await settleGasless(
  publicClient, walletClient, CONTRACTS.facilitator,
  { paymentPayload, paymentRequirements }
);
```

## Exports

| Export | Description |
|--------|-------------|
| `createFacilitatorServer(config)` | Creates an Express app with /verify, /settle, /settle-gasless, /health |
| `verifyPayment(publicClient, address, request)` | Verify payment on-chain (view call) |
| `settlePayment(publicClient, walletClient, address, request)` | Settle payment (transaction) |
| `settleGasless(publicClient, walletClient, address, request)` | Settle via ERC-4337 UserOp |
