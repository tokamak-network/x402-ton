import { x402Client } from "@x402/core/client";
import { wrapFetchWithPayment } from "@x402/fetch";
import { registerExactTonScheme } from "@x402-ton/scheme";
import { privateKeyToAccount } from "viem/accounts";
const privateKey = process.env.PRIVATE_KEY;
const apiUrl = process.env.API_URL ?? "http://localhost:4403";
if (!privateKey) {
    console.error("Set PRIVATE_KEY in .env");
    process.exit(1);
}
const account = privateKeyToAccount(privateKey);
console.log(`Payer: ${account.address}`);
// 1. Create x402 client and register Thanos Sepolia scheme
const client = new x402Client();
registerExactTonScheme(client, { account });
// 2. Wrap fetch — 402 handling is automatic
const fetchWithPayment = wrapFetchWithPayment(fetch, client);
// 3. Free endpoint — no payment needed
console.log("\n--- Health check (free) ---");
const healthRes = await fetch(`${apiUrl}/api/health`);
console.log(`Status: ${healthRes.status}`);
console.log(await healthRes.json());
// 4. Paid: plasma channel state ($0.10 USDC)
console.log("\n--- Plasma state ($0.10 USDC) ---");
const plasmaRes = await fetchWithPayment(`${apiUrl}/api/plasma`);
console.log(`Status: ${plasmaRes.status}`);
console.log(await plasmaRes.json());
// 5. Paid: fusion telemetry ($0.001 USDC)
console.log("\n--- Fusion telemetry ($0.001 USDC) ---");
const fusionRes = await fetchWithPayment(`${apiUrl}/api/fusion`);
console.log(`Status: ${fusionRes.status}`);
console.log(await fusionRes.json());
//# sourceMappingURL=index.js.map