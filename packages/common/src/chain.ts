import { defineChain } from "viem";

export const thanosSepolia = defineChain({
  id: 111551119090,
  name: "Thanos Sepolia",
  nativeCurrency: {
    name: "TON",
    symbol: "TON",
    decimals: 18,
  },
  rpcUrls: {
    default: {
      http: ["https://rpc.thanos-sepolia.tokamak.network"],
      webSocket: ["wss://rpc.thanos-sepolia.tokamak.network"],
    },
  },
  blockExplorers: {
    default: {
      name: "Blockscout",
      url: "https://explorer.thanos-sepolia.tokamak.network",
    },
  },
  testnet: true,
});

export const CAIP2_THANOS_SEPOLIA = "eip155:111551119090";

export const CONTRACTS = {
  facilitator: "0x0000000000000000000000000000000000000000" as `0x${string}`,
  entryPoint: "0x5c058Eb93CDee95d72398E5441d989ef6453D038" as `0x${string}`,
  paymaster: "0x9e2eb36F7161C066351DC9E418E7a0620EE5d095" as `0x${string}`,
} as const;

// Mutates CONTRACTS at runtime after facilitator deployment
export function setFacilitatorAddress(address: `0x${string}`): void {
  (CONTRACTS as { facilitator: `0x${string}` }).facilitator = address;
}
