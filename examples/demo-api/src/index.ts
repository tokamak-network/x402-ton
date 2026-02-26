import express from "express";
import { paymentMiddleware } from "@x402-ton/server";

const PORT = parseInt(process.env.PORT ?? "3000", 10);
const FACILITATOR_URL = process.env.FACILITATOR_URL ?? "http://localhost:4402";
const PAY_TO = (process.env.PAY_TO ?? "0x0000000000000000000000000000000000000000") as `0x${string}`;

const app = express();
app.use(express.json());

app.use(
  paymentMiddleware({
    facilitatorUrl: FACILITATOR_URL,
    routes: {
      "GET /api/weather": {
        price: "1000000000000000",
        payTo: PAY_TO,
        description: "Current weather data",
      },
      "GET /api/joke": {
        price: "100000000000000",
        payTo: PAY_TO,
        description: "A random joke",
      },
      "GET /api/premium/[id]": {
        price: "10000000000000000",
        payTo: PAY_TO,
        description: "Premium content by ID",
      },
    },
  })
);

app.get("/api/free", (_req, res) => {
  res.json({ message: "This endpoint is free!", timestamp: Date.now() });
});

app.get("/api/weather", (req, res) => {
  res.json({
    payer: req.x402Payer,
    location: "San Francisco, CA",
    temperature: 18,
    unit: "celsius",
    condition: "Partly cloudy",
    humidity: 65,
    timestamp: Date.now(),
  });
});

app.get("/api/joke", (req, res) => {
  const jokes = [
    "Why do programmers prefer dark mode? Because light attracts bugs.",
    "There are 10 kinds of people: those who understand binary and those who don't.",
    "A SQL query walks into a bar, sees two tables, and asks: 'Can I JOIN you?'",
  ];
  res.json({
    payer: req.x402Payer,
    joke: jokes[Math.floor(Math.random() * jokes.length)],
  });
});

app.get("/api/premium/:id", (req, res) => {
  res.json({
    payer: req.x402Payer,
    id: req.params.id,
    content: `Premium content for item ${req.params.id}`,
    accessLevel: "premium",
    timestamp: Date.now(),
  });
});

app.listen(PORT, () => {
  console.log(`Demo API server running on port ${PORT}`);
  console.log(`Facilitator: ${FACILITATOR_URL}`);
  console.log(`Pay-to address: ${PAY_TO}`);
  console.log(`\nEndpoints:`);
  console.log(`  GET /api/free          — free`);
  console.log(`  GET /api/weather       — 0.001 TON`);
  console.log(`  GET /api/joke          — 0.0001 TON`);
  console.log(`  GET /api/premium/:id   — 0.01 TON`);
});
