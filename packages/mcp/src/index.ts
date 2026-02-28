#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { createPublicClient, http, formatUnits, formatEther } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { thanosSepolia, THANOS_USDC, USDC_ABI } from "@x402-ton/common";
import { createX402Fetch } from "@x402-ton/client";

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
const x402Fetch = createX402Fetch({ account });

const server = new McpServer({
  name: "x402-ton",
  version: "0.1.0",
});

server.registerTool(
  "pay_for_api",
  {
    title: "Pay for API",
    description: "Make an HTTP request to a URL, automatically paying with USDC if the endpoint requires x402 payment. Returns the response body.",
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
    description: "Check the USDC and native TON balances for the configured wallet.",
    inputSchema: {},
  },
  async () => {
    const usdcBalance = await publicClient.readContract({
      address: THANOS_USDC,
      abi: USDC_ABI,
      functionName: "balanceOf",
      args: [account.address],
    });
    const nativeBalance = await publicClient.getBalance({ address: account.address });

    return {
      content: [
        {
          type: "text" as const,
          text: [
            `Address: ${account.address}`,
            `USDC balance: ${formatUnits(usdcBalance, 6)} USDC`,
            `Native balance: ${formatEther(nativeBalance)} TON`,
          ].join("\n"),
        },
      ],
    };
  }
);

const transport = new StdioServerTransport();
await server.connect(transport);
