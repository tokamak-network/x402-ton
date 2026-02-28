import {
  type PublicClient,
  type WalletClient,
  type Account,
  type Transport,
  type Chain,
  parseSignature,
} from "viem";
import {
  type SettleRequest,
  type SettlementResponse,
  USDC_ABI,
} from "@x402-ton/common";
import { verifyPayment } from "./verify.js";

export async function settlePayment(
  publicClient: PublicClient,
  walletClient: WalletClient<Transport, Chain, Account>,
  request: SettleRequest,
): Promise<SettlementResponse> {
  const network = request.paymentRequirements.network;

  const verification = await verifyPayment(publicClient, request);
  if (!verification.isValid) {
    return {
      success: false,
      network,
      errorReason: verification.invalidReason ?? "Verification failed",
    };
  }

  const { authorization, signature } = request.paymentPayload.payload;
  const { r, s, v } = parseSignature(signature);

  try {
    const hash = await walletClient.writeContract({
      address: request.paymentRequirements.asset,
      abi: USDC_ABI,
      functionName: "transferWithAuthorization",
      args: [
        authorization.from,
        authorization.to,
        BigInt(authorization.value),
        BigInt(authorization.validAfter),
        BigInt(authorization.validBefore),
        authorization.nonce,
        Number(v),
        r,
        s,
      ],
    });

    const timeoutMs = (request.paymentRequirements.maxTimeoutSeconds ?? 60) * 1_000;
    const receipt = await publicClient.waitForTransactionReceipt({
      hash,
      timeout: timeoutMs,
    });

    if (receipt.status === "reverted") {
      return { success: false, network, errorReason: "Transaction reverted" };
    }

    return {
      success: true,
      payer: authorization.from,
      transaction: hash,
      network,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Settlement failed";
    return { success: false, network, errorReason: message };
  }
}
