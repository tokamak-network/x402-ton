import { type LocalAccount, getAddress, toHex } from "viem";
import {
  type PaymentRequirements,
  type PaymentPayload,
  type TransferAuthorization,
  TRANSFER_WITH_AUTHORIZATION_TYPES,
} from "@x402-ton/common";

export async function signPayment(
  account: LocalAccount,
  requirement: PaymentRequirements
): Promise<PaymentPayload> {
  const chainId = Number(requirement.network.split(":")[1]);
  const now = Math.floor(Date.now() / 1000);

  // 10 min clock skew tolerance, matches coinbase/x402
  const validAfter = String(now - 600);
  const validBefore = String(now + requirement.maxTimeoutSeconds);
  const nonce = toHex(crypto.getRandomValues(new Uint8Array(32)));

  const authorization: TransferAuthorization = {
    from: getAddress(account.address),
    to: getAddress(requirement.payTo),
    value: requirement.amount,
    validAfter,
    validBefore,
    nonce,
  };

  const signature = await account.signTypedData({
    domain: {
      name: (requirement.extra?.name as string) ?? "Bridged USDC (Tokamak Network)",
      version: (requirement.extra?.version as string) ?? "2",
      chainId: BigInt(chainId),
      verifyingContract: getAddress(requirement.asset),
    },
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
  });

  return {
    x402Version: 2,
    scheme: "exact",
    network: requirement.network,
    payload: { signature, authorization },
  };
}
