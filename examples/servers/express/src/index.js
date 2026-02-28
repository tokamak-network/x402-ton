import express from "express";
import cors from "cors";
import { x402ResourceServer } from "@x402/express";
import { HTTPFacilitatorClient } from "@x402/core/server";
import { paymentMiddleware } from "@x402/express";
import { registerExactTonServer } from "@x402-ton/scheme";
import { createFacilitatorServer } from "@x402-ton/facilitator";
const facilitatorKey = process.env.FACILITATOR_PRIVATE_KEY;
const payTo = process.env.PAY_TO_ADDRESS;
if (!facilitatorKey || !payTo) {
    console.error("Set FACILITATOR_PRIVATE_KEY and PAY_TO_ADDRESS in .env");
    process.exit(1);
}
// 1. Start self-hosted facilitator (CDP doesn't support Thanos Sepolia)
const facilitator = createFacilitatorServer({ privateKey: facilitatorKey });
facilitator.listen(4402, () => console.log("Facilitator on :4402"));
// 2. Wire up x402 resource server
const facilitatorClient = new HTTPFacilitatorClient({ url: "http://localhost:4402" });
const resourceServer = new x402ResourceServer(facilitatorClient);
registerExactTonServer(resourceServer);
// 3. Custom paywall provider — @x402/paywall crashes on custom chains (Thanos Sepolia),
//    so we provide a lightweight wallet-connect paywall using vanilla JS + EIP-1193.
const thanosPaywall = {
    generateHtml(paymentRequired) {
        const req = paymentRequired.accepts[0];
        const amount = req ? (Number(req.amount) / 1e6).toFixed(req.amount.length > 4 ? 4 : 2) : "?";
        const desc = paymentRequired.resource?.description ?? paymentRequired.resource?.url ?? "";
        const dataJson = JSON.stringify(paymentRequired).replace(/</g, "\\u003c");
        return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Payment Required — x402-ton</title>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{min-height:100vh;background:#0a0a0f;font-family:Inter,system-ui,sans-serif;color:#e2e8f0;display:flex;align-items:center;justify-content:center}
    .card{max-width:420px;width:100%;margin:2rem;padding:2.5rem;background:linear-gradient(145deg,#13131f 0%,#1a1a2e 100%);border-radius:1rem;border:1px solid #2d2d44;box-shadow:0 0 60px rgba(99,102,241,.08)}
    .badge{display:inline-block;padding:.25rem .75rem;background:#312e81;color:#a5b4fc;border-radius:2rem;font-size:.75rem;font-weight:600;letter-spacing:.05em;margin-bottom:1.5rem}
    h1{font-size:1.5rem;font-weight:700;margin-bottom:.5rem}
    .desc{color:#94a3b8;font-size:.9rem;margin-bottom:1.5rem}
    .details{background:#0f0f1a;border:1px solid #2d2d44;border-radius:.75rem;padding:1rem;margin-bottom:1.5rem}
    .row{display:flex;justify-content:space-between;font-size:.875rem;padding:.4rem 0}
    .row:not(:last-child){border-bottom:1px solid #1e1e32}
    .label{color:#64748b}.value{font-weight:600;color:#e2e8f0}
    .amount{color:#818cf8;font-size:1.1rem}
    .btn{width:100%;padding:.875rem;border:none;border-radius:.625rem;font-weight:600;font-size:.95rem;cursor:pointer;transition:all .15s}
    .btn-primary{background:linear-gradient(135deg,#6366f1,#4f46e5);color:#fff}
    .btn-primary:hover{opacity:.9;transform:translateY(-1px)}
    .btn-primary:disabled{opacity:.5;cursor:not-allowed;transform:none}
    .btn-secondary{background:#1e1e32;color:#94a3b8;margin-top:.5rem}
    .btn-secondary:hover{background:#2d2d44}
    .status{text-align:center;font-size:.85rem;margin-top:1rem;min-height:1.5rem}
    .status.error{color:#f87171}.status.success{color:#34d399}.status.info{color:#60a5fa}
    .footer{margin-top:1.5rem;text-align:center;font-size:.75rem;color:#475569}
    .footer a{color:#6366f1;text-decoration:none}
    @keyframes pulse{0%,100%{opacity:1}50%{opacity:.5}}
    .loading{animation:pulse 1.5s ease-in-out infinite}
  </style>
</head>
<body>
  <div class="card">
    <span class="badge">THANOS SEPOLIA</span>
    <h1>Payment Required</h1>
    <p class="desc">${desc}</p>

    <div class="details">
      <div class="row"><span class="label">Amount</span><span class="value amount">$${amount} USDC</span></div>
      <div class="row"><span class="label">Network</span><span class="value">Thanos Sepolia</span></div>
      <div class="row"><span class="label">Protocol</span><span class="value">x402 (EIP-3009)</span></div>
    </div>

    <button class="btn btn-primary" id="payBtn" onclick="handlePay()">Connect Wallet &amp; Pay</button>
    <button class="btn btn-secondary" onclick="window.location.reload()">Cancel</button>
    <div class="status" id="status"></div>

    <div class="footer">
      Powered by <a href="https://github.com/anthropics/x402" target="_blank">x402</a>
      on <a href="https://tokamak.network" target="_blank">Tokamak Network</a>
    </div>
  </div>

  <script>
    const paymentRequired = ${dataJson};
    const req = paymentRequired.accepts[0];
    const statusEl = document.getElementById("status");
    const payBtn = document.getElementById("payBtn");

    const THANOS_SEPOLIA = {
      chainId: "0x" + (111551119090).toString(16),
      chainName: "Thanos Sepolia",
      nativeCurrency: { name: "TON", symbol: "TON", decimals: 18 },
      rpcUrls: ["https://rpc.thanos-sepolia.tokamak.network"],
      blockExplorerUrls: ["https://explorer.thanos-sepolia.tokamak.network"]
    };

    function setStatus(msg, type) { statusEl.className = "status " + type; statusEl.textContent = msg; }
    function setLoading(on) { payBtn.disabled = on; if (on) payBtn.classList.add("loading"); else payBtn.classList.remove("loading"); }

    async function handlePay() {
      if (!window.ethereum) { setStatus("No wallet detected. Install MetaMask.", "error"); return; }
      setLoading(true);
      try {
        setStatus("Connecting wallet...", "info");
        const accounts = await window.ethereum.request({ method: "eth_requestAccounts" });
        const from = accounts[0];

        // Switch to Thanos Sepolia
        try {
          await window.ethereum.request({ method: "wallet_switchEthereumChain", params: [{ chainId: THANOS_SEPOLIA.chainId }] });
        } catch (e) {
          if (e.code === 4902) {
            await window.ethereum.request({ method: "wallet_addEthereumChain", params: [THANOS_SEPOLIA] });
          } else throw e;
        }

        setStatus("Signing payment authorization...", "info");

        const domain = {
          name: req.extra?.name || "Bridged USDC (Tokamak Network)",
          version: req.extra?.version || "2",
          chainId: 111551119090,
          verifyingContract: req.asset
        };

        const now = Math.floor(Date.now() / 1000);
        const nonce = "0x" + Array.from(crypto.getRandomValues(new Uint8Array(32))).map(b => b.toString(16).padStart(2,"0")).join("");

        const message = {
          from: from,
          to: req.payTo,
          value: req.amount,
          validAfter: String(now - 600),
          validBefore: String(now + (req.maxTimeoutSeconds || 60)),
          nonce: nonce
        };

        const types = {
          EIP712Domain: [
            { name: "name", type: "string" },
            { name: "version", type: "string" },
            { name: "chainId", type: "uint256" },
            { name: "verifyingContract", type: "address" }
          ],
          TransferWithAuthorization: [
            { name: "from", type: "address" },
            { name: "to", type: "address" },
            { name: "value", type: "uint256" },
            { name: "validAfter", type: "uint256" },
            { name: "validBefore", type: "uint256" },
            { name: "nonce", type: "bytes32" }
          ]
        };

        const typedData = JSON.stringify({ types, primaryType: "TransferWithAuthorization", domain, message });
        const signature = await window.ethereum.request({ method: "eth_signTypedData_v4", params: [from, typedData] });

        const payload = {
          x402Version: 2,
          resource: paymentRequired.resource,
          accepted: req,
          payload: { signature, authorization: message }
        };

        setStatus("Submitting payment...", "info");
        const encoded = btoa(JSON.stringify(payload));
        const res2 = await fetch(window.location.href, {
          headers: { "payment-signature": encoded }
        });

        if (res2.ok) {
          setStatus("Payment successful!", "success");
          const body = await res2.text();
          const pre = document.createElement("pre");
          pre.style.cssText = "padding:2rem;background:#0a0a0f;color:#e2e8f0;white-space:pre-wrap;word-break:break-all";
          pre.textContent = body;
          document.body.replaceChildren(pre);
        } else {
          setStatus("Payment failed: " + res2.status, "error");
        }
      } catch (err) {
        setStatus(err.message || "Payment failed", "error");
      } finally {
        setLoading(false);
      }
    }
  </script>
</body>
</html>`;
    },
};
// 4. Express app with payment middleware
const app = express();
app.use(cors({ exposedHeaders: ["payment-required", "payment-response"] }));
app.use(paymentMiddleware({
    "GET /api/plasma": {
        accepts: [
            {
                scheme: "exact",
                price: "$0.10",
                network: "eip155:111551119090",
                payTo,
            },
        ],
        description: "Tokamak plasma channel state",
        mimeType: "application/json",
    },
    "GET /api/fusion": {
        accepts: [
            {
                scheme: "exact",
                price: "$0.001",
                network: "eip155:111551119090",
                payTo,
            },
        ],
        description: "Fusion reactor telemetry snapshot",
        mimeType: "application/json",
    },
}, resourceServer, { testnet: true }, thanosPaywall));
// Paid: Tokamak plasma channel state — simulates L2 operator data
app.get("/api/plasma", (_req, res) => {
    res.json({
        operator: "thanos-sepolia-sequencer",
        chainId: 111551119090,
        epoch: Math.floor(Date.now() / 30_000),
        commitRoot: `0x${Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString("hex")}`,
        pendingWithdrawals: Math.floor(Math.random() * 42),
        throughput: `${(1200 + Math.random() * 800).toFixed(0)} tx/s`,
    });
});
// Paid: Fusion reactor telemetry — playful nod to the Tokamak name
app.get("/api/fusion", (_req, res) => {
    const plasmaTempMK = 100 + Math.random() * 50;
    res.json({
        reactor: "Tokamak-7",
        plasmaTempMK: `${plasmaTempMK.toFixed(1)} MK`,
        confinementTime: `${(2 + Math.random() * 3).toFixed(2)}s`,
        neutronFlux: `${(1e14 + Math.random() * 9e14).toExponential(2)} n/cm²·s`,
        tritiumBreedingRatio: (1.05 + Math.random() * 0.1).toFixed(3),
        status: plasmaTempMK > 130 ? "ignition" : "heating",
    });
});
// Free: health check — no payment required
app.get("/api/health", (_req, res) => {
    res.json({ status: "operational", chain: "thanos-sepolia", timestamp: Date.now() });
});
app.listen(4403, () => console.log("API on :4403"));
//# sourceMappingURL=index.js.map