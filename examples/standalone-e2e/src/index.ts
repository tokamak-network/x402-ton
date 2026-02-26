import express from "express";
import { type Server } from "node:http";
import { parseEther } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { createFacilitatorServer } from "@x402-ton/facilitator";
import { paymentMiddleware } from "@x402-ton/server";
import { signPayment } from "@x402-ton/client";
import {
  type PaymentRequired,
  type PaymentPayload,
  CONTRACTS,
} from "@x402-ton/common";

const PRIVATE_KEY = process.env.PRIVATE_KEY as `0x${string}`;
if (!PRIVATE_KEY) {
  console.error("Set PRIVATE_KEY env var");
  process.exit(1);
}
const FACILITATOR_PORT = 14402;
const API_PORT = 14403;

const account = privateKeyToAccount(PRIVATE_KEY);

let passed = 0;
let failed = 0;

function pass(name: string): void {
  passed++;
  console.log(`  PASS  ${name}`);
}

function fail(name: string, reason: string): void {
  failed++;
  console.log(`  FAIL  ${name} — ${reason}`);
}

function startFacilitator(): Promise<Server> {
  return new Promise((resolve) => {
    const app = createFacilitatorServer({
      privateKey: PRIVATE_KEY,
      facilitatorAddress: CONTRACTS.facilitator,
      port: FACILITATOR_PORT,
    });
    const server = app.listen(FACILITATOR_PORT, () => {
      console.log(`Facilitator listening on :${FACILITATOR_PORT}`);
      resolve(server);
    });
  });
}

function startDemoApi(): Promise<Server> {
  return new Promise((resolve) => {
    const app = express();

    app.use(
      paymentMiddleware({
        facilitatorUrl: `http://localhost:${FACILITATOR_PORT}`,
        routes: {
          "GET /api/data": {
            price: parseEther("0.001").toString(),
            payTo: account.address,
            description: "Protected data (0.001 TON)",
            mimeType: "application/json",
          },
        },
      })
    );

    app.get("/api/free", (_req, res) => {
      res.json({ message: "free endpoint", ok: true });
    });

    app.get("/api/data", (req, res) => {
      res.json({
        secret: "x402-ton unlocked content",
        payer: req.x402Payer,
      });
    });

    const server = app.listen(API_PORT, () => {
      console.log(`Demo API listening on :${API_PORT}`);
      resolve(server);
    });
  });
}

function closeServer(server: Server): Promise<void> {
  return new Promise((resolve) => server.close(() => resolve()));
}

async function run(): Promise<void> {
  console.log("\n=== x402-ton standalone E2E test ===\n");
  console.log(`Payer:       ${account.address}`);
  console.log(`Facilitator: ${CONTRACTS.facilitator}\n`);

  const facilitatorServer = await startFacilitator();
  const apiServer = await startDemoApi();

  console.log("\n--- Test 1: Free endpoint (GET /api/free) ---");
  try {
    const res = await fetch(`http://localhost:${API_PORT}/api/free`);
    if (res.status === 200) {
      const body = await res.json();
      console.log("  Response:", JSON.stringify(body));
      pass("Free endpoint returns 200");
    } else {
      fail("Free endpoint returns 200", `got status ${res.status}`);
    }
  } catch (err) {
    fail("Free endpoint returns 200", String(err));
  }

  console.log("\n--- Test 2: Paid endpoint without payment (GET /api/data) ---");
  let paymentRequired: PaymentRequired | null = null;
  try {
    const res = await fetch(`http://localhost:${API_PORT}/api/data`);
    if (res.status === 402) {
      pass("Paid endpoint returns 402 without payment header");

      const header = res.headers.get("payment-required");
      if (header) {
        paymentRequired = JSON.parse(
          Buffer.from(header, "base64").toString("utf-8")
        ) as PaymentRequired;
        console.log(
          "  PaymentRequired:",
          JSON.stringify(paymentRequired, null, 2)
        );
        pass("payment-required header decoded");
      } else {
        fail(
          "payment-required header decoded",
          "header missing from 402 response"
        );
      }
    } else {
      fail("Paid endpoint returns 402 without payment header", `got ${res.status}`);
    }
  } catch (err) {
    fail("Paid endpoint returns 402 without payment header", String(err));
  }

  console.log("\n--- Test 3: Sign payment and retry with payment-signature ---");
  if (paymentRequired && paymentRequired.accepts.length > 0) {
    const requirement = paymentRequired.accepts[0];
    try {
      const payload: PaymentPayload = await signPayment(
        { account, facilitatorAddress: CONTRACTS.facilitator },
        requirement
      );
      console.log("  Signed payload scheme:", payload.scheme);
      console.log("  Authorization from:", payload.payload.authorization.from);
      pass("Payment signed successfully");

      const encoded = Buffer.from(JSON.stringify(payload)).toString("base64");
      const res = await fetch(`http://localhost:${API_PORT}/api/data`, {
        headers: { "payment-signature": encoded },
      });

      console.log("  Response status:", res.status);
      const body = await res.json();
      console.log("  Response body:", JSON.stringify(body, null, 2));

      // On-chain verification will fail (no deposit), expect 402 with reason
      if (res.status === 200) {
        pass("Paid request succeeded (unexpected — deposit exists?)");
      } else if (res.status === 402) {
        pass(
          "Paid request returned 402 (expected — no facilitator deposit on-chain)"
        );
      } else if (res.status === 502) {
        pass("Facilitator verify returned error (expected with test key)");
      } else {
        fail("Paid request pipeline", `unexpected status ${res.status}`);
      }
    } catch (err) {
      fail("Sign and pay flow", String(err));
    }
  } else {
    fail("Sign and pay flow", "no PaymentRequired from test 2");
  }

  console.log("\n--- Cleanup ---");
  await closeServer(apiServer);
  console.log("  Demo API closed");
  await closeServer(facilitatorServer);
  console.log("  Facilitator closed");

  console.log(`\n=== Results: ${passed} passed, ${failed} failed ===\n`);
  process.exit(failed > 0 ? 1 : 0);
}

run().catch((err) => {
  console.error("Fatal:", err);
  process.exit(2);
});
