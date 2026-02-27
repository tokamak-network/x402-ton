# @x402-ton/mcp

MCP (Model Context Protocol) server that enables AI agents to pay for x402-gated APIs using TON.

## Install

```bash
npm install -g @x402-ton/mcp
```

## Usage with Claude Desktop

Add to `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "x402-ton": {
      "command": "x402-ton-mcp",
      "env": {
        "PRIVATE_KEY": "0xYourPrivateKey"
      }
    }
  }
}
```

## Tools

| Tool | Description |
|------|-------------|
| `pay_for_api` | Fetch a URL, automatically paying if it returns 402 |
| `check_balance` | Show wallet balance and facilitator contract deposit |
| `deposit_ton` | Deposit TON into the facilitator contract |
| `withdraw_ton` | Withdraw TON from the facilitator contract |

## Environment variables

| Variable | Required | Description |
|----------|----------|-------------|
| `PRIVATE_KEY` | Yes | Hex-encoded private key (must start with `0x`) |

## How it works

The MCP server wraps `@x402-ton/client` with `autoDeposit: true`. When an AI agent calls `pay_for_api`, the fetch wrapper handles the full 402 payment flow: detect payment requirement, sign EIP-712 authorization, retry with payment header. Deposits and withdrawals wait for on-chain confirmation before returning.
