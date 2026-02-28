import type { LocalAccount } from "viem";
import type {
  SchemeNetworkClient,
  PaymentRequirements,
  PaymentPayloadResult,
  PaymentPayloadContext,
} from "@x402/core/types";
import { signPayment } from "@x402-ton/client";
import { toInternalRequirement, toPayloadResult } from "./types.js";

export class ExactTonClient implements SchemeNetworkClient {
  readonly scheme = "exact";

  private readonly account: LocalAccount;

  constructor(account: LocalAccount) {
    this.account = account;
  }

  async createPaymentPayload(
    x402Version: number,
    requirements: PaymentRequirements,
    _context?: PaymentPayloadContext,
  ): Promise<PaymentPayloadResult> {
    const internalReq = toInternalRequirement(requirements);
    const internalPayload = await signPayment(this.account, internalReq);

    return {
      x402Version,
      payload: toPayloadResult(internalPayload),
    };
  }
}
