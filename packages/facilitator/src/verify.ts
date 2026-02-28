import { type PublicClient, verifyTypedData, getAddress } from "viem";
import {
  type VerifyRequest,
  type VerifyResponse,
  USDC_ABI,
  TRANSFER_WITH_AUTHORIZATION_TYPES,
  getUsdcDomain,
} from "@x402-ton/common";

export async function verifyPayment(
  publicClient: PublicClient,
  request: VerifyRequest,
): Promise<VerifyResponse> {
  const { authorization, signature } = request.paymentPayload.payload;
  const requirement = request.paymentRequirements;

  if (BigInt(authorization.value) < BigInt(requirement.amount)) {
    return { isValid: false, invalidReason: "Authorization amount below required amount" };
  }

  if (getAddress(authorization.to) !== getAddress(requirement.payTo)) {
    return { isValid: false, invalidReason: "Authorization recipient does not match payTo" };
  }

  const now = Math.floor(Date.now() / 1000);

  // 6-second buffer for block propagation delay
  if (BigInt(authorization.validBefore) <= BigInt(now + 6)) {
    return { isValid: false, invalidReason: "Authorization expires too soon" };
  }

  if (BigInt(authorization.validAfter) > BigInt(now)) {
    return { isValid: false, invalidReason: "Authorization not yet valid" };
  }

  const chainId = Number(requirement.network.split(":")[1]);
  const domain = getUsdcDomain(requirement.asset, chainId, requirement.extra);

  const valid = await verifyTypedData({
    address: authorization.from,
    domain,
    types: TRANSFER_WITH_AUTHORIZATION_TYPES,
    primaryType: "TransferWithAuthorization",
    message: {
      from: authorization.from,
      to: authorization.to,
      value: BigInt(authorization.value),
      validAfter: BigInt(authorization.validAfter),
      validBefore: BigInt(authorization.validBefore),
      nonce: authorization.nonce,
    },
    signature,
  });

  if (!valid) {
    return { isValid: false, invalidReason: "Invalid EIP-712 signature" };
  }

  const balance = await publicClient.readContract({
    address: requirement.asset,
    abi: USDC_ABI,
    functionName: "balanceOf",
    args: [authorization.from],
  });

  if (balance < BigInt(requirement.amount)) {
    return { isValid: false, invalidReason: "Insufficient USDC balance" };
  }

  return { isValid: true, payer: authorization.from };
}
