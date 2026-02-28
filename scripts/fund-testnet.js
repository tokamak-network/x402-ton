import { createPublicClient, createWalletClient, http, formatUnits, parseUnits } from "viem";
import { sepolia } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";
import { createInterface } from "readline/promises";
import { thanosSepolia } from "../packages/common/src/chain.js";
const L1_USDC = "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238";
const L2_USDC = "0x4200000000000000000000000000000000000778";
const L1_USDC_BRIDGE = "0x7dD2196722FBe83197820BF30e1c152e4FBa0a6A";
const USDC_DECIMALS = 6;
const POLL_INTERVAL_MS = 15_000;
const POLL_TIMEOUT_MS = 10 * 60 * 1_000;
const BRIDGE_GAS_LIMIT = 200_000;
const ERC20_ABI = [
    {
        inputs: [{ name: "account", type: "address" }],
        name: "balanceOf",
        outputs: [{ name: "", type: "uint256" }],
        stateMutability: "view",
        type: "function",
    },
    {
        inputs: [
            { name: "spender", type: "address" },
            { name: "amount", type: "uint256" },
        ],
        name: "approve",
        outputs: [{ name: "", type: "bool" }],
        stateMutability: "nonpayable",
        type: "function",
    },
    {
        inputs: [
            { name: "owner", type: "address" },
            { name: "spender", type: "address" },
        ],
        name: "allowance",
        outputs: [{ name: "", type: "uint256" }],
        stateMutability: "view",
        type: "function",
    },
];
// OP Stack L1UsdcBridge ABI (single function)
const BRIDGE_ABI = [
    {
        inputs: [
            { name: "_l1Token", type: "address" },
            { name: "_l2Token", type: "address" },
            { name: "_amount", type: "uint256" },
            { name: "_minGasLimit", type: "uint32" },
            { name: "_extraData", type: "bytes" },
        ],
        name: "bridgeERC20",
        outputs: [],
        stateMutability: "nonpayable",
        type: "function",
    },
];
function formatUsdc(raw) {
    return formatUnits(raw, USDC_DECIMALS);
}
async function prompt(question) {
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    try {
        return await rl.question(question);
    }
    finally {
        rl.close();
    }
}
async function pollL2Balance(l2Public, address, initialBalance) {
    const start = Date.now();
    while (Date.now() - start < POLL_TIMEOUT_MS) {
        await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
        const balance = await l2Public.readContract({
            address: L2_USDC,
            abi: ERC20_ABI,
            functionName: "balanceOf",
            args: [address],
        });
        const elapsed = Math.round((Date.now() - start) / 1_000);
        console.log(`  [${elapsed}s] L2 USDC balance: ${formatUsdc(balance)}`);
        if (balance > initialBalance) {
            return balance;
        }
    }
    throw new Error(`Timed out after ${POLL_TIMEOUT_MS / 60_000} minutes waiting for L2 USDC to arrive`);
}
async function main() {
    const privateKey = process.env.PRIVATE_KEY;
    if (!privateKey) {
        console.error("Error: PRIVATE_KEY environment variable is required");
        process.exit(1);
    }
    if (!privateKey.startsWith("0x") || privateKey.length !== 66) {
        console.error("Error: PRIVATE_KEY must be a 0x-prefixed 32-byte hex string (66 chars)");
        process.exit(1);
    }
    const account = privateKeyToAccount(privateKey);
    console.log(`Wallet: ${account.address}\n`);
    const l1Public = createPublicClient({ chain: sepolia, transport: http() });
    const l2Public = createPublicClient({ chain: thanosSepolia, transport: http() });
    const l1Wallet = createWalletClient({ account, chain: sepolia, transport: http() });
    // Step 1: Check L2 balance
    const l2Balance = await l2Public.readContract({
        address: L2_USDC,
        abi: ERC20_ABI,
        functionName: "balanceOf",
        args: [account.address],
    });
    console.log(`L2 USDC (Thanos Sepolia): ${formatUsdc(l2Balance)}`);
    // 1 USDC = 1_000_000 (6 decimals)
    if (l2Balance >= parseUnits("1", USDC_DECIMALS)) {
        console.log("Sufficient L2 USDC balance. No bridging needed.");
        return;
    }
    // Step 2: Check L1 balance
    const l1Balance = await l1Public.readContract({
        address: L1_USDC,
        abi: ERC20_ABI,
        functionName: "balanceOf",
        args: [account.address],
    });
    console.log(`L1 USDC (Sepolia):        ${formatUsdc(l1Balance)}`);
    if (l1Balance === 0n) {
        console.log("\nNo L1 USDC available. Get testnet USDC from the Circle faucet:");
        console.log("  https://faucet.circle.com/");
        console.log(`\nSelect "Ethereum Sepolia" and enter your address: ${account.address}`);
        return;
    }
    // Step 3: Prompt user
    const bridgeAmount = l1Balance;
    const answer = await prompt(`\nBridge ${formatUsdc(bridgeAmount)} USDC from Sepolia → Thanos Sepolia? (y/n) `);
    if (answer.toLowerCase() !== "y") {
        console.log("Aborted.");
        return;
    }
    // Step 4: Approve bridge if needed
    const allowance = await l1Public.readContract({
        address: L1_USDC,
        abi: ERC20_ABI,
        functionName: "allowance",
        args: [account.address, L1_USDC_BRIDGE],
    });
    if (allowance < bridgeAmount) {
        console.log("\nApproving bridge to spend USDC...");
        const approveHash = await l1Wallet.writeContract({
            address: L1_USDC,
            abi: ERC20_ABI,
            functionName: "approve",
            args: [L1_USDC_BRIDGE, bridgeAmount],
        });
        const approveReceipt = await l1Public.waitForTransactionReceipt({ hash: approveHash });
        if (approveReceipt.status === "reverted") {
            throw new Error(`Approve transaction reverted: ${approveHash}`);
        }
        console.log(`  Approved: ${approveHash}`);
    }
    else {
        console.log("\nBridge allowance sufficient, skipping approve.");
    }
    // Step 5: Bridge USDC
    console.log("Bridging USDC to Thanos Sepolia...");
    const bridgeHash = await l1Wallet.writeContract({
        address: L1_USDC_BRIDGE,
        abi: BRIDGE_ABI,
        functionName: "bridgeERC20",
        args: [L1_USDC, L2_USDC, bridgeAmount, BRIDGE_GAS_LIMIT, "0x"],
    });
    const bridgeReceipt = await l1Public.waitForTransactionReceipt({ hash: bridgeHash });
    if (bridgeReceipt.status === "reverted") {
        throw new Error(`Bridge transaction reverted: ${bridgeHash}`);
    }
    console.log(`  Bridge tx: ${bridgeHash}`);
    // Step 6: Poll L2 for arrival
    console.log("\nWaiting for USDC to arrive on L2 (polling every 15s, timeout 10min)...");
    const finalBalance = await pollL2Balance(l2Public, account.address, l2Balance);
    console.log(`\nDone! L2 USDC balance: ${formatUsdc(finalBalance)}`);
}
main().catch((err) => {
    console.error(`\nError: ${err.message}`);
    process.exit(1);
});
//# sourceMappingURL=fund-testnet.js.map