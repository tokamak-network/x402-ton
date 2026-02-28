import type { LocalAccount, PublicClient, WalletClient, Account, Transport, Chain } from "viem";
import type { Network } from "@x402/core/types";
import { CAIP2_THANOS_SEPOLIA } from "@x402-ton/common";
import { ExactTonClient } from "./client.js";
import { ExactTonFacilitator, type ExactTonFacilitatorConfig } from "./facilitator.js";
import { ExactTonServer } from "./server.js";

interface SingleNetworkRegistrable<T> {
  register(network: Network, scheme: T): unknown;
}

interface MultiNetworkRegistrable<T> {
  register(networks: Network | Network[], scheme: T): unknown;
}

export interface TonClientConfig {
  account: LocalAccount;
  network?: Network;
}

export function registerExactTonScheme(
  client: SingleNetworkRegistrable<{ readonly scheme: string }>,
  config: TonClientConfig,
): void {
  const network = config.network ?? (CAIP2_THANOS_SEPOLIA as Network);
  client.register(network, new ExactTonClient(config.account));
}

export interface TonFacilitatorConfig {
  publicClient: PublicClient;
  walletClient: WalletClient<Transport, Chain, Account>;
  networks?: Network[];
}

export function registerExactTonFacilitator(
  facilitator: MultiNetworkRegistrable<{ readonly scheme: string }>,
  config: TonFacilitatorConfig,
): void {
  const networks = config.networks ?? [CAIP2_THANOS_SEPOLIA as Network];
  const facConfig: ExactTonFacilitatorConfig = {
    publicClient: config.publicClient,
    walletClient: config.walletClient,
  };
  facilitator.register(networks, new ExactTonFacilitator(facConfig));
}

export interface TonServerConfig {
  networks?: Network[];
}

export function registerExactTonServer(
  server: SingleNetworkRegistrable<{ readonly scheme: string }>,
  config: TonServerConfig = {},
): void {
  const tonServer = new ExactTonServer();
  const networks = config.networks ?? [CAIP2_THANOS_SEPOLIA as Network];
  for (const network of networks) {
    server.register(network, tonServer);
  }
}
