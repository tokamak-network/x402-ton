import express from "express";
import { createPublicClient, createWalletClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { thanosSepolia } from "@x402-ton/common";
import { verifyPayment } from "./verify.js";
import { settlePayment } from "./settle.js";

export interface FacilitatorServerConfig {
  privateKey: `0x${string}`;
  facilitatorAddress: `0x${string}`;
  port?: number;
}

export function createFacilitatorServer(config: FacilitatorServerConfig) {
  const account = privateKeyToAccount(config.privateKey);
  const publicClient = createPublicClient({ chain: thanosSepolia, transport: http() });
  const walletClient = createWalletClient({ account, chain: thanosSepolia, transport: http() });

  const app = express();
  app.use(express.json());

  app.get("/health", (_req, res) => {
    res.json({ status: "ok", address: account.address });
  });

  app.post("/verify", async (req, res) => {
    try {
      const result = await verifyPayment(publicClient, config.facilitatorAddress, req.body);
      res.json(result);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Internal error";
      res.status(500).json({ isValid: false, invalidReason: message });
    }
  });

  app.post("/settle", async (req, res) => {
    try {
      const result = await settlePayment(publicClient, walletClient, config.facilitatorAddress, req.body);
      res.json(result);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Internal error";
      res.status(500).json({ success: false, network: "eip155:111551119090", errorReason: message });
    }
  });

  return app;
}
