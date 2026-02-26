import type { LocalAccount } from "viem";
import type {
  SchemeNetworkClient,
  PaymentRequirements,
  PaymentPayloadResult,
  PaymentPayloadContext,
} from "@x402/core/types";
import { signPayment, type SignerConfig } from "@x402-ton/client";
import { toInternalRequirement, toPayloadResult } from "./types.js";

export class ExactTonClient implements SchemeNetworkClient {
  readonly scheme = "exact";

  private readonly signerConfig: SignerConfig;

  constructor(account: LocalAccount, facilitatorAddress?: `0x${string}`) {
    this.signerConfig = { account, facilitatorAddress };
  }

  async createPaymentPayload(
    x402Version: number,
    requirements: PaymentRequirements,
    _context?: PaymentPayloadContext,
  ): Promise<PaymentPayloadResult> {
    const internalReq = toInternalRequirement(requirements);
    const internalPayload = await signPayment(this.signerConfig, internalReq);

    return {
      x402Version,
      payload: toPayloadResult(internalPayload),
    };
  }
}
