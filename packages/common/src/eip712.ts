import { type TypedDataDomain } from "viem";

export const PAYMENT_AUTH_TYPES = {
  PaymentAuth: [
    { name: "from", type: "address" },
    { name: "to", type: "address" },
    { name: "amount", type: "uint256" },
    { name: "deadline", type: "uint256" },
    { name: "nonce", type: "bytes32" },
  ],
} as const;

export function getFacilitatorDomain(
  contractAddress: `0x${string}`,
  chainId: number
): TypedDataDomain {
  return {
    name: "x402-TON Payment Facilitator",
    version: "1",
    chainId: BigInt(chainId),
    verifyingContract: contractAddress,
  };
}
