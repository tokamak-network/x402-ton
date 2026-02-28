import { createFacilitatorServer } from "./server.js";

const port = parseInt(process.env.FACILITATOR_PORT ?? "4402");
const privateKey = process.env.FACILITATOR_PRIVATE_KEY as `0x${string}`;

if (!privateKey) {
  console.error("Missing FACILITATOR_PRIVATE_KEY");
  process.exit(1);
}

const app = createFacilitatorServer({ privateKey, port });
app.listen(port, () => {
  console.log(`x402 facilitator running on port ${port}`);
});
