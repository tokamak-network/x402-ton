export { verifyPayment } from "./verify.js";
export { settlePayment } from "./settle.js";
export { createFacilitatorServer, type FacilitatorConfig } from "./server.js";

import { createFacilitatorServer } from "./server.js";

const PORT = parseInt(process.env.PORT ?? "4020", 10);
const FACILITATOR_ADDRESS = process.env.FACILITATOR_ADDRESS as `0x${string}` | undefined;
const PRIVATE_KEY = process.env.PRIVATE_KEY as `0x${string}` | undefined;
const RPC_URL = process.env.RPC_URL;

if (!FACILITATOR_ADDRESS || !PRIVATE_KEY) {
  console.error("Required env vars: FACILITATOR_ADDRESS, PRIVATE_KEY");
  process.exit(1);
}

const app = createFacilitatorServer({
  port: PORT,
  facilitatorAddress: FACILITATOR_ADDRESS,
  privateKey: PRIVATE_KEY,
  rpcUrl: RPC_URL,
});

app.listen(PORT, () => {
  console.log(`x402-TON facilitator listening on :${PORT}`);
});
