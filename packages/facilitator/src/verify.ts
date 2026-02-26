import { type PublicClient } from "viem";
import {
  type VerifyRequest,
  type VerifyResponse,
  FACILITATOR_ABI,
  CONTRACTS,
  CAIP2_THANOS_SEPOLIA,
} from "@x402-ton/common";

export async function verifyPayment(
  client: PublicClient,
  request: VerifyRequest
): Promise<VerifyResponse> {
  const { paymentPayload, paymentRequirements } = request;
  const { authorization, signature } = paymentPayload.payload;

  if (paymentPayload.network !== CAIP2_THANOS_SEPOLIA) {
    return { isValid: false, invalidReason: "Unsupported network" };
  }

  if (authorization.to !== paymentRequirements.payTo) {
    return { isValid: false, invalidReason: "Recipient mismatch" };
  }

  if (BigInt(authorization.amount) < BigInt(paymentRequirements.maxAmountRequired)) {
    return { isValid: false, invalidReason: "Insufficient amount" };
  }

  try {
    const [valid, reason] = await client.readContract({
      address: CONTRACTS.facilitator,
      abi: FACILITATOR_ABI,
      functionName: "verify",
      args: [
        authorization.from,
        authorization.to,
        BigInt(authorization.amount),
        BigInt(authorization.deadline),
        authorization.nonce,
        signature,
      ],
    });

    return valid
      ? { isValid: true, payer: authorization.from }
      : { isValid: false, invalidReason: reason };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown verification error";
    return { isValid: false, invalidReason: message };
  }
}
