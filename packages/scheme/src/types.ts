import type {
  PaymentRequirements as CoreRequirements,
  PaymentPayload as CorePayload,
} from "@x402/core/types";
import type {
  PaymentRequirement,
  PaymentPayload,
  PaymentAuthorization,
  VerifyRequest,
  SettleRequest,
} from "@x402-ton/common";
import { getAddress } from "viem";

/**
 * @x402/core uses scheme:"exact", amount, and extra bag.
 * Internal uses scheme:"exact-ton", maxAmountRequired, and inline resource/description/mimeType.
 */
export function toInternalRequirement(coreReq: CoreRequirements): PaymentRequirement {
  let payTo: `0x${string}`;
  try {
    payTo = getAddress(coreReq.payTo) as `0x${string}`;
  } catch {
    throw new Error(`Invalid payTo address: ${coreReq.payTo}`);
  }

  return {
    scheme: "exact-ton",
    network: coreReq.network,
    maxAmountRequired: coreReq.amount,
    resource: typeof coreReq.extra?.resource === "string" ? coreReq.extra.resource : "",
    description: typeof coreReq.extra?.description === "string" ? coreReq.extra.description : "",
    mimeType: typeof coreReq.extra?.mimeType === "string" ? coreReq.extra.mimeType : "application/json",
    payTo,
    maxTimeoutSeconds: coreReq.maxTimeoutSeconds,
    asset: "native",
    extra: coreReq.extra,
  };
}

function toInternalPayload(corePayload: CorePayload): PaymentPayload {
  const payload = corePayload.payload;

  if (!payload.signature || typeof payload.signature !== "string") {
    throw new Error("Missing or invalid payload.signature");
  }
  if (!payload.authorization || typeof payload.authorization !== "object") {
    throw new Error("Missing or invalid payload.authorization");
  }

  const authorization = payload.authorization as PaymentAuthorization;
  const signature = payload.signature as `0x${string}`;

  return {
    x402Version: corePayload.x402Version as 2,
    scheme: "exact-ton",
    network: corePayload.accepted.network,
    payload: { signature, authorization },
  };
}

export function toInternalVerifyRequest(
  corePayload: CorePayload,
  coreReq: CoreRequirements,
): VerifyRequest {
  return {
    paymentPayload: toInternalPayload(corePayload),
    paymentRequirements: toInternalRequirement(coreReq),
  };
}

export function toInternalSettleRequest(
  corePayload: CorePayload,
  coreReq: CoreRequirements,
): SettleRequest {
  return {
    paymentPayload: toInternalPayload(corePayload),
    paymentRequirements: toInternalRequirement(coreReq),
  };
}

/**
 * Extracts typed internal PaymentPayload fields into the @x402/core
 * Record<string,unknown> shape for PaymentPayloadResult.payload.
 */
export function toPayloadResult(
  internal: PaymentPayload,
): Record<string, unknown> {
  return {
    signature: internal.payload.signature,
    authorization: internal.payload.authorization,
  };
}
