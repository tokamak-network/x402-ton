# Express server example

Demonstrates a paid API server on Tokamak Network's Thanos L2 using `@x402/express` with the Thanos scheme plugin.

## What's included

- **Self-hosted facilitator** on port 4402 — handles on-chain verification and settlement
- **Express API** on port 4403 with three endpoints:
  - `GET /api/plasma` ($0.10 USDC) — Tokamak plasma channel state
  - `GET /api/fusion` ($0.001 USDC) — Fusion reactor telemetry
  - `GET /api/health` (free) — Health check
- **Custom paywall** — wallet-connect UI for browser-based payments via MetaMask

## Setup

```bash
cp .env.example .env
```

Edit `.env` with:
- `FACILITATOR_PRIVATE_KEY` — private key for the settlement wallet (pays gas for `transferWithAuthorization`)
- `PAY_TO_ADDRESS` — address that receives USDC payments

Both addresses need:
- The facilitator wallet needs TON for gas on Thanos Sepolia
- The payer (client-side) needs USDC on Thanos Sepolia — see `npm run fund-testnet` in the repo root

## Run

```bash
npm start
```

```
Facilitator on :4402
API on :4403
```

## Test

**Browser:** Open `http://localhost:4403/api/plasma` — the paywall UI appears, connect MetaMask, and pay.

**CLI client:**
```bash
cd ../../../examples/clients/fetch
cp .env.example .env  # add payer private key
npm start
```

**curl (free endpoint):**
```bash
curl http://localhost:4403/api/health
```
