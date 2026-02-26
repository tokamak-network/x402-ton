#!/usr/bin/env node
import { parseEther, formatEther, createPublicClient, createWalletClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { thanosSepolia, CONTRACTS, setFacilitatorAddress } from "@x402-ton/common";
import { createX402TonFetch, deposit, getBalance } from "@x402-ton/client";

const [,, command, ...args] = process.argv;

async function main(): Promise<void> {
  const privateKey = process.env.PRIVATE_KEY as `0x${string}`;
  if (!privateKey) {
    console.error("Set PRIVATE_KEY env var");
    process.exit(1);
  }

  const facilitatorAddr = process.env.FACILITATOR_CONTRACT as `0x${string}`;
  if (facilitatorAddr) setFacilitatorAddress(facilitatorAddr);

  const account = privateKeyToAccount(privateKey);
  const publicClient = createPublicClient({ chain: thanosSepolia, transport: http() });
  const walletClient = createWalletClient({ account, chain: thanosSepolia, transport: http() });

  switch (command) {
    case "balance": {
      const bal = await getBalance(publicClient, account.address, facilitatorAddr);
      console.log(`Facilitator balance: ${formatEther(bal)} TON`);
      const native = await publicClient.getBalance({ address: account.address });
      console.log(`Wallet balance: ${formatEther(native)} TON`);
      break;
    }

    case "deposit": {
      const amount = args[0] ?? "1";
      console.log(`Depositing ${amount} TON...`);
      const hash = await deposit(walletClient, parseEther(amount), facilitatorAddr);
      console.log(`TX: ${hash}`);
      break;
    }

    case "pay": {
      const url = args[0];
      if (!url) { console.error("Usage: x402-ton pay <url>"); process.exit(1); }

      const x402Fetch = createX402TonFetch({
        account, publicClient, walletClient,
        facilitatorAddress: facilitatorAddr,
        autoDeposit: true,
      });

      console.log(`Fetching ${url}...`);
      const res = await x402Fetch(url);
      const paymentResponse = res.headers.get("payment-response");
      if (paymentResponse) {
        const settlement = JSON.parse(Buffer.from(paymentResponse, "base64").toString());
        console.log(`Payment TX: ${settlement.transaction}`);
      }
      console.log(`Status: ${res.status}`);
      console.log(await res.text());
      break;
    }

    default:
      console.log("x402-ton CLI");
      console.log("  x402-ton balance              Check balances");
      console.log("  x402-ton deposit <amount>     Deposit TON");
      console.log("  x402-ton pay <url>            Fetch with x402 payment");
  }
}

main().catch(console.error);
