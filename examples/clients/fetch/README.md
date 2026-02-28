# Fetch client example

Demonstrates paying for x402-protected API endpoints using `@x402/fetch` with the Thanos scheme plugin.

## What it does

1. Hits the free `/api/health` endpoint (no payment)
2. Pays $0.10 USDC for `/api/plasma` (plasma channel state)
3. Pays $0.001 USDC for `/api/fusion` (fusion reactor telemetry)

Payment is automatic — `wrapFetchWithPayment` detects 402 responses, signs an EIP-3009 authorization, and retries.

## Setup

```bash
cp .env.example .env
```

Edit `.env` with:
- `PRIVATE_KEY` — private key for the payer wallet (needs USDC on Thanos Sepolia)
- `API_URL` — server URL (defaults to `http://localhost:4403`)

The payer wallet needs USDC on Thanos Sepolia. See `npm run fund-testnet` in the repo root.

## Run

Make sure the server example is running first:

```bash
# In another terminal
cd ../../../examples/servers/express
npm start
```

Then:

```bash
npm start
```

```
Payer: 0x1234...

--- Health check (free) ---
Status: 200
{ status: 'operational', chain: 'thanos-sepolia', timestamp: 1709123456 }

--- Plasma state ($0.10 USDC) ---
Status: 200
{ operator: 'thanos-sepolia-sequencer', epoch: 42, throughput: '1800 tx/s', ... }

--- Fusion telemetry ($0.001 USDC) ---
Status: 200
{ reactor: 'Tokamak-7', plasmaTempMK: '142.3 MK', status: 'ignition', ... }
```
