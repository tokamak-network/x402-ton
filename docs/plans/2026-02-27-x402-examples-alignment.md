# x402 Examples Alignment Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace all custom examples with two canonical examples that mirror base coinbase/x402's developer experience exactly.

**Architecture:** Two examples — `clients/fetch` (buyer) and `servers/express` (seller) — use `@x402/fetch` and `@x402/express` directly with `@x402-ton/scheme` registered for Thanos Sepolia. Self-hosted facilitator runs inline in the server example since CDP doesn't support Thanos.

**Tech Stack:** `@x402/core@2.5.0`, `@x402/fetch@2.5.0`, `@x402/express@2.5.0`, `@x402-ton/scheme`, `@x402-ton/facilitator`, `viem`, `express`, `tsx`

---

### Task 1: Add /supported endpoint to facilitator

The `@x402/express` middleware calls `GET /supported` on the facilitator during startup (`syncFacilitatorOnStart`). Our facilitator doesn't have this endpoint yet.

**Files:**
- Modify: `packages/facilitator/src/server.ts`
- Modify: `packages/facilitator/test/server.test.ts` (if exists, else create)

**Step 1: Add /supported endpoint**

In `packages/facilitator/src/server.ts`, add after the `/health` endpoint:

```ts
app.get("/supported", (_req, res) => {
  res.json({
    kinds: [
      {
        x402Version: 1,
        scheme: "exact",
        network: "eip155:111551119090",
        extra: { name: "USD Coin", version: "2" },
      },
    ],
    extensions: [],
    signers: {
      "eip155:111551119090": [account.address],
    },
  });
});
```

**Step 2: Verify it works**

Run: `curl -s http://localhost:4402/supported | jq .`

Expected: JSON with `kinds`, `extensions`, `signers` fields.

**Step 3: Rebuild facilitator package**

Run: `npx turbo build --filter=@x402-ton/facilitator`
Expected: Exit code 0

**Step 4: Commit**

```bash
git add packages/facilitator/src/server.ts
git commit -m "feat(facilitator): add /supported endpoint for @x402/express compatibility"
```

---

### Task 2: Delete all existing examples

**Files:**
- Delete: `examples/react-demo/` (entire directory)
- Delete: `examples/demo-api/` (entire directory)
- Delete: `examples/standalone-e2e/` (entire directory)
- Delete: `examples/scheme-plugin/` (entire directory)
- Delete: `examples/hybrid-interop/` (entire directory)

**Step 1: Remove example directories**

```bash
rm -rf examples/react-demo examples/demo-api examples/standalone-e2e examples/scheme-plugin examples/hybrid-interop
```

**Step 2: Update root package.json workspaces**

The root `package.json` has a workspaces glob. Check if it uses `"examples/*"` or lists them explicitly. If explicit, update to match the new structure. If glob-based, no change needed except potentially adjusting to `"examples/clients/*"` and `"examples/servers/*"`.

**Step 3: Verify monorepo still resolves**

Run: `npm install`
Expected: No errors about missing workspaces.

**Step 4: Commit**

```bash
git add -A
git commit -m "chore: remove old examples"
```

---

### Task 3: Create servers/express example

**Files:**
- Create: `examples/servers/express/package.json`
- Create: `examples/servers/express/.env.example`
- Create: `examples/servers/express/src/index.ts`

**Step 1: Create package.json**

`examples/servers/express/package.json`:
```json
{
  "name": "x402-ton-server-express",
  "private": true,
  "type": "module",
  "scripts": {
    "start": "node --env-file=.env --import=tsx src/index.ts"
  },
  "dependencies": {
    "@x402/core": "^2.5.0",
    "@x402/express": "^2.5.0",
    "@x402-ton/scheme": "*",
    "@x402-ton/facilitator": "*",
    "express": "^4.21.0",
    "cors": "^2.8.5"
  },
  "devDependencies": {
    "@types/express": "^5.0.0",
    "@types/cors": "^2.8.17",
    "tsx": "^4.0.0",
    "typescript": "^5.7.0"
  }
}
```

**Step 2: Create .env.example**

`examples/servers/express/.env.example`:
```
FACILITATOR_PRIVATE_KEY=0xYOUR_FACILITATOR_PRIVATE_KEY
PAY_TO_ADDRESS=0xYOUR_PAY_TO_ADDRESS
```

**Step 3: Create src/index.ts**

`examples/servers/express/src/index.ts`:
```ts
import express from "express";
import cors from "cors";
import { x402ResourceServer } from "@x402/express";
import { HTTPFacilitatorClient } from "@x402/core/server";
import { paymentMiddleware } from "@x402/express";
import { registerExactTonServer } from "@x402-ton/scheme";
import { createFacilitatorServer } from "@x402-ton/facilitator";

const facilitatorKey = process.env.FACILITATOR_PRIVATE_KEY as `0x${string}`;
const payTo = process.env.PAY_TO_ADDRESS as `0x${string}`;

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

// 3. Express app with payment middleware — identical to base x402 pattern
const app = express();
app.use(cors({ exposedHeaders: ["payment-required", "payment-response"] }));

app.use(
  paymentMiddleware(
    {
      "GET /api/weather": {
        accepts: [
          {
            scheme: "exact",
            price: "$0.10",
            network: "eip155:111551119090",
            payTo,
          },
        ],
        description: "Current weather data",
        mimeType: "application/json",
      },
      "GET /api/joke": {
        accepts: [
          {
            scheme: "exact",
            price: "$0.001",
            network: "eip155:111551119090",
            payTo,
          },
        ],
        description: "A random joke",
        mimeType: "application/json",
      },
    },
    resourceServer,
  )
);

app.get("/api/weather", (_req, res) => {
  res.json({
    location: "Thanos Sepolia",
    temperature: "42°C",
    condition: "Powered by TON",
  });
});

app.get("/api/joke", (_req, res) => {
  const jokes = [
    "Why do blockchain devs never get cold? They have too many layers.",
    "What did the smart contract say to the EOA? You have no code.",
    "Why did the transaction fail? It ran out of gas at the worst time.",
  ];
  res.json({ joke: jokes[Math.floor(Math.random() * jokes.length)] });
});

app.get("/api/free", (_req, res) => {
  res.json({ message: "This endpoint is free!", timestamp: Date.now() });
});

app.listen(4403, () => console.log("API on :4403"));
```

**Step 4: Copy .env from old react-demo (if values exist) or create fresh**

```bash
cp examples/react-demo/.env examples/servers/express/.env 2>/dev/null || cp examples/servers/express/.env.example examples/servers/express/.env
```

Note: This step happens before deletion in Task 2, or use the values from the old .env that was already read earlier:
```
FACILITATOR_PRIVATE_KEY=0xa596d50f8da618b4de7f9fab615f708966bcc51d3e5b183ae773eab00ea69f02
PAY_TO_ADDRESS=0x8d56E94a02F06320BDc68FAfE23DEc9Ad7463496
```

**Step 5: Install and verify**

```bash
npm install
npx turbo build --filter=@x402-ton/facilitator --filter=@x402-ton/scheme
```

**Step 6: Start server and test endpoints**

```bash
cd examples/servers/express && npm start &
sleep 3
curl -s http://localhost:4402/supported | jq .kinds
curl -s http://localhost:4403/api/free | jq .
curl -s -o /dev/null -w "%{http_code}" http://localhost:4403/api/weather
```

Expected:
- `/supported` returns kinds array with exact scheme
- `/api/free` returns 200 with JSON
- `/api/weather` returns 402

**Step 7: Commit**

```bash
git add examples/servers/express/
git commit -m "feat: add servers/express example matching base x402 pattern"
```

---

### Task 4: Create clients/fetch example

**Files:**
- Create: `examples/clients/fetch/package.json`
- Create: `examples/clients/fetch/.env.example`
- Create: `examples/clients/fetch/src/index.ts`

**Step 1: Create package.json**

`examples/clients/fetch/package.json`:
```json
{
  "name": "x402-ton-client-fetch",
  "private": true,
  "type": "module",
  "scripts": {
    "start": "node --env-file=.env --import=tsx src/index.ts"
  },
  "dependencies": {
    "@x402/core": "^2.5.0",
    "@x402/fetch": "^2.5.0",
    "@x402-ton/scheme": "*"
  },
  "devDependencies": {
    "tsx": "^4.0.0",
    "typescript": "^5.7.0",
    "viem": "^2.30.0"
  }
}
```

**Step 2: Create .env.example**

`examples/clients/fetch/.env.example`:
```
# Payer wallet private key (must hold USDC on Thanos Sepolia)
PRIVATE_KEY=0xYOUR_PRIVATE_KEY

# API server URL (default: http://localhost:4403)
API_URL=http://localhost:4403
```

**Step 3: Create src/index.ts**

`examples/clients/fetch/src/index.ts`:
```ts
import { x402Client } from "@x402/core/client";
import { wrapFetchWithPayment } from "@x402/fetch";
import { registerExactTonScheme } from "@x402-ton/scheme";
import { privateKeyToAccount } from "viem/accounts";

const privateKey = process.env.PRIVATE_KEY as `0x${string}`;
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

// 3. Hit a free endpoint (no payment needed)
console.log("\n--- Free endpoint ---");
const freeRes = await fetch(`${apiUrl}/api/free`);
console.log(`Status: ${freeRes.status}`);
console.log(await freeRes.json());

// 4. Hit a paid endpoint — payment is handled automatically
console.log("\n--- Paid endpoint ($0.10 USDC) ---");
const paidRes = await fetchWithPayment(`${apiUrl}/api/weather`);
console.log(`Status: ${paidRes.status}`);
console.log(await paidRes.json());

// 5. Hit another paid endpoint
console.log("\n--- Paid endpoint ($0.001 USDC) ---");
const jokeRes = await fetchWithPayment(`${apiUrl}/api/joke`);
console.log(`Status: ${jokeRes.status}`);
console.log(await jokeRes.json());
```

**Step 4: Create .env**

```bash
cat > examples/clients/fetch/.env << 'EOF'
PRIVATE_KEY=0xa596d50f8da618b4de7f9fab615f708966bcc51d3e5b183ae773eab00ea69f02
API_URL=http://localhost:4403
EOF
```

**Step 5: Install deps**

```bash
npm install
```

**Step 6: Test end-to-end (requires server from Task 3 running)**

```bash
cd examples/clients/fetch && npm start
```

Expected: Free endpoint returns 200, paid endpoints either succeed (if payer has USDC) or show payment flow errors (which proves the x402 machinery works).

**Step 7: Commit**

```bash
git add examples/clients/fetch/
git commit -m "feat: add clients/fetch example matching base x402 pattern"
```

---

### Task 5: Update root package.json workspaces

**Files:**
- Modify: `package.json` (root)

**Step 1: Update workspaces array**

Check current workspaces config and update to include the new nested example paths:

```json
{
  "workspaces": [
    "packages/*",
    "examples/clients/*",
    "examples/servers/*"
  ]
}
```

**Step 2: Install to resolve workspace links**

```bash
npm install
```
Expected: Clean install, no errors.

**Step 3: Full build**

```bash
npx turbo build --force
```
Expected: All buildable packages compile clean.

**Step 4: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: update workspaces for new examples structure"
```

---

### Task 6: Update root README examples section

**Files:**
- Modify: `README.md` (root)

**Step 1: Update the examples section**

Replace the examples section in the root README to reference the new structure:

```markdown
## Examples

### Server (seller)

```bash
cd examples/servers/express
cp .env.example .env   # add your keys
npm start              # starts facilitator + API on :4402/:4403
```

### Client (buyer)

```bash
cd examples/clients/fetch
cp .env.example .env   # add payer private key
npm start              # hits paid endpoints with automatic x402 payment
```

See [base x402](https://github.com/coinbase/x402) for the full protocol spec.
```

**Step 2: Commit**

```bash
git add README.md
git commit -m "docs: update README examples for base x402 alignment"
```

---

### Task 7: Smoke test the full flow

**Step 1: Kill any running servers**

```bash
lsof -ti :4402 -ti :4403 | xargs kill -9 2>/dev/null
```

**Step 2: Start the server example**

```bash
cd examples/servers/express && npm start &
sleep 3
```

**Step 3: Verify endpoints**

```bash
curl -s http://localhost:4402/supported | jq .kinds[0].scheme
curl -s http://localhost:4403/api/free | jq .message
curl -s -o /dev/null -w "%{http_code}" http://localhost:4403/api/weather
```

Expected: `"exact"`, `"This endpoint is free!"`, `402`

**Step 4: Run client example**

```bash
cd examples/clients/fetch && npm start
```

Expected: Free endpoint 200, paid endpoints attempt payment flow.

**Step 5: Kill servers**

```bash
lsof -ti :4402 -ti :4403 | xargs kill -9 2>/dev/null
```
