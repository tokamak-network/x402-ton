import type {
  PublicClient,
  WalletClient,
  Account,
  Transport,
  Chain,
} from "viem";
import type {
  SchemeNetworkFacilitator,
  FacilitatorContext,
  PaymentPayload as CorePayload,
  PaymentRequirements as CoreRequirements,
  VerifyResponse as CoreVerifyResponse,
  SettleResponse as CoreSettleResponse,
  Network,
} from "@x402/core/types";
import { CONTRACTS, CAIP2_THANOS_SEPOLIA } from "@x402-ton/common";
import { verifyPayment, settlePayment } from "@x402-ton/facilitator";
import { toInternalVerifyRequest, toInternalSettleRequest } from "./types.js";

export interface ExactTonFacilitatorConfig {
  publicClient: PublicClient;
  walletClient: WalletClient<Transport, Chain, Account>;
  facilitatorAddress?: `0x${string}`;
}

export class ExactTonFacilitator implements SchemeNetworkFacilitator {
  readonly scheme = "exact";
  readonly caipFamily = "eip155:*";

  private readonly publicClient: PublicClient;
  private readonly walletClient: WalletClient<Transport, Chain, Account>;
  private readonly facilitatorAddress: `0x${string}`;

  constructor(config: ExactTonFacilitatorConfig) {
    this.publicClient = config.publicClient;
    this.walletClient = config.walletClient;
    this.facilitatorAddress = config.facilitatorAddress ?? CONTRACTS.facilitator;
  }

  getExtra(_network: Network): Record<string, unknown> | undefined {
    return { facilitatorAddress: this.facilitatorAddress };
  }

  getSigners(_network: string): string[] {
    return [this.walletClient.account.address];
  }

  async verify(
    payload: CorePayload,
    requirements: CoreRequirements,
    _context?: FacilitatorContext,
  ): Promise<CoreVerifyResponse> {
    const request = toInternalVerifyRequest(payload, requirements);
    const result = await verifyPayment(
      this.publicClient,
      this.facilitatorAddress,
      request,
    );
    return {
      isValid: result.isValid,
      invalidReason: result.invalidReason,
      payer: result.payer,
    };
  }

  async settle(
    payload: CorePayload,
    requirements: CoreRequirements,
    _context?: FacilitatorContext,
  ): Promise<CoreSettleResponse> {
    const request = toInternalSettleRequest(payload, requirements);
    const result = await settlePayment(
      this.publicClient,
      this.walletClient,
      this.facilitatorAddress,
      request,
    );
    return {
      success: result.success,
      payer: result.payer,
      // "0x" sentinel: settlement failed or returned no tx hash
      transaction: result.transaction ?? "0x",
      network: (result.network ?? CAIP2_THANOS_SEPOLIA) as Network,
      errorReason: result.errorReason,
    };
  }
}
