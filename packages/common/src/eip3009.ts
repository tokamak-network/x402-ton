import { type TypedDataDomain } from "viem";

export const TRANSFER_WITH_AUTHORIZATION_TYPES = {
  TransferWithAuthorization: [
    { name: "from", type: "address" },
    { name: "to", type: "address" },
    { name: "value", type: "uint256" },
    { name: "validAfter", type: "uint256" },
    { name: "validBefore", type: "uint256" },
    { name: "nonce", type: "bytes32" },
  ],
} as const;

export function getUsdcDomain(
  usdcAddress: `0x${string}`,
  chainId: number,
  extra?: Record<string, unknown>,
): TypedDataDomain {
  return {
    name: (extra?.name as string) ?? "Bridged USDC (Tokamak Network)",
    version: (extra?.version as string) ?? "2",
    chainId: BigInt(chainId),
    verifyingContract: usdcAddress,
  };
}
