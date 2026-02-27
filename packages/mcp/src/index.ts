#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { parseEther, formatEther, createPublicClient, createWalletClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { thanosSepolia, CONTRACTS } from "@x402-ton/common";
import { createX402TonFetch, deposit, getBalance, withdraw } from "@x402-ton/client";

const rawKey = process.env.PRIVATE_KEY;
if (!rawKey) {
  console.error("x402-ton-mcp: Set PRIVATE_KEY env var");
  process.exit(1);
}
if (!rawKey.startsWith("0x")) {
  console.error("x402-ton-mcp: PRIVATE_KEY must start with 0x");
  process.exit(1);
}
const privateKey = rawKey as `0x${string}`;

const account = privateKeyToAccount(privateKey);
const publicClient = createPublicClient({ chain: thanosSepolia, transport: http() });
const walletClient = createWalletClient({ account, chain: thanosSepolia, transport: http() });

const x402Fetch = createX402TonFetch({
  account,
  publicClient,
  walletClient,
  facilitatorAddress: CONTRACTS.facilitator,
  autoDeposit: true,
});

const server = new McpServer({
  name: "x402-ton",
  version: "0.1.0",
});

server.registerTool(
  "pay_for_api",
  {
    title: "Pay for API",
    description: "Make an HTTP request to a URL, automatically paying with TON if the endpoint requires x402 payment. Returns the response body.",
    inputSchema: {
      url: z.string().url().describe("The URL to fetch"),
      method: z.enum(["GET", "POST", "PUT", "DELETE"]).default("GET").describe("HTTP method"),
      body: z.string().optional().describe("Request body for POST/PUT"),
      headers: z.record(z.string()).optional().describe("Additional headers"),
    },
  },
  async ({ url, method, body, headers }) => {
    try {
      const res = await x402Fetch(url, {
        method,
        body: body ?? undefined,
        headers: {
          ...(headers ?? {}),
          ...(body ? { "Content-Type": "application/json" } : {}),
        },
      });

      const responseBody = await res.text();
      const paymentHeader = res.headers.get("payment-response");
      let paymentInfo = "";
      if (paymentHeader) {
        const settlement = JSON.parse(Buffer.from(paymentHeader, "base64").toString());
        paymentInfo = `\n\nPayment settled: TX ${settlement.transaction}`;
      }

      return {
        content: [
          {
            type: "text" as const,
            text: `Status: ${res.status}\n\n${responseBody}${paymentInfo}`,
          },
        ],
      };
    } catch (err) {
      return {
        content: [
          {
            type: "text" as const,
            text: `Request failed: ${err instanceof Error ? err.message : String(err)}`,
          },
        ],
        isError: true,
      };
    }
  }
);

server.registerTool(
  "check_balance",
  {
    title: "Check Balance",
    description: "Check the TON balance in the wallet and the facilitator contract deposit.",
    inputSchema: {},
  },
  async () => {
    try {
      const walletBalance = await publicClient.getBalance({ address: account.address });
      const facilitatorBalance = await getBalance(publicClient, account.address);

      return {
        content: [
          {
            type: "text" as const,
            text: [
              `Address: ${account.address}`,
              `Wallet balance: ${formatEther(walletBalance)} TON`,
              `Facilitator deposit: ${formatEther(facilitatorBalance)} TON`,
              `Facilitator contract: ${CONTRACTS.facilitator}`,
            ].join("\n"),
          },
        ],
      };
    } catch (err) {
      return {
        content: [
          {
            type: "text" as const,
            text: `Balance check failed: ${err instanceof Error ? err.message : String(err)}`,
          },
        ],
        isError: true,
      };
    }
  }
);

server.registerTool(
  "deposit_ton",
  {
    title: "Deposit TON",
    description: "Deposit TON into the x402 facilitator contract. This funds your account for making API payments.",
    inputSchema: {
      amount: z.string().describe("Amount of TON to deposit (e.g. '0.1', '1.5')"),
    },
  },
  async ({ amount }) => {
    try {
      const weiAmount = parseEther(amount);
      const hash = await deposit(walletClient, weiAmount);

      return {
        content: [
          {
            type: "text" as const,
            text: `Deposited ${amount} TON into facilitator.\nTX: ${hash}`,
          },
        ],
      };
    } catch (err) {
      return {
        content: [
          {
            type: "text" as const,
            text: `Deposit failed: ${err instanceof Error ? err.message : String(err)}`,
          },
        ],
        isError: true,
      };
    }
  }
);

server.registerTool(
  "withdraw_ton",
  {
    title: "Withdraw TON",
    description: "Withdraw TON from the x402 facilitator contract back to your wallet.",
    inputSchema: {
      amount: z.string().describe("Amount of TON to withdraw (e.g. '0.1', '1.5')"),
    },
  },
  async ({ amount }) => {
    try {
      const weiAmount = parseEther(amount);
      const hash = await withdraw(walletClient, weiAmount);

      return {
        content: [
          {
            type: "text" as const,
            text: `Withdrew ${amount} TON from facilitator.\nTX: ${hash}`,
          },
        ],
      };
    } catch (err) {
      return {
        content: [
          {
            type: "text" as const,
            text: `Withdraw failed: ${err instanceof Error ? err.message : String(err)}`,
          },
        ],
        isError: true,
      };
    }
  }
);

const transport = new StdioServerTransport();
await server.connect(transport);
