import { type LocalAccount } from "viem";
import {
  type PaymentAuthorization,
  type PaymentPayload,
  type PaymentRequirement,
  PAYMENT_AUTH_TYPES,
  getFacilitatorDomain,
  CONTRACTS,
  thanosSepolia,
} from "@x402-ton/common";

export interface SignerConfig {
  account: LocalAccount;
  facilitatorAddress?: `0x${string}`;
  chainId?: number;
}

export async function signPayment(
  config: SignerConfig,
  requirement: PaymentRequirement
): Promise<PaymentPayload> {
  const facilitatorAddr = config.facilitatorAddress ?? CONTRACTS.facilitator;
  const chainId = config.chainId ?? thanosSepolia.id;

  const nonce = `0x${Array.from(crypto.getRandomValues(new Uint8Array(32)), (b) => b.toString(16).padStart(2, "0")).join("")}` as `0x${string}`;
  const deadline = String(Math.floor(Date.now() / 1000) + requirement.maxTimeoutSeconds);

  const domain = getFacilitatorDomain(facilitatorAddr, chainId);

  const authorization: PaymentAuthorization = {
    from: config.account.address,
    to: requirement.payTo,
    amount: requirement.maxAmountRequired,
    deadline,
    nonce,
  };

  const signature = await config.account.signTypedData({
    domain,
    types: PAYMENT_AUTH_TYPES,
    primaryType: "PaymentAuth",
    message: {
      from: authorization.from,
      to: authorization.to,
      amount: BigInt(authorization.amount),
      deadline: BigInt(authorization.deadline),
      nonce: authorization.nonce,
    },
  });

  return {
    x402Version: 2,
    scheme: "exact-ton",
    network: requirement.network,
    payload: { signature, authorization },
  };
}
