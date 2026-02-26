import { type PublicClient, type WalletClient } from "viem";
import { FACILITATOR_ABI, CONTRACTS } from "@x402-ton/common";

export async function getBalance(
  publicClient: PublicClient,
  account: `0x${string}`,
  facilitatorAddress?: `0x${string}`
): Promise<bigint> {
  return publicClient.readContract({
    address: facilitatorAddress ?? CONTRACTS.facilitator,
    abi: FACILITATOR_ABI,
    functionName: "balances",
    args: [account],
  }) as Promise<bigint>;
}

export async function deposit(
  walletClient: WalletClient,
  amount: bigint,
  facilitatorAddress?: `0x${string}`
): Promise<`0x${string}`> {
  return walletClient.writeContract({
    address: facilitatorAddress ?? CONTRACTS.facilitator,
    abi: FACILITATOR_ABI,
    functionName: "deposit",
    value: amount,
    account: walletClient.account!,
    chain: walletClient.chain,
  });
}

export async function withdraw(
  walletClient: WalletClient,
  amount: bigint,
  facilitatorAddress?: `0x${string}`
): Promise<`0x${string}`> {
  return walletClient.writeContract({
    address: facilitatorAddress ?? CONTRACTS.facilitator,
    abi: FACILITATOR_ABI,
    functionName: "withdraw",
    args: [amount],
    account: walletClient.account!,
    chain: walletClient.chain,
  });
}

export async function ensureBalance(
  publicClient: PublicClient,
  walletClient: WalletClient,
  requiredAmount: bigint,
  facilitatorAddress?: `0x${string}`
): Promise<`0x${string}` | null> {
  const current = await getBalance(
    publicClient,
    walletClient.account!.address,
    facilitatorAddress
  );
  if (current >= requiredAmount) return null;

  const deficit = requiredAmount - current;
  return deposit(walletClient, deficit, facilitatorAddress);
}
