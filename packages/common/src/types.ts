export type Network = `${string}:${string}`;

export interface PaymentRequirements {
  scheme: "exact";
  network: Network;
  asset: `0x${string}`;
  amount: string;
  payTo: `0x${string}`;
  maxTimeoutSeconds: number;
  extra: Record<string, unknown>;
}

export interface PaymentRequired {
  x402Version: number;
  accepts: PaymentRequirements[];
}

export interface TransferAuthorization {
  from: `0x${string}`;
  to: `0x${string}`;
  value: string;
  validAfter: string;
  validBefore: string;
  nonce: `0x${string}`;
}

export interface PaymentPayload {
  x402Version: number;
  scheme: "exact";
  network: Network;
  payload: {
    signature: `0x${string}`;
    authorization: TransferAuthorization;
  };
}

export interface VerifyRequest {
  x402Version: number;
  paymentPayload: PaymentPayload;
  paymentRequirements: PaymentRequirements;
}

export interface VerifyResponse {
  isValid: boolean;
  invalidReason?: string;
  payer?: `0x${string}`;
}

export interface SettleRequest {
  x402Version: number;
  paymentPayload: PaymentPayload;
  paymentRequirements: PaymentRequirements;
}

export interface SettlementResponse {
  success: boolean;
  payer?: `0x${string}`;
  transaction?: `0x${string}`;
  network: Network;
  errorReason?: string;
}
