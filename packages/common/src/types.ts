export interface PaymentRequirement {
  scheme: "exact-ton";
  network: string;
  maxAmountRequired: string;
  resource: string;
  description: string;
  mimeType: string;
  payTo: `0x${string}`;
  maxTimeoutSeconds: number;
  asset: "native";
  extra?: Record<string, unknown>;
}

export interface PaymentRequired {
  version: 2;
  accepts: PaymentRequirement[];
}

export interface PaymentAuthorization {
  from: `0x${string}`;
  to: `0x${string}`;
  amount: string;
  deadline: string;
  nonce: `0x${string}`;
}

export interface PaymentPayload {
  x402Version: 2;
  scheme: "exact-ton";
  network: string;
  payload: {
    signature: `0x${string}`;
    authorization: PaymentAuthorization;
  };
}

export interface VerifyRequest {
  paymentPayload: PaymentPayload;
  paymentRequirements: PaymentRequirement;
}

export interface VerifyResponse {
  isValid: boolean;
  invalidReason?: string;
  payer?: `0x${string}`;
}

export interface SettleRequest {
  paymentPayload: PaymentPayload;
  paymentRequirements: PaymentRequirement;
}

export interface SettlementResponse {
  success: boolean;
  payer?: `0x${string}`;
  transaction?: `0x${string}`;
  network: string;
  errorReason?: string;
}
