import { isAddress } from "viem";
import { createFacilitatorServer } from "./server.js";

const port = parseInt(process.env.FACILITATOR_PORT ?? "4402");
const rawKey = process.env.FACILITATOR_PRIVATE_KEY;
const rawAddress = process.env.FACILITATOR_CONTRACT;

if (!rawKey || !rawAddress) {
  console.error("Missing FACILITATOR_PRIVATE_KEY or FACILITATOR_CONTRACT");
  process.exit(1);
}
if (!rawKey.startsWith("0x")) {
  console.error("FACILITATOR_PRIVATE_KEY must start with 0x");
  process.exit(1);
}
if (!isAddress(rawAddress)) {
  console.error("FACILITATOR_CONTRACT must be a valid address");
  process.exit(1);
}
const privateKey = rawKey as `0x${string}`;
const facilitatorAddress = rawAddress as `0x${string}`;

const app = createFacilitatorServer({ privateKey, facilitatorAddress, port });
app.listen(port, () => {
  console.log(`x402-TON facilitator running on port ${port}`);
});
