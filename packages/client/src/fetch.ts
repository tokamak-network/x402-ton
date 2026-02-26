import {
  type LocalAccount,
  type PublicClient,
  type WalletClient,
} from "viem";
import { type PaymentRequired } from "@x402-ton/common";
import { signPayment, type SignerConfig } from "./signer.js";
import { ensureBalance } from "./deposit.js";

export interface X402TonClientConfig {
  account: LocalAccount;
  publicClient: PublicClient;
  walletClient: WalletClient;
  facilitatorAddress?: `0x${string}`;
  chainId?: number;
  autoDeposit?: boolean;
}

export function createX402TonFetch(config: X402TonClientConfig) {
  const signerConfig: SignerConfig = {
    account: config.account,
    facilitatorAddress: config.facilitatorAddress,
    chainId: config.chainId,
  };

  return async function x402Fetch(
    input: RequestInfo | URL,
    init?: RequestInit
  ): Promise<Response> {
    const response = await fetch(input, init);

    if (response.status !== 402) return response;

    const paymentRequiredHeader = response.headers.get("payment-required");
    if (!paymentRequiredHeader) return response;

    const paymentRequired: PaymentRequired = JSON.parse(
      Buffer.from(paymentRequiredHeader, "base64").toString("utf-8")
    );

    const requirement = paymentRequired.accepts.find(
      (r) => r.scheme === "exact-ton"
    );
    if (!requirement) return response;

    if (config.autoDeposit) {
      await ensureBalance(
        config.publicClient,
        config.walletClient,
        BigInt(requirement.maxAmountRequired),
        config.facilitatorAddress
      );
    }

    const payload = await signPayment(signerConfig, requirement);
    const paymentHeader = Buffer.from(JSON.stringify(payload)).toString("base64");

    return fetch(input, {
      ...init,
      headers: {
        ...init?.headers,
        "payment-signature": paymentHeader,
      },
    });
  };
}
