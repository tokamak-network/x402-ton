import { type LocalAccount } from "viem";
import { type PaymentRequired } from "@x402-ton/common";
import { signPayment } from "./signer.js";

export interface X402ClientConfig {
  account: LocalAccount;
}

export function createX402Fetch(config: X402ClientConfig) {
  return async function x402Fetch(
    input: RequestInfo | URL,
    init?: RequestInit
  ): Promise<Response> {
    const response = await fetch(input, init);

    if (response.status !== 402) return response;

    const header = response.headers.get("payment-required");
    if (!header) return response;

    const paymentRequired: PaymentRequired = JSON.parse(
      Buffer.from(header, "base64").toString("utf-8")
    );

    const requirement = paymentRequired.accepts.find(
      (r) => r.scheme === "exact"
    );
    if (!requirement) return response;

    const payload = await signPayment(config.account, requirement);
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
