import { createFacilitatorServer } from "./server.js";

const port = parseInt(process.env.FACILITATOR_PORT ?? "4402");
const privateKey = process.env.FACILITATOR_PRIVATE_KEY as `0x${string}`;
const facilitatorAddress = process.env.FACILITATOR_CONTRACT as `0x${string}`;

if (!privateKey || !facilitatorAddress) {
  console.error("Missing FACILITATOR_PRIVATE_KEY or FACILITATOR_CONTRACT");
  process.exit(1);
}

const app = createFacilitatorServer({ privateKey, facilitatorAddress, port });
app.listen(port, () => {
  console.log(`x402-TON facilitator running on port ${port}`);
});

export { createFacilitatorServer } from "./server.js";
export { verifyPayment } from "./verify.js";
export { settlePayment } from "./settle.js";
