import express from "express";
import { parseEther } from "viem";
import { paymentMiddleware } from "@x402-ton/server";

const app = express();
const port = parseInt(process.env.DEMO_API_PORT ?? "4403");
const payTo = process.env.PAY_TO_ADDRESS as `0x${string}`;
const facilitatorUrl = process.env.FACILITATOR_URL ?? "http://localhost:4402";

if (!payTo) {
  console.error("Set PAY_TO_ADDRESS env var");
  process.exit(1);
}

app.use(
  paymentMiddleware({
    facilitatorUrl,
    routes: {
      "GET /api/weather": {
        price: parseEther("0.001").toString(),
        payTo,
        description: "Current weather data (0.001 TON)",
        mimeType: "application/json",
      },
      "GET /api/joke": {
        price: parseEther("0.0001").toString(),
        payTo,
        description: "A random joke (0.0001 TON)",
        mimeType: "application/json",
      },
      "GET /api/premium/[id]": {
        price: parseEther("0.01").toString(),
        payTo,
        description: "Premium content (0.01 TON)",
        mimeType: "application/json",
      },
    },
  })
);

app.get("/", (_req, res) => {
  res.json({
    name: "x402-TON Demo API",
    endpoints: {
      "/api/weather": "0.001 TON",
      "/api/joke": "0.0001 TON",
      "/api/premium/:id": "0.01 TON",
      "/api/free": "free",
    },
  });
});

app.get("/api/free", (_req, res) => {
  res.json({ message: "This endpoint is free!", timestamp: Date.now() });
});

app.get("/api/weather", (req, res) => {
  res.json({ location: "Thanos Sepolia", temperature: "42°C", condition: "Powered by TON", payer: req.x402Payer });
});

app.get("/api/joke", (_req, res) => {
  const jokes = [
    "Why do blockchain devs never get cold? They have too many layers.",
    "What did the smart contract say to the EOA? You have no code.",
    "Why did the transaction fail? It ran out of gas at the worst time.",
  ];
  res.json({ joke: jokes[Math.floor(Math.random() * jokes.length)] });
});

app.get("/api/premium/:id", (req, res) => {
  res.json({ id: req.params.id, content: "Premium content unlocked via x402 TON payment", payer: req.x402Payer });
});

app.listen(port, () => {
  console.log(`x402-TON demo API on port ${port}`);
  console.log(`Facilitator: ${facilitatorUrl}`);
  console.log(`PayTo: ${payTo}`);
});
