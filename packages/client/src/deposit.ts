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
  });
}

export async function deposit(
  walletClient: WalletClient,
  amount: bigint,
  facilitatorAddress?: `0x${string}`
): Promise<`0x${string}`> {
  if (!walletClient.account) throw new Error("WalletClient has no connected account");
  return walletClient.writeContract({
    address: facilitatorAddress ?? CONTRACTS.facilitator,
    abi: FACILITATOR_ABI,
    functionName: "deposit",
    value: amount,
    account: walletClient.account,
    chain: walletClient.chain,
  });
}

export async function withdraw(
  walletClient: WalletClient,
  amount: bigint,
  facilitatorAddress?: `0x${string}`
): Promise<`0x${string}`> {
  if (!walletClient.account) throw new Error("WalletClient has no connected account");
  return walletClient.writeContract({
    address: facilitatorAddress ?? CONTRACTS.facilitator,
    abi: FACILITATOR_ABI,
    functionName: "withdraw",
    args: [amount],
    account: walletClient.account,
    chain: walletClient.chain,
  });
}

export async function ensureBalance(
  publicClient: PublicClient,
  walletClient: WalletClient,
  requiredAmount: bigint,
  facilitatorAddress?: `0x${string}`
): Promise<`0x${string}` | null> {
  if (!walletClient.account) throw new Error("WalletClient has no connected account");
  const current = await getBalance(
    publicClient,
    walletClient.account.address,
    facilitatorAddress
  );
  if (current >= requiredAmount) return null;

  const deficit = requiredAmount - current;
  const hash = await deposit(walletClient, deficit, facilitatorAddress);
  await publicClient.waitForTransactionReceipt({ hash });
  return hash;
}
