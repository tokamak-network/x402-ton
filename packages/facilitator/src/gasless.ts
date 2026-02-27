import {
  type PublicClient,
  type WalletClient,
  type Account,
  type Transport,
  type Chain,
  encodeFunctionData,
  encodeAbiParameters,
  keccak256,
  concat,
  parseGwei,
  parseEther,
} from "viem";
import {
  type SettleRequest,
  type SettlementResponse,
  FACILITATOR_ABI,
  ENTRY_POINT_ABI,
  STEALTH_ACCOUNT_ABI,
  STEALTH_ACCOUNT_FACTORY_ABI,
  CONTRACTS,
  CAIP2_THANOS_SEPOLIA,
  thanosSepolia,
} from "@x402-ton/common";

interface UserOp {
  sender: `0x${string}`;
  nonce: bigint;
  initCode: `0x${string}`;
  callData: `0x${string}`;
  callGasLimit: bigint;
  verificationGasLimit: bigint;
  preVerificationGas: bigint;
  maxFeePerGas: bigint;
  maxPriorityFeePerGas: bigint;
  paymasterAndData: `0x${string}`;
  signature: `0x${string}`;
}

const PAYMASTER_MIN_DEPOSIT = parseEther("0.1");
const PAYMASTER_TOP_UP_AMOUNT = parseEther("1.0");
// Module-level singleton: throttles paymaster balance checks across all settleGasless
// calls in this process. Safe because the facilitator runs as a single-instance server.
let lastTopUpCheck = 0;
const TOP_UP_CHECK_INTERVAL_MS = 60_000;

function encodeSettleCalldata(request: SettleRequest): `0x${string}` {
  const { authorization, signature } = request.paymentPayload.payload;
  return encodeFunctionData({
    abi: FACILITATOR_ABI,
    functionName: "settle",
    args: [
      authorization.from,
      authorization.to,
      BigInt(authorization.amount),
      BigInt(authorization.deadline),
      authorization.nonce,
      signature,
    ],
  });
}

function encodeExecuteCalldata(
  facilitatorAddress: `0x${string}`,
  settleCalldata: `0x${string}`,
): `0x${string}` {
  return encodeFunctionData({
    abi: STEALTH_ACCOUNT_ABI,
    functionName: "execute",
    args: [facilitatorAddress, 0n, settleCalldata],
  });
}

function buildInitCode(owner: `0x${string}`): `0x${string}` {
  const createAccountCalldata = encodeFunctionData({
    abi: STEALTH_ACCOUNT_FACTORY_ABI,
    functionName: "createAccount",
    args: [owner, 0n],
  });
  return concat([CONTRACTS.accountFactory, createAccountCalldata]);
}

// DustPaymaster hash: sponsor must sign this to authorize gas sponsorship.
// Sponsor key must match the paymaster's verifier address.
function computePaymasterHash(
  userOp: UserOp,
  validUntil: number,
  validAfter: number,
): `0x${string}` {
  return keccak256(
    encodeAbiParameters(
      [
        { type: "address" }, { type: "uint256" },
        { type: "bytes32" }, { type: "bytes32" },
        { type: "uint256" }, { type: "uint256" }, { type: "uint256" },
        { type: "uint256" }, { type: "uint256" },
        { type: "uint256" },
        { type: "address" },
        { type: "uint48" }, { type: "uint48" },
      ],
      [
        userOp.sender, userOp.nonce,
        keccak256(userOp.initCode),
        keccak256(userOp.callData),
        userOp.callGasLimit, userOp.verificationGasLimit, userOp.preVerificationGas,
        userOp.maxFeePerGas, userOp.maxPriorityFeePerGas,
        BigInt(thanosSepolia.id),
        CONTRACTS.paymaster,
        validUntil, validAfter,
      ],
    ),
  );
}

async function topUpPaymasterIfNeeded(
  publicClient: PublicClient,
  walletClient: WalletClient<Transport, Chain, Account>,
): Promise<void> {
  const now = Date.now();
  if (now - lastTopUpCheck < TOP_UP_CHECK_INTERVAL_MS) return;
  lastTopUpCheck = now;

  try {
    const deposit = await publicClient.readContract({
      address: CONTRACTS.entryPoint,
      abi: ENTRY_POINT_ABI,
      functionName: "balanceOf",
      args: [CONTRACTS.paymaster],
    });
    if (typeof deposit !== "bigint") throw new Error("Unexpected return type from balanceOf");

    if (deposit >= PAYMASTER_MIN_DEPOSIT) return;

    const sponsorBal = await publicClient.getBalance({ address: walletClient.account.address });
    if (sponsorBal <= PAYMASTER_TOP_UP_AMOUNT) {
      console.warn("[Gasless] Paymaster deposit low but sponsor balance insufficient");
      return;
    }

    console.log(`[Gasless] Paymaster deposit low (${deposit}). Topping up...`);
    const hash = await walletClient.writeContract({
      address: CONTRACTS.entryPoint,
      abi: ENTRY_POINT_ABI,
      functionName: "depositTo",
      args: [CONTRACTS.paymaster],
      value: PAYMASTER_TOP_UP_AMOUNT,
    });
    await publicClient.waitForTransactionReceipt({ hash });
    console.log("[Gasless] Paymaster topped up with 1.0 TON");
  } catch (err) {
    console.warn("[Gasless] Top-up check failed:", err instanceof Error ? err.message : err);
  }
}

export async function settleGasless(
  publicClient: PublicClient,
  walletClient: WalletClient<Transport, Chain, Account>,
  facilitatorAddress: `0x${string}`,
  request: SettleRequest,
): Promise<SettlementResponse> {
  const owner = walletClient.account.address;

  try {
    await topUpPaymasterIfNeeded(publicClient, walletClient);

    // Compute AA account address from factory
    const senderAddress = await publicClient.readContract({
      address: CONTRACTS.accountFactory,
      abi: STEALTH_ACCOUNT_FACTORY_ABI,
      functionName: "getAddress",
      args: [owner, 0n],
    });
    if (typeof senderAddress !== "string" || !senderAddress.startsWith("0x")) {
      throw new Error("Unexpected return type from getAddress");
    }

    // Deploy AA account on first use via initCode
    const code = await publicClient.getCode({ address: senderAddress });
    const needsDeploy = !code || code === "0x";
    const initCode: `0x${string}` = needsDeploy ? buildInitCode(owner) : "0x";

    // Encode: execute(facilitatorContract, 0, settle(...))
    const settleCalldata = encodeSettleCalldata(request);
    const callData = encodeExecuteCalldata(facilitatorAddress, settleCalldata);

    const nonce = await publicClient.readContract({
      address: CONTRACTS.entryPoint,
      abi: ENTRY_POINT_ABI,
      functionName: "getNonce",
      args: [senderAddress, 0n],
    });
    if (typeof nonce !== "bigint") throw new Error("Unexpected return type from getNonce");

    const callGasLimit = 300_000n;
    const verificationGasLimit = needsDeploy ? 500_000n : 200_000n;
    const preVerificationGas = 50_000n;

    const block = await publicClient.getBlock({ blockTag: "latest" });
    const baseFee = block.baseFeePerGas ?? parseGwei("1");
    const maxPriorityFeePerGas = parseGwei("1.5");
    const maxFeePerGas = baseFee * 2n + maxPriorityFeePerGas;

    // Paymaster signature (10min validity window)
    const validUntil = Math.floor(Date.now() / 1000) + 600;
    const validAfter = Math.floor(Date.now() / 1000) - 60;

    const userOp: UserOp = {
      sender: senderAddress,
      nonce,
      initCode,
      callData,
      callGasLimit,
      verificationGasLimit,
      preVerificationGas,
      maxFeePerGas,
      maxPriorityFeePerGas,
      paymasterAndData: "0x",
      signature: "0x",
    };

    const paymasterHash = computePaymasterHash(userOp, validUntil, validAfter);
    const sponsorSig = await walletClient.signMessage({
      message: { raw: paymasterHash },
    });

    const timeRange = encodeAbiParameters(
      [{ type: "uint48" }, { type: "uint48" }],
      [validUntil, validAfter],
    );
    userOp.paymasterAndData = concat([CONTRACTS.paymaster, timeRange, sponsorSig]);

    // Sign the UserOp
    const userOpHash = await publicClient.readContract({
      address: CONTRACTS.entryPoint,
      abi: ENTRY_POINT_ABI,
      functionName: "getUserOpHash",
      args: [userOp],
    });
    if (typeof userOpHash !== "string" || !userOpHash.startsWith("0x")) {
      throw new Error("Unexpected return type from getUserOpHash");
    }

    userOp.signature = await walletClient.signMessage({
      message: { raw: userOpHash },
    });

    // Self-bundle: preGas + verGas*2 (account + paymaster) + callGas + 1M overhead
    const overhead = 1_000_000n;
    const computedGasLimit = preVerificationGas + verificationGasLimit * 2n + callGasLimit + overhead;
    const gasLimit = computedGasLimit > 1_500_000n ? computedGasLimit : 1_500_000n;

    const hash = await walletClient.writeContract({
      address: CONTRACTS.entryPoint,
      abi: ENTRY_POINT_ABI,
      functionName: "handleOps",
      args: [[userOp], walletClient.account.address],
      gas: gasLimit,
    });

    const receipt = await publicClient.waitForTransactionReceipt({ hash });

    if (receipt.status === "reverted") {
      return { success: false, network: CAIP2_THANOS_SEPOLIA, errorReason: "UserOp reverted" };
    }

    return {
      success: true,
      payer: request.paymentPayload.payload.authorization.from,
      transaction: hash,
      network: CAIP2_THANOS_SEPOLIA,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Gasless settlement failed";
    let reason = message;
    const aaMatch = message.match(/AA\d+\s+[^"]+/);
    if (aaMatch) reason = `EntryPoint: ${aaMatch[0]}`;
    return { success: false, network: CAIP2_THANOS_SEPOLIA, errorReason: reason };
  }
}
