import { type PublicClient, type WalletClient } from "viem";
import {
  type SettleRequest,
  type SettlementResponse,
  FACILITATOR_ABI,
  CONTRACTS,
  CAIP2_THANOS_SEPOLIA,
} from "@x402-ton/common";

export async function settlePayment(
  publicClient: PublicClient,
  walletClient: WalletClient,
  request: SettleRequest
): Promise<SettlementResponse> {
  const { paymentPayload, paymentRequirements } = request;
  const { authorization, signature } = paymentPayload.payload;
  const network = CAIP2_THANOS_SEPOLIA;

  if (paymentPayload.network !== network) {
    return { success: false, network, errorReason: "Unsupported network" };
  }

  if (authorization.to !== paymentRequirements.payTo) {
    return { success: false, network, errorReason: "Recipient mismatch" };
  }

  const account = walletClient.account;
  if (!account) {
    return { success: false, network, errorReason: "Wallet account not configured" };
  }

  try {
    const hash = await walletClient.writeContract({
      address: CONTRACTS.facilitator,
      abi: FACILITATOR_ABI,
      functionName: "settle",
      args: [
        authorization.from,
        authorization.to,
        BigInt(authorization.amount),
        BigInt(authorization.deadline),
        authorization.nonce,
        signature,
      ],
      account,
      chain: publicClient.chain,
    });

    const receipt = await publicClient.waitForTransactionReceipt({ hash });

    if (receipt.status === "reverted") {
      return {
        success: false,
        network,
        transaction: hash,
        payer: authorization.from,
        errorReason: "Transaction reverted",
      };
    }

    return {
      success: true,
      network,
      transaction: hash,
      payer: authorization.from,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown settlement error";
    return { success: false, network, errorReason: message };
  }
}
