import type {
  PaymentRequirements as CoreRequirements,
  PaymentPayload as CorePayload,
} from "@x402/core/types";
import type {
  PaymentRequirements,
  PaymentPayload,
  TransferAuthorization,
  VerifyRequest,
  SettleRequest,
} from "@x402-ton/common";

export function toInternalRequirement(coreReq: CoreRequirements): PaymentRequirements {
  const payTo = coreReq.payTo;
  if (!payTo.startsWith("0x")) {
    throw new Error(`Invalid payTo address: ${payTo}`);
  }

  return {
    scheme: "exact",
    network: coreReq.network,
    amount: coreReq.amount,
    payTo: payTo as `0x${string}`,
    asset: coreReq.asset as `0x${string}`,
    maxTimeoutSeconds: coreReq.maxTimeoutSeconds,
    extra: coreReq.extra ?? {},
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

  const authorization = payload.authorization as TransferAuthorization;
  const signature = payload.signature as `0x${string}`;

  return {
    x402Version: corePayload.x402Version,
    scheme: "exact",
    network: corePayload.accepted.network,
    payload: { signature, authorization },
  };
}

export function toInternalVerifyRequest(
  corePayload: CorePayload,
  coreReq: CoreRequirements,
): VerifyRequest {
  return {
    x402Version: corePayload.x402Version,
    paymentPayload: toInternalPayload(corePayload),
    paymentRequirements: toInternalRequirement(coreReq),
  };
}

export function toInternalSettleRequest(
  corePayload: CorePayload,
  coreReq: CoreRequirements,
): SettleRequest {
  return {
    x402Version: corePayload.x402Version,
    paymentPayload: toInternalPayload(corePayload),
    paymentRequirements: toInternalRequirement(coreReq),
  };
}

export function toPayloadResult(
  internal: PaymentPayload,
): Record<string, unknown> {
  return {
    signature: internal.payload.signature,
    authorization: internal.payload.authorization,
  };
}
