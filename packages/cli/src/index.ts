#!/usr/bin/env node
import { createPublicClient, http, formatUnits, formatEther } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { thanosSepolia, THANOS_USDC, USDC_ABI } from "@x402-ton/common";
import { createX402Fetch } from "@x402-ton/client";

const [,, command, ...args] = process.argv;

async function main(): Promise<void> {
  const rawKey = process.env.PRIVATE_KEY;
  if (!rawKey) {
    console.error("Set PRIVATE_KEY env var");
    process.exit(1);
  }
  if (!rawKey.startsWith("0x")) {
    console.error("PRIVATE_KEY must start with 0x");
    process.exit(1);
  }
  const privateKey = rawKey as `0x${string}`;

  const account = privateKeyToAccount(privateKey);
  const publicClient = createPublicClient({ chain: thanosSepolia, transport: http() });

  switch (command) {
    case "balance": {
      const usdcBalance = await publicClient.readContract({
        address: THANOS_USDC,
        abi: USDC_ABI,
        functionName: "balanceOf",
        args: [account.address],
      });
      console.log(`USDC balance: ${formatUnits(usdcBalance, 6)} USDC`);
      const native = await publicClient.getBalance({ address: account.address });
      console.log(`Native balance: ${formatEther(native)} TON`);
      break;
    }

    case "pay": {
      const url = args[0];
      if (!url) { console.error("Usage: x402-ton pay <url>"); process.exit(1); }

      const x402Fetch = createX402Fetch({ account });

      console.log(`Fetching ${url}...`);
      const res = await x402Fetch(url);
      const paymentResponse = res.headers.get("payment-response");
      if (paymentResponse) {
        const settlement = JSON.parse(Buffer.from(paymentResponse, "base64").toString());
        if (settlement.success) {
          console.log(`Payment TX: ${settlement.transaction}`);
        } else {
          console.error(`Payment failed: ${settlement.errorReason ?? "unknown"}`);
        }
      }
      console.log(`Status: ${res.status}`);
      console.log(await res.text());
      break;
    }

    default:
      console.log("x402-ton CLI");
      console.log("  x402-ton balance              Check USDC and native balances");
      console.log("  x402-ton pay <url>            Fetch with x402 payment");
  }
}

main().catch(console.error);
