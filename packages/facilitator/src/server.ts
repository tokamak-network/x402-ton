import express from "express";
import { createPublicClient, createWalletClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { thanosSepolia, CAIP2_THANOS_SEPOLIA } from "@x402-ton/common";
import { verifyPayment } from "./verify.js";
import { settlePayment } from "./settle.js";

export interface FacilitatorServerConfig {
  privateKey: `0x${string}`;
  usdcAddress?: `0x${string}`;
  port?: number;
}

export function createFacilitatorServer(config: FacilitatorServerConfig) {
  const account = privateKeyToAccount(config.privateKey);
  const publicClient = createPublicClient({ chain: thanosSepolia, transport: http() });
  const walletClient = createWalletClient({ account, chain: thanosSepolia, transport: http() });

  const app = express();
  // BigInt is not JSON-serializable by default; prevent server crashes if one leaks into a response
  app.set("json replacer", (_key: string, value: unknown) =>
    typeof value === "bigint" ? value.toString() : value,
  );
  app.use(express.json());

  app.get("/health", (_req, res) => {
    res.json({ status: "ok", address: account.address });
  });

  app.get("/supported", (_req, res) => {
    res.json({
      kinds: [
        {
          x402Version: 2,
          scheme: "exact",
          network: CAIP2_THANOS_SEPOLIA,
          extra: { name: "Bridged USDC (Tokamak Network)", version: "2" },
        },
      ],
      extensions: [],
      signers: {
        [CAIP2_THANOS_SEPOLIA]: [account.address],
      },
    });
  });

  app.post("/verify", async (req, res) => {
    try {
      const result = await verifyPayment(publicClient, req.body);
      res.json(result);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Internal error";
      res.status(500).json({ isValid: false, invalidReason: message });
    }
  });

  app.post("/settle", async (req, res) => {
    try {
      const result = await settlePayment(publicClient, walletClient, req.body);
      res.json(result);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Internal error";
      res.status(500).json({ success: false, network: CAIP2_THANOS_SEPOLIA, errorReason: message });
    }
  });

  return app;
}
