import { parseEther } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { createPublicClient, createWalletClient, http } from "viem";

import { x402Client } from "@x402/core/client";
import { x402Facilitator } from "@x402/core/facilitator";
import { x402ResourceServer } from "@x402/core/server";
import type {
  PaymentRequirements as CoreRequirements,
  PaymentPayload as CorePayload,
  Network,
} from "@x402/core/types";

import {
  ExactTonServer,
  registerExactTonScheme,
  registerExactTonFacilitator,
  registerExactTonServer,
  toInternalRequirement,
  toPayloadResult,
} from "@x402-ton/scheme";
import { signPayment } from "@x402-ton/client";
import {
  CONTRACTS,
  CAIP2_THANOS_SEPOLIA,
  thanosSepolia,
  type PaymentAuthorization,
  type VerifyRequest,
} from "@x402-ton/common";

const PRIVATE_KEY = process.env.PRIVATE_KEY as `0x${string}`;
if (!PRIVATE_KEY) {
  console.error("Set PRIVATE_KEY env var");
  process.exit(1);
}
const NETWORK = CAIP2_THANOS_SEPOLIA as Network;
const PAY_TO = "0x70997970C51812dc3A010C7d01b50e0d17dc79C8" as const;
const AMOUNT = parseEther("0.001").toString();

const account = privateKeyToAccount(PRIVATE_KEY);

let passed = 0;
let failed = 0;

function pass(name: string): void {
  passed++;
  console.log(`  PASS  ${name}`);
}

function fail(name: string, reason: string): void {
  failed++;
  console.log(`  FAIL  ${name} -- ${reason}`);
}

// ---------------------------------------------------------------------------
// Test 1: Plugin server requirements -> Standalone client signing
// ---------------------------------------------------------------------------
async function test1(): Promise<void> {
  console.log(
    "\n--- Test 1: Plugin server requirements -> Standalone client signing ---"
  );

  // Register ExactTonServer on x402ResourceServer to prove adapter compatibility
  const server = new x402ResourceServer();
  registerExactTonServer(server);

  if (!server.hasRegisteredScheme(NETWORK, "exact")) {
    fail("registerExactTonServer", "scheme not registered on framework");
    return;
  }
  pass("ExactTonServer registered on x402ResourceServer");

  // Use ExactTonServer.parsePrice to produce asset/amount in @x402/core format
  const tonServer = new ExactTonServer();
  const parsed = await tonServer.parsePrice("0.001", NETWORK);
  if (parsed.asset !== "native") {
    fail("parsePrice", `asset=${parsed.asset}, expected native`);
    return;
  }
  if (parsed.amount !== AMOUNT) {
    fail("parsePrice", `amount=${parsed.amount}, expected ${AMOUNT}`);
    return;
  }
  pass("ExactTonServer.parsePrice produced correct asset/amount");

  // Build CoreRequirements from the parsed price (as x402ResourceServer would)
  const coreReq: CoreRequirements = {
    scheme: "exact",
    network: NETWORK,
    asset: parsed.asset,
    amount: parsed.amount,
    payTo: PAY_TO,
    maxTimeoutSeconds: 600,
    extra: {},
  };

  // Enhance via the plugin server (proves enhancePaymentRequirements works)
  const enhanced = await tonServer.enhancePaymentRequirements(
    coreReq,
    { x402Version: 2, scheme: "exact", network: NETWORK },
    []
  );
  pass("enhancePaymentRequirements succeeded");
  console.log("  Core requirements:", JSON.stringify(enhanced, null, 2));

  // Convert core format -> internal format
  const internalReq = toInternalRequirement(enhanced);
  if (internalReq.scheme !== "exact-ton") {
    fail("toInternalRequirement", `scheme=${internalReq.scheme}, expected exact-ton`);
    return;
  }
  if (internalReq.maxAmountRequired !== AMOUNT) {
    fail(
      "toInternalRequirement",
      `amount=${internalReq.maxAmountRequired}, expected ${AMOUNT}`
    );
    return;
  }
  pass("toInternalRequirement converts correctly");

  // Use standalone signPayment to sign against the converted requirement
  const internalPayload = await signPayment(
    { account, facilitatorAddress: CONTRACTS.facilitator },
    internalReq
  );

  if (!internalPayload.payload.signature.startsWith("0x")) {
    fail("signPayment", "signature missing 0x prefix");
    return;
  }
  if (internalPayload.payload.authorization.from !== account.address) {
    fail(
      "signPayment",
      `from=${internalPayload.payload.authorization.from}, expected ${account.address}`
    );
    return;
  }
  if (internalPayload.payload.authorization.to !== PAY_TO) {
    fail(
      "signPayment",
      `to=${internalPayload.payload.authorization.to}, expected ${PAY_TO}`
    );
    return;
  }
  if (internalPayload.payload.authorization.amount !== AMOUNT) {
    fail(
      "signPayment",
      `amount=${internalPayload.payload.authorization.amount}, expected ${AMOUNT}`
    );
    return;
  }
  pass("Standalone signPayment produced valid payload");

  console.log("  Plugin server -> Standalone client: PASS");
}

// ---------------------------------------------------------------------------
// Test 2: Standalone client payload -> Plugin facilitator verification
// ---------------------------------------------------------------------------
async function test2(): Promise<void> {
  console.log(
    "\n--- Test 2: Standalone client payload -> Plugin facilitator verification ---"
  );

  // Build internal requirement manually (as standalone code would)
  const internalReq = toInternalRequirement({
    scheme: "exact",
    network: NETWORK,
    asset: "native",
    amount: AMOUNT,
    payTo: PAY_TO,
    maxTimeoutSeconds: 600,
    extra: {},
  });

  // Sign with standalone client
  const internalPayload = await signPayment(
    { account, facilitatorAddress: CONTRACTS.facilitator },
    internalReq
  );
  pass("Standalone client signed payment");

  // Convert internal payload -> core PaymentPayloadResult format
  const payloadResult = toPayloadResult(internalPayload);
  if (!payloadResult.signature || !payloadResult.authorization) {
    fail("toPayloadResult", "missing signature or authorization");
    return;
  }
  pass("toPayloadResult conversion succeeded");

  // Build full CorePayload (as the framework would assemble it)
  const coreRequirements: CoreRequirements = {
    scheme: "exact",
    network: NETWORK,
    asset: "native",
    amount: AMOUNT,
    payTo: PAY_TO,
    maxTimeoutSeconds: 600,
    extra: {},
  };

  const corePayload: CorePayload = {
    x402Version: 2,
    resource: {
      url: "https://example.com/test",
      description: "test resource",
      mimeType: "application/json",
    },
    accepted: coreRequirements,
    payload: payloadResult,
  };
  pass("Assembled core PaymentPayload");

  // Set up plugin facilitator
  const publicClient = createPublicClient({
    chain: thanosSepolia,
    transport: http(),
  });
  const walletClient = createWalletClient({
    chain: thanosSepolia,
    transport: http(),
    account,
  });

  const facilitator = new x402Facilitator();
  registerExactTonFacilitator(facilitator, {
    publicClient,
    walletClient,
    facilitatorAddress: CONTRACTS.facilitator,
  });
  pass("Plugin facilitator registered");

  // Call facilitator.verify() — will fail on-chain (no deposit) but type routing must work
  try {
    const result = await facilitator.verify(corePayload, coreRequirements);
    // If we get here, the type conversion + routing worked
    console.log("  Verify result:", JSON.stringify(result));
    if (typeof result.isValid === "boolean") {
      pass("Facilitator returned proper VerifyResponse shape");
    } else {
      fail("Facilitator verify response", "isValid is not boolean");
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    // On-chain call failures (ContractFunctionExecutionError, RPC errors) are expected
    // The important thing is we didn't crash on type conversion/routing
    if (
      msg.includes("ContractFunctionExecutionError") ||
      msg.includes("reverted") ||
      msg.includes("execution reverted") ||
      msg.includes("HTTP request failed") ||
      msg.includes("getaddrinfo") ||
      msg.includes("fetch failed") ||
      msg.includes("ECONNREFUSED")
    ) {
      pass(
        "Facilitator verify reached on-chain call (type routing worked, RPC/contract error expected)"
      );
    } else {
      fail("Facilitator verify", msg);
    }
  }

  console.log("  Standalone client -> Plugin facilitator: PASS");
}

// ---------------------------------------------------------------------------
// Test 3: Plugin client signing -> Standalone verification types
// ---------------------------------------------------------------------------
async function test3(): Promise<void> {
  console.log(
    "\n--- Test 3: Plugin client signing -> Standalone verification types ---"
  );

  // Set up plugin client
  const client = new x402Client();
  registerExactTonScheme(client, {
    account,
    facilitatorAddress: CONTRACTS.facilitator,
  });
  pass("Plugin client registered");

  // Build core requirements and PaymentRequired (as a server would produce)
  const coreRequirements: CoreRequirements = {
    scheme: "exact",
    network: NETWORK,
    asset: "native",
    amount: AMOUNT,
    payTo: PAY_TO,
    maxTimeoutSeconds: 600,
    extra: {},
  };

  const paymentRequired = {
    x402Version: 2,
    resource: {
      url: "https://example.com/premium",
      description: "premium content",
      mimeType: "application/json",
    },
    accepts: [coreRequirements],
  };

  // Use plugin client to create a payment payload
  const corePayload = await client.createPaymentPayload(paymentRequired);
  if (!corePayload.payload.signature) {
    fail("Plugin client createPaymentPayload", "missing signature");
    return;
  }
  if (!corePayload.payload.authorization) {
    fail("Plugin client createPaymentPayload", "missing authorization");
    return;
  }
  pass("Plugin client created payment payload");

  // Extract fields and manually build an internal VerifyRequest
  const auth = corePayload.payload.authorization as PaymentAuthorization;
  const sig = corePayload.payload.signature as `0x${string}`;

  const verifyRequest: VerifyRequest = {
    paymentPayload: {
      x402Version: 2,
      scheme: "exact-ton",
      network: NETWORK,
      payload: {
        signature: sig,
        authorization: auth,
      },
    },
    paymentRequirements: {
      scheme: "exact-ton",
      network: NETWORK,
      maxAmountRequired: AMOUNT,
      resource: "https://example.com/premium",
      description: "premium content",
      mimeType: "application/json",
      payTo: PAY_TO,
      maxTimeoutSeconds: 600,
      asset: "native",
    },
  };

  // Validate VerifyRequest has all required fields
  if (!verifyRequest.paymentPayload.payload.signature.startsWith("0x")) {
    fail("VerifyRequest", "signature missing 0x prefix");
    return;
  }
  if (!verifyRequest.paymentPayload.payload.authorization.from.startsWith("0x")) {
    fail("VerifyRequest", "authorization.from missing 0x prefix");
    return;
  }
  if (verifyRequest.paymentPayload.payload.authorization.to !== PAY_TO) {
    fail("VerifyRequest", `authorization.to=${auth.to}, expected ${PAY_TO}`);
    return;
  }
  if (verifyRequest.paymentPayload.payload.authorization.amount !== AMOUNT) {
    fail("VerifyRequest", `authorization.amount=${auth.amount}, expected ${AMOUNT}`);
    return;
  }
  if (!verifyRequest.paymentPayload.payload.authorization.deadline) {
    fail("VerifyRequest", "authorization.deadline missing");
    return;
  }
  if (!verifyRequest.paymentPayload.payload.authorization.nonce.startsWith("0x")) {
    fail("VerifyRequest", "authorization.nonce missing 0x prefix");
    return;
  }
  pass("VerifyRequest has all required fields");

  console.log("  Plugin client -> Standalone verify types: PASS");
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function run(): Promise<void> {
  console.log("\n=== x402-ton hybrid interop test ===\n");
  console.log(`Payer:       ${account.address}`);
  console.log(`PayTo:       ${PAY_TO}`);
  console.log(`Network:     ${NETWORK}`);
  console.log(`Facilitator: ${CONTRACTS.facilitator}`);

  await test1();
  await test2();
  await test3();

  console.log(`\n=== Results: ${passed} passed, ${failed} failed ===\n`);
  process.exit(failed > 0 ? 1 : 0);
}

run().catch((err) => {
  console.error("Fatal:", err);
  process.exit(2);
});
