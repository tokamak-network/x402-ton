# @x402-ton/mcp

MCP (Model Context Protocol) server that lets AI agents pay for x402-protected API endpoints autonomously using USDC on Tokamak Network's Thanos L2.

## Installation

```bash
npm install @x402-ton/mcp
```

## Setup

Add to your MCP client configuration (Claude Desktop, Cursor, etc.):

```json
{
  "mcpServers": {
    "x402-ton": {
      "command": "npx",
      "args": ["@x402-ton/mcp"],
      "env": {
        "PRIVATE_KEY": "0x..."
      }
    }
  }
}
```

## Environment variables

| Variable | Required | Description |
|----------|----------|-------------|
| `PRIVATE_KEY` | yes | Hex-encoded private key with `0x` prefix |

## Tools

### `pay_for_api`

Make an HTTP request to a URL, automatically paying with USDC if the endpoint returns HTTP 402.

**Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `url` | `string` | required | The URL to fetch |
| `method` | `string` | `"GET"` | HTTP method (GET, POST, PUT, DELETE) |
| `body` | `string` | — | Request body for POST/PUT |
| `headers` | `object` | — | Additional request headers |

**Example prompt:** "Fetch the plasma data from http://localhost:4403/api/plasma"

**What happens:**
1. Makes the initial HTTP request
2. If 402 is returned, decodes payment requirements from the `payment-required` header
3. Signs an EIP-3009 `TransferWithAuthorization` with the configured wallet
4. Retries the request with the `payment-signature` header
5. Returns the response body and settlement transaction hash

### `check_balance`

Check the USDC and native TON balances for the configured wallet.

**Parameters:** None.

**Example prompt:** "What's my USDC balance?"

**Response:**
```
Address: 0x1234...abcd
USDC balance: 10.50 USDC
Native balance: 9.2 TON
```

## How it works

The MCP server uses `@x402-ton/client`'s `createX402Fetch` to wrap native `fetch` with automatic x402 payment handling. When an AI agent calls `pay_for_api`, the server:

1. Fetches the URL using the x402-aware fetch wrapper
2. If the endpoint requires payment, the wrapper automatically signs and submits the payment
3. Returns the response along with any payment settlement details

The agent never needs to understand the x402 protocol — it just calls `pay_for_api` with a URL.

## Example conversation

```
User: Get me the latest plasma state from the Tokamak API

Agent: I'll fetch that for you.
[Calls pay_for_api with url: "http://localhost:4403/api/plasma"]

Agent: Here's the plasma state data. Payment of $0.10 USDC was settled
       in transaction 0xabc...

       Operator: thanos-sepolia-sequencer
       Epoch: 42
       Throughput: 1800 tx/s
```
