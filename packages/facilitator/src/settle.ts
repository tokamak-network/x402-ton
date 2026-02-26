import { type PublicClient, type WalletClient, type Account, type Transport, type Chain } from "viem";
import { type SettleRequest, type SettlementResponse, FACILITATOR_ABI, CAIP2_THANOS_SEPOLIA } from "@x402-ton/common";

export async function settlePayment(
  publicClient: PublicClient,
  walletClient: WalletClient<Transport, Chain, Account>,
  facilitatorAddress: `0x${string}`,
  request: SettleRequest
): Promise<SettlementResponse> {
  const { authorization, signature } = request.paymentPayload.payload;

  try {
    const hash = await walletClient.writeContract({
      address: facilitatorAddress,
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
    });

    const receipt = await publicClient.waitForTransactionReceipt({ hash });

    if (receipt.status === "reverted") {
      return { success: false, network: CAIP2_THANOS_SEPOLIA, errorReason: "Transaction reverted" };
    }

    return {
      success: true,
      payer: authorization.from,
      transaction: hash,
      network: CAIP2_THANOS_SEPOLIA,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Settlement failed";
    return { success: false, network: CAIP2_THANOS_SEPOLIA, errorReason: message };
  }
}
