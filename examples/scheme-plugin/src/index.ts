import { createPublicClient, createWalletClient, http, parseEther } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { x402Client } from "@x402/core/client";
import { x402Facilitator } from "@x402/core/facilitator";
import { x402ResourceServer } from "@x402/core/server";
import type { FacilitatorClient, PaymentPayload, PaymentRequirements, VerifyResponse, SettleResponse, SupportedResponse } from "@x402/core/types";
import {
  registerExactTonScheme,
  registerExactTonFacilitator,
  registerExactTonServer,
} from "@x402-ton/scheme";
import { thanosSepolia, CAIP2_THANOS_SEPOLIA } from "@x402-ton/common";
import type { Network } from "@x402/core/types";

const TEST_PRIVATE_KEY = process.env.PRIVATE_KEY as `0x${string}`;
if (!TEST_PRIVATE_KEY) {
  console.error("Set PRIVATE_KEY env var");
  process.exit(1);
}

function step(n: number, title: string): void {
  console.log(`\n${"=".repeat(60)}`);
  console.log(`  Step ${n}: ${title}`);
  console.log("=".repeat(60));
}

async function main(): Promise<void> {
  console.log("x402 TON Scheme Plugin Demo");
  console.log("Demonstrates @x402-ton/scheme integration with @x402/core\n");

  const account = privateKeyToAccount(TEST_PRIVATE_KEY);
  console.log(`Test account: ${account.address}`);

  const publicClient = createPublicClient({
    chain: thanosSepolia,
    transport: http(),
  });

  const walletClient = createWalletClient({
    account,
    chain: thanosSepolia,
    transport: http(),
  });

  // ── Step 1: Facilitator ───────────────────────────────────────────────
  // Created first because the server needs it to discover supported kinds
  step(1, "Facilitator Setup");

  const facilitator = new x402Facilitator();
  registerExactTonFacilitator(facilitator, { publicClient, walletClient });

  const supported = facilitator.getSupported();
  console.log("Registered kinds:", JSON.stringify(supported.kinds, null, 2));

  // Wrap x402Facilitator as a FacilitatorClient so the server can query
  // supported kinds locally instead of over HTTP.
  const localFacilitatorClient: FacilitatorClient = {
    verify: (payload: PaymentPayload, requirements: PaymentRequirements): Promise<VerifyResponse> =>
      facilitator.verify(payload, requirements),
    settle: (payload: PaymentPayload, requirements: PaymentRequirements): Promise<SettleResponse> =>
      facilitator.settle(payload, requirements),
    getSupported: (): Promise<SupportedResponse> =>
      Promise.resolve(facilitator.getSupported()),
  };

  // ── Step 2: Server ────────────────────────────────────────────────────
  step(2, "Server Setup — Build Payment Requirements");

  const server = new x402ResourceServer(localFacilitatorClient);
  registerExactTonServer(server);
  await server.initialize();

  const network = CAIP2_THANOS_SEPOLIA as Network;

  const requirements = await server.buildPaymentRequirements({
    scheme: "exact",
    payTo: account.address,
    price: "0.001",
    network,
    maxTimeoutSeconds: 300,
  });

  console.log("Payment requirements:", JSON.stringify(requirements, null, 2));

  const paymentRequired = await server.createPaymentRequiredResponse(
    requirements,
    { url: "/api/weather", description: "Weather data (0.001 TON)", mimeType: "application/json" },
  );

  console.log("PaymentRequired response:", JSON.stringify(paymentRequired, null, 2));

  // ── Step 3: Client ────────────────────────────────────────────────────
  step(3, "Client Setup — Sign Payment");

  const client = new x402Client();
  registerExactTonScheme(client, { account });

  const paymentPayload = await client.createPaymentPayload(paymentRequired);
  console.log("Signed payment payload:", JSON.stringify(paymentPayload, null, 2));

  // ── Step 4: Verify ────────────────────────────────────────────────────
  step(4, "Facilitator Verify");

  const verifyResult = await facilitator.verify(paymentPayload, requirements[0]);
  console.log("Verify result:", JSON.stringify(verifyResult, null, 2));

  // ── Step 5: Settle (expected to fail — no on-chain deposit) ───────────
  step(5, "Facilitator Settle (expect failure)");

  try {
    const settleResult = await facilitator.settle(paymentPayload, requirements[0]);
    console.log("Settle result:", JSON.stringify(settleResult, null, 2));
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.log("Settle failed (expected — test account has no deposit):");
    console.log(`  Error: ${message}`);
  }

  // ── Summary ───────────────────────────────────────────────────────────
  console.log(`\n${"=".repeat(60)}`);
  console.log("  Demo Complete");
  console.log("=".repeat(60));
  console.log(`
Plugin flow:
  1. registerExactTonServer()      -> taught the server how to price TON resources
  2. registerExactTonScheme()       -> taught the client how to sign TON payments
  3. registerExactTonFacilitator()  -> taught the facilitator how to verify/settle TON
  4. All three components used the same @x402/core framework classes
`);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
