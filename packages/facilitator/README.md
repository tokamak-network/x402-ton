# @x402-ton/facilitator

On-chain USDC payment verification and settlement for the x402-ton protocol on Tokamak Network's Thanos L2. Verifies EIP-3009 `TransferWithAuthorization` signatures and calls the USDC contract to settle payments.

## Installation

```bash
npm install @x402-ton/facilitator @x402-ton/common express viem
```

## Running the facilitator server

```bash
FACILITATOR_PRIVATE_KEY=0x... npm start
```

Or programmatically:

```typescript
import { createFacilitatorServer } from "@x402-ton/facilitator";

const app = createFacilitatorServer({ privateKey: "0x..." });
app.listen(4402, () => console.log("Facilitator on :4402"));
```

## Environment variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `FACILITATOR_PRIVATE_KEY` | yes | — | Private key for the settlement wallet |
| `FACILITATOR_PORT` | no | `4402` | HTTP server port |

The private key is used to submit `transferWithAuthorization` transactions. The facilitator pays gas for settlement — the payer only signs an off-chain authorization.

## API endpoints

### `POST /verify`

Verifies an EIP-3009 payment authorization without touching the chain. Checks:
- EIP-712 signature validity
- Authorization amount >= required amount
- Recipient matches `payTo`
- Not expired (`validBefore` > now + 6s buffer)
- Not premature (`validAfter` <= now)
- Payer has sufficient USDC balance

**Request:**
```json
{
  "x402Version": 2,
  "paymentPayload": { "..." },
  "paymentRequirements": { "..." }
}
```

**Response:**
```json
{ "isValid": true, "payer": "0x..." }
```

Or on failure:
```json
{ "isValid": false, "invalidReason": "Insufficient USDC balance" }
```

### `POST /settle`

Settles a payment by calling `USDC.transferWithAuthorization()` on-chain. Re-verifies before settling. Moves USDC directly from payer to recipient.

**Request:** Same as `/verify`.

**Response:**
```json
{
  "success": true,
  "payer": "0x...",
  "transaction": "0x...",
  "network": "eip155:111551119090"
}
```

### `GET /supported`

Returns supported payment kinds for client/server discovery.

**Response:**
```json
{
  "kinds": [{
    "x402Version": 2,
    "scheme": "exact",
    "network": "eip155:111551119090",
    "extra": { "name": "Bridged USDC (Tokamak Network)", "version": "2" }
  }],
  "extensions": [],
  "signers": { "eip155:111551119090": ["0x..."] }
}
```

### `GET /health`

Returns `{ "status": "ok", "address": "0x..." }` with the settlement wallet address.

## Programmatic API

Use the verification and settlement functions directly without the HTTP server:

```typescript
import { createPublicClient, createWalletClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { thanosSepolia } from "@x402-ton/common";
import { verifyPayment, settlePayment } from "@x402-ton/facilitator";

const account = privateKeyToAccount("0x...");
const publicClient = createPublicClient({ chain: thanosSepolia, transport: http() });
const walletClient = createWalletClient({ account, chain: thanosSepolia, transport: http() });

// Verify (off-chain only — checks signature + balance)
const verification = await verifyPayment(publicClient, {
  x402Version: 2,
  paymentPayload,
  paymentRequirements,
});

if (verification.isValid) {
  // Settle (on-chain — calls transferWithAuthorization)
  const settlement = await settlePayment(publicClient, walletClient, {
    x402Version: 2,
    paymentPayload,
    paymentRequirements,
  });
  console.log("TX:", settlement.transaction);
}
```

## Exports

| Export | Description |
|--------|-------------|
| `createFacilitatorServer(config)` | Creates an Express app with /verify, /settle, /supported, /health |
| `verifyPayment(publicClient, request)` | Verify EIP-3009 signature + USDC balance |
| `settlePayment(publicClient, walletClient, request)` | Settle via USDC `transferWithAuthorization` |

## Security considerations

- The facilitator private key pays gas for settlement transactions. Fund it with TON for gas.
- The facilitator never holds USDC — funds move directly from payer to the `payTo` address.
- Settlement re-verifies before executing to prevent replay or stale authorizations.
- Transaction receipt timeout is derived from `maxTimeoutSeconds` in the payment requirements.
