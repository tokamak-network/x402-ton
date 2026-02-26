# @x402-ton/cli

Command-line tool for interacting with x402-ton: check balances, deposit TON into the facilitator, and pay for x402-protected API endpoints.

## Installation

```bash
npm install -g @x402-ton/cli
```

## Environment variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `PRIVATE_KEY` | yes | -- | Hex-encoded private key (with `0x` prefix) |
| `FACILITATOR_CONTRACT` | no | `0x0af530d6d66947aD930a7d1De60E58c43D40a308` | Override facilitator contract address |

## Commands

### balance

Displays the facilitator deposit balance and native wallet balance.

```bash
PRIVATE_KEY=0x... x402-ton balance
```

Output:
```
Facilitator balance: 1.5 TON
Wallet balance: 9.2 TON
```

### deposit

Deposits TON from the wallet into the facilitator contract.

```bash
PRIVATE_KEY=0x... x402-ton deposit 1.0
```

Output:
```
Depositing 1.0 TON...
TX: 0xabc...
```

### pay

Fetches a URL with automatic x402 payment handling. If the endpoint returns HTTP 402, the CLI signs an EIP-712 authorization, retries with the payment header, and prints the response. Auto-deposits if the facilitator balance is insufficient.

```bash
PRIVATE_KEY=0x... x402-ton pay http://localhost:3000/api/weather
```

Output:
```
Fetching http://localhost:3000/api/weather...
Payment TX: 0xdef...
Status: 200
{"temp":"42C","payer":"0x..."}
```
