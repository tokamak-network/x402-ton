import { defineChain, getAddress } from "viem";

function validateAddress(value: string, name: string): `0x${string}` {
  try {
    return getAddress(value);
  } catch {
    throw new Error(`Invalid address for ${name}: "${value}"`);
  }
}

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
      http: [process.env.THANOS_RPC_URL ?? "https://rpc.thanos-sepolia.tokamak.network"],
      webSocket: [process.env.THANOS_WS_URL ?? "wss://rpc.thanos-sepolia.tokamak.network"],
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

// Defaults for Thanos Sepolia — override via env vars for other deployments
export const CONTRACTS = {
  facilitator: validateAddress(
    process.env.FACILITATOR_CONTRACT ?? "0x0af530d6d66947aD930a7d1De60E58c43D40a308",
    "FACILITATOR_CONTRACT",
  ),
  entryPoint: validateAddress(
    process.env.ENTRYPOINT_CONTRACT ?? "0x5c058Eb93CDee95d72398E5441d989ef6453D038",
    "ENTRYPOINT_CONTRACT",
  ),
  paymaster: validateAddress(
    process.env.PAYMASTER_CONTRACT ?? "0x9e2eb36F7161C066351DC9E418E7a0620EE5d095",
    "PAYMASTER_CONTRACT",
  ),
  accountFactory: validateAddress(
    process.env.ACCOUNT_FACTORY_CONTRACT ?? "0xfE89381ae27a102336074c90123A003e96512954",
    "ACCOUNT_FACTORY_CONTRACT",
  ),
};
