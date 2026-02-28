# @x402-ton/cli

Command-line tool for interacting with x402-ton on Tokamak Network's Thanos L2. Check USDC balances and pay for x402-protected API endpoints.

## Installation

```bash
npm install -g @x402-ton/cli
```

## Environment variables

| Variable | Required | Description |
|----------|----------|-------------|
| `PRIVATE_KEY` | yes | Hex-encoded private key with `0x` prefix |

## Commands

### `balance`

Displays USDC and native TON balances for the configured wallet.

```bash
PRIVATE_KEY=0x... x402-ton balance
```

```
Address: 0x1234...abcd
USDC balance: 10.50 USDC
Native balance: 9.2 TON
```

### `pay <url>`

Fetches a URL with automatic x402 payment handling. If the endpoint returns HTTP 402, the CLI:
1. Decodes the `payment-required` header
2. Signs an EIP-3009 `TransferWithAuthorization`
3. Retries the request with the `payment-signature` header
4. Prints the response

```bash
PRIVATE_KEY=0x... x402-ton pay http://localhost:4403/api/plasma
```

```
Fetching http://localhost:4403/api/plasma...
Payment TX: 0xdef...
Status: 200
{"operator":"thanos-sepolia-sequencer","epoch":42,"throughput":"1800 tx/s"}
```

If the endpoint doesn't require payment, the CLI returns the response directly without signing.

## Examples

```bash
# Check your wallet before paying
PRIVATE_KEY=0x... x402-ton balance

# Pay for plasma state data ($0.10 USDC)
PRIVATE_KEY=0x... x402-ton pay http://localhost:4403/api/plasma

# Pay for fusion telemetry ($0.001 USDC)
PRIVATE_KEY=0x... x402-ton pay http://localhost:4403/api/fusion

# Free endpoint — no payment needed
PRIVATE_KEY=0x... x402-ton pay http://localhost:4403/api/health
```
