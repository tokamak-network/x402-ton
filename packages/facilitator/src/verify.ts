import { type PublicClient } from "viem";
import { type VerifyRequest, type VerifyResponse, FACILITATOR_ABI } from "@x402-ton/common";

export async function verifyPayment(
  publicClient: PublicClient,
  facilitatorAddress: `0x${string}`,
  request: VerifyRequest
): Promise<VerifyResponse> {
  const { authorization, signature } = request.paymentPayload.payload;
  const requirement = request.paymentRequirements;

  if (BigInt(authorization.amount) < BigInt(requirement.maxAmountRequired)) {
    return { isValid: false, invalidReason: "Amount too low" };
  }

  if (authorization.to.toLowerCase() !== requirement.payTo.toLowerCase()) {
    return { isValid: false, invalidReason: "Wrong recipient" };
  }

  const [valid, reason] = (await publicClient.readContract({
    address: facilitatorAddress,
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
  })) as [boolean, string];

  return {
    isValid: valid,
    invalidReason: valid ? undefined : reason,
    payer: valid ? authorization.from : undefined,
  };
}
