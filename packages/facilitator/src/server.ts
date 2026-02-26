import express, { type Request, type Response } from "express";
import {
  createPublicClient,
  createWalletClient,
  http,
  type PublicClient,
  type WalletClient,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import {
  type VerifyRequest,
  type SettleRequest,
  thanosSepolia,
  CONTRACTS,
  setFacilitatorAddress,
} from "@x402-ton/common";
import { verifyPayment } from "./verify.js";
import { settlePayment } from "./settle.js";

export interface FacilitatorConfig {
  port: number;
  facilitatorAddress: `0x${string}`;
  privateKey: `0x${string}`;
  rpcUrl?: string;
}

export function createFacilitatorServer(config: FacilitatorConfig): express.Express {
  setFacilitatorAddress(config.facilitatorAddress);

  const transport = http(config.rpcUrl ?? thanosSepolia.rpcUrls.default.http[0]);

  const publicClient: PublicClient = createPublicClient({
    chain: thanosSepolia,
    transport,
  });

  const account = privateKeyToAccount(config.privateKey);

  const walletClient: WalletClient = createWalletClient({
    chain: thanosSepolia,
    transport,
    account,
  });

  const app = express();
  app.use(express.json());

  app.get("/health", (_req: Request, res: Response) => {
    res.json({
      status: "ok",
      facilitator: CONTRACTS.facilitator,
      account: account.address,
    });
  });

  app.post("/verify", async (req: Request, res: Response) => {
    try {
      const body = req.body as VerifyRequest;
      if (!body.paymentPayload || !body.paymentRequirements) {
        res.status(400).json({ isValid: false, invalidReason: "Missing paymentPayload or paymentRequirements" });
        return;
      }
      const result = await verifyPayment(publicClient, body);
      res.json(result);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Internal error";
      res.status(500).json({ isValid: false, invalidReason: message });
    }
  });

  app.post("/settle", async (req: Request, res: Response) => {
    try {
      const body = req.body as SettleRequest;
      if (!body.paymentPayload || !body.paymentRequirements) {
        res.status(400).json({ success: false, network: "", errorReason: "Missing paymentPayload or paymentRequirements" });
        return;
      }
      const result = await settlePayment(publicClient, walletClient, body);
      res.json(result);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Internal error";
      res.status(500).json({ success: false, network: "", errorReason: message });
    }
  });

  return app;
}
