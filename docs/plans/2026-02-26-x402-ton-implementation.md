# x402-TON Implementation Plan

> **SUPERSEDED**: This plan was replaced by the USDC/EIP-3009 migration. See [2026-02-27-x402-usdc-migration-design.md](./2026-02-27-x402-usdc-migration-design.md) for the current design.

**Goal:** ~~Build a production-ready x402 payment platform using native TON on Thanos Sepolia with a pre-deposit facilitator contract, self-hosted facilitator service, server middleware, client SDK, CLI tool, and ERC-4337 gasless support.~~ *Superseded — now uses USDC with EIP-3009 transferWithAuthorization.*

**Architecture:** Pre-deposit model — clients deposit native TON into a `TonPaymentFacilitator` contract and sign EIP-712 messages authorizing payments. A self-hosted facilitator service verifies signatures (via on-chain `verify()` view call) and settles payments (calls `settle()` which deducts balance and forwards TON to `payTo`). Express middleware returns 402 with TON payment requirements; client SDK intercepts 402, signs authorization, retries. ERC-4337 gasless mode uses Dust Protocol's existing EntryPoint + DustPaymaster for users without gas.

**Tech Stack:** Solidity 0.8.20 (Foundry), TypeScript (viem, Express), npm workspaces monorepo, Thanos Sepolia (chainId 111551119090)

---

## Task 1: Scaffold Monorepo

**Files:**
- Create: `package.json` (workspace root)
- Create: `tsconfig.json` (root)
- Create: `tsconfig.base.json` (shared TS config)
- Create: `turbo.json` (build orchestration)
- Create: `.gitignore`
- Create: `.env.example`
- Create: `packages/common/package.json`
- Create: `packages/common/tsconfig.json`
- Create: `packages/facilitator/package.json`
- Create: `packages/facilitator/tsconfig.json`
- Create: `packages/server/package.json`
- Create: `packages/server/tsconfig.json`
- Create: `packages/client/package.json`
- Create: `packages/client/tsconfig.json`
- Create: `packages/cli/package.json`
- Create: `packages/cli/tsconfig.json`

**Step 1: Initialize git repo**

```bash
cd /Users/sahil/work/current/x402-ton
git init
```

**Step 2: Create root package.json**

```json
{
  "name": "x402-ton",
  "private": true,
  "workspaces": [
    "packages/*",
    "examples/*"
  ],
  "scripts": {
    "build": "turbo build",
    "clean": "turbo clean",
    "typecheck": "turbo typecheck"
  },
  "devDependencies": {
    "turbo": "^2.4.0",
    "typescript": "^5.7.0"
  }
}
```

**Step 3: Create tsconfig.base.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "outDir": "dist",
    "rootDir": "src"
  }
}
```

**Step 4: Create turbo.json**

```json
{
  "$schema": "https://turbo.build/schema.json",
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**"]
    },
    "typecheck": {
      "dependsOn": ["^build"]
    },
    "clean": {
      "cache": false
    }
  }
}
```

**Step 5: Create .gitignore**

```
node_modules/
dist/
out/
cache/
.env
*.log
```

**Step 6: Create .env.example**

```
# Facilitator wallet (holds TON for gas, submits settle txs)
FACILITATOR_PRIVATE_KEY=0x...
# Thanos Sepolia RPC
RPC_URL=https://rpc.thanos-sepolia.tokamak.network
# Contract address (set after deployment)
FACILITATOR_CONTRACT=0x...
# Server port
FACILITATOR_PORT=4402
# Demo API port
DEMO_API_PORT=4403
```

**Step 7: Create each package's package.json and tsconfig.json**

`packages/common/package.json`:
```json
{
  "name": "@x402-ton/common",
  "version": "0.1.0",
  "type": "module",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "scripts": {
    "build": "tsc",
    "typecheck": "tsc --noEmit",
    "clean": "rm -rf dist"
  },
  "dependencies": {
    "viem": "^2.30.0"
  }
}
```

`packages/facilitator/package.json`:
```json
{
  "name": "@x402-ton/facilitator",
  "version": "0.1.0",
  "type": "module",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "scripts": {
    "build": "tsc",
    "start": "node dist/index.js",
    "dev": "tsx src/index.ts",
    "typecheck": "tsc --noEmit",
    "clean": "rm -rf dist"
  },
  "dependencies": {
    "@x402-ton/common": "workspace:*",
    "express": "^4.21.0",
    "viem": "^2.30.0"
  },
  "devDependencies": {
    "@types/express": "^5.0.0",
    "tsx": "^4.0.0"
  }
}
```

`packages/server/package.json`:
```json
{
  "name": "@x402-ton/server",
  "version": "0.1.0",
  "type": "module",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "scripts": {
    "build": "tsc",
    "typecheck": "tsc --noEmit",
    "clean": "rm -rf dist"
  },
  "dependencies": {
    "@x402-ton/common": "workspace:*",
    "viem": "^2.30.0"
  }
}
```

`packages/client/package.json`:
```json
{
  "name": "@x402-ton/client",
  "version": "0.1.0",
  "type": "module",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "scripts": {
    "build": "tsc",
    "typecheck": "tsc --noEmit",
    "clean": "rm -rf dist"
  },
  "dependencies": {
    "@x402-ton/common": "workspace:*",
    "viem": "^2.30.0"
  }
}
```

`packages/cli/package.json`:
```json
{
  "name": "@x402-ton/cli",
  "version": "0.1.0",
  "type": "module",
  "bin": { "x402-ton": "dist/index.js" },
  "scripts": {
    "build": "tsc",
    "typecheck": "tsc --noEmit",
    "clean": "rm -rf dist"
  },
  "dependencies": {
    "@x402-ton/client": "workspace:*",
    "@x402-ton/common": "workspace:*",
    "viem": "^2.30.0"
  }
}
```

Each package gets a `tsconfig.json`:
```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src"]
}
```

**Step 8: Create placeholder src/index.ts in each package**

Each: `export {};`

**Step 9: Install dependencies**

```bash
cd /Users/sahil/work/current/x402-ton
npm install
```

**Step 10: Verify build**

```bash
npx turbo build
```
Expected: all 5 packages build successfully.

**Step 11: Commit**

```bash
git add -A
git commit -m "chore: scaffold x402-ton monorepo with npm workspaces"
```

---

## Task 2: Smart Contract — TonPaymentFacilitator

**Files:**
- Create: `contracts/foundry.toml`
- Create: `contracts/src/TonPaymentFacilitator.sol`
- Create: `contracts/test/TonPaymentFacilitator.t.sol`
- Create: `contracts/script/Deploy.s.sol`

**Step 1: Initialize Foundry project**

```bash
cd /Users/sahil/work/current/x402-ton
mkdir -p contracts/src contracts/test contracts/script
cd contracts
forge init --no-git --no-commit
forge install foundry-rs/forge-std --no-git --no-commit
forge install OpenZeppelin/openzeppelin-contracts --no-git --no-commit
```

**Step 2: Create foundry.toml**

```toml
[profile.default]
src = "src"
out = "out"
libs = ["lib"]
solc = "0.8.20"
optimizer = true
optimizer_runs = 200
remappings = [
  "@openzeppelin/contracts/=lib/openzeppelin-contracts/contracts/",
  "forge-std/=lib/forge-std/src/"
]

[rpc_endpoints]
thanos_sepolia = "https://rpc.thanos-sepolia.tokamak.network"
```

**Step 3: Write TonPaymentFacilitator.sol**

```solidity
// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {EIP712} from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/security/ReentrancyGuard.sol";

contract TonPaymentFacilitator is EIP712, ReentrancyGuard {
    using ECDSA for bytes32;

    bytes32 public constant PAYMENT_AUTH_TYPEHASH = keccak256(
        "PaymentAuth(address from,address to,uint256 amount,uint256 deadline,bytes32 nonce)"
    );

    mapping(bytes32 => bool) public usedNonces;
    mapping(address => uint256) public balances;

    event Deposited(address indexed account, uint256 amount);
    event Withdrawn(address indexed account, uint256 amount);
    event PaymentSettled(
        address indexed from,
        address indexed to,
        uint256 amount,
        bytes32 indexed nonce
    );

    error Expired();
    error NonceUsed();
    error InsufficientBalance();
    error InvalidSignature();
    error TransferFailed();
    error ZeroAmount();

    constructor() EIP712("x402-TON Payment Facilitator", "1") {}

    function deposit() external payable {
        if (msg.value == 0) revert ZeroAmount();
        balances[msg.sender] += msg.value;
        emit Deposited(msg.sender, msg.value);
    }

    function withdraw(uint256 amount) external nonReentrant {
        if (balances[msg.sender] < amount) revert InsufficientBalance();
        balances[msg.sender] -= amount;
        (bool ok, ) = msg.sender.call{value: amount}("");
        if (!ok) revert TransferFailed();
        emit Withdrawn(msg.sender, amount);
    }

    function settle(
        address from,
        address to,
        uint256 amount,
        uint256 deadline,
        bytes32 nonce,
        bytes calldata signature
    ) external nonReentrant {
        if (block.timestamp > deadline) revert Expired();
        if (usedNonces[nonce]) revert NonceUsed();
        if (balances[from] < amount) revert InsufficientBalance();
        if (amount == 0) revert ZeroAmount();

        bytes32 structHash = keccak256(abi.encode(
            PAYMENT_AUTH_TYPEHASH, from, to, amount, deadline, nonce
        ));
        bytes32 digest = _hashTypedDataV4(structHash);
        address signer = digest.recover(signature);
        if (signer != from) revert InvalidSignature();

        usedNonces[nonce] = true;
        balances[from] -= amount;

        (bool ok, ) = to.call{value: amount}("");
        if (!ok) revert TransferFailed();

        emit PaymentSettled(from, to, amount, nonce);
    }

    function verify(
        address from,
        address to,
        uint256 amount,
        uint256 deadline,
        bytes32 nonce,
        bytes calldata signature
    ) external view returns (bool valid, string memory reason) {
        if (block.timestamp > deadline) return (false, "Expired");
        if (usedNonces[nonce]) return (false, "Nonce used");
        if (balances[from] < amount) return (false, "Insufficient balance");
        if (amount == 0) return (false, "Zero amount");

        bytes32 structHash = keccak256(abi.encode(
            PAYMENT_AUTH_TYPEHASH, from, to, amount, deadline, nonce
        ));
        bytes32 digest = _hashTypedDataV4(structHash);
        address signer = digest.recover(signature);
        if (signer != from) return (false, "Invalid signature");

        return (true, "");
    }

    function domainSeparator() external view returns (bytes32) {
        return _domainSeparatorV4();
    }

    receive() external payable {
        balances[msg.sender] += msg.value;
        emit Deposited(msg.sender, msg.value);
    }
}
```

**Step 4: Write comprehensive test suite**

```solidity
// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

import "forge-std/Test.sol";
import {TonPaymentFacilitator} from "../src/TonPaymentFacilitator.sol";

contract TonPaymentFacilitatorTest is Test {
    TonPaymentFacilitator facilitator;

    uint256 clientKey = 0xA11CE;
    address client;
    address server = makeAddr("server");

    bytes32 constant PAYMENT_AUTH_TYPEHASH = keccak256(
        "PaymentAuth(address from,address to,uint256 amount,uint256 deadline,bytes32 nonce)"
    );

    function setUp() public {
        client = vm.addr(clientKey);
        facilitator = new TonPaymentFacilitator();
        vm.deal(client, 100 ether);
    }

    function _sign(
        address from,
        address to,
        uint256 amount,
        uint256 deadline,
        bytes32 nonce,
        uint256 privateKey
    ) internal view returns (bytes memory) {
        bytes32 structHash = keccak256(abi.encode(
            PAYMENT_AUTH_TYPEHASH, from, to, amount, deadline, nonce
        ));
        bytes32 domainSep = facilitator.domainSeparator();
        bytes32 digest = keccak256(abi.encodePacked("\x19\x01", domainSep, structHash));
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(privateKey, digest);
        return abi.encodePacked(r, s, v);
    }

    // --- Deposit Tests ---

    function test_deposit() public {
        vm.prank(client);
        facilitator.deposit{value: 1 ether}();
        assertEq(facilitator.balances(client), 1 ether);
    }

    function test_deposit_via_receive() public {
        vm.prank(client);
        (bool ok, ) = address(facilitator).call{value: 1 ether}("");
        assertTrue(ok);
        assertEq(facilitator.balances(client), 1 ether);
    }

    function test_deposit_reverts_zero() public {
        vm.prank(client);
        vm.expectRevert(TonPaymentFacilitator.ZeroAmount.selector);
        facilitator.deposit{value: 0}();
    }

    function test_deposit_multiple() public {
        vm.startPrank(client);
        facilitator.deposit{value: 1 ether}();
        facilitator.deposit{value: 2 ether}();
        vm.stopPrank();
        assertEq(facilitator.balances(client), 3 ether);
    }

    // --- Withdraw Tests ---

    function test_withdraw() public {
        vm.prank(client);
        facilitator.deposit{value: 5 ether}();

        uint256 balBefore = client.balance;
        vm.prank(client);
        facilitator.withdraw(3 ether);
        assertEq(client.balance, balBefore + 3 ether);
        assertEq(facilitator.balances(client), 2 ether);
    }

    function test_withdraw_insufficient() public {
        vm.prank(client);
        facilitator.deposit{value: 1 ether}();

        vm.prank(client);
        vm.expectRevert(TonPaymentFacilitator.InsufficientBalance.selector);
        facilitator.withdraw(2 ether);
    }

    // --- Settle Tests ---

    function test_settle_happy_path() public {
        vm.prank(client);
        facilitator.deposit{value: 1 ether}();

        uint256 deadline = block.timestamp + 60;
        bytes32 nonce = keccak256("nonce1");
        bytes memory sig = _sign(client, server, 0.5 ether, deadline, nonce, clientKey);

        uint256 serverBalBefore = server.balance;
        facilitator.settle(client, server, 0.5 ether, deadline, nonce, sig);

        assertEq(facilitator.balances(client), 0.5 ether);
        assertEq(server.balance, serverBalBefore + 0.5 ether);
        assertTrue(facilitator.usedNonces(nonce));
    }

    function test_settle_expired() public {
        vm.prank(client);
        facilitator.deposit{value: 1 ether}();

        uint256 deadline = block.timestamp - 1;
        bytes32 nonce = keccak256("nonce2");
        bytes memory sig = _sign(client, server, 0.5 ether, deadline, nonce, clientKey);

        vm.expectRevert(TonPaymentFacilitator.Expired.selector);
        facilitator.settle(client, server, 0.5 ether, deadline, nonce, sig);
    }

    function test_settle_replay() public {
        vm.prank(client);
        facilitator.deposit{value: 2 ether}();

        uint256 deadline = block.timestamp + 60;
        bytes32 nonce = keccak256("nonce3");
        bytes memory sig = _sign(client, server, 0.5 ether, deadline, nonce, clientKey);

        facilitator.settle(client, server, 0.5 ether, deadline, nonce, sig);

        vm.expectRevert(TonPaymentFacilitator.NonceUsed.selector);
        facilitator.settle(client, server, 0.5 ether, deadline, nonce, sig);
    }

    function test_settle_insufficient_balance() public {
        vm.prank(client);
        facilitator.deposit{value: 0.1 ether}();

        uint256 deadline = block.timestamp + 60;
        bytes32 nonce = keccak256("nonce4");
        bytes memory sig = _sign(client, server, 1 ether, deadline, nonce, clientKey);

        vm.expectRevert(TonPaymentFacilitator.InsufficientBalance.selector);
        facilitator.settle(client, server, 1 ether, deadline, nonce, sig);
    }

    function test_settle_wrong_signer() public {
        vm.prank(client);
        facilitator.deposit{value: 1 ether}();

        uint256 deadline = block.timestamp + 60;
        bytes32 nonce = keccak256("nonce5");
        uint256 wrongKey = 0xBAD;
        bytes memory sig = _sign(client, server, 0.5 ether, deadline, nonce, wrongKey);

        vm.expectRevert(TonPaymentFacilitator.InvalidSignature.selector);
        facilitator.settle(client, server, 0.5 ether, deadline, nonce, sig);
    }

    function test_settle_zero_amount() public {
        vm.prank(client);
        facilitator.deposit{value: 1 ether}();

        uint256 deadline = block.timestamp + 60;
        bytes32 nonce = keccak256("nonce6");
        bytes memory sig = _sign(client, server, 0, deadline, nonce, clientKey);

        vm.expectRevert(TonPaymentFacilitator.ZeroAmount.selector);
        facilitator.settle(client, server, 0, deadline, nonce, sig);
    }

    // --- Verify Tests ---

    function test_verify_valid() public {
        vm.prank(client);
        facilitator.deposit{value: 1 ether}();

        uint256 deadline = block.timestamp + 60;
        bytes32 nonce = keccak256("nonce7");
        bytes memory sig = _sign(client, server, 0.5 ether, deadline, nonce, clientKey);

        (bool valid, string memory reason) = facilitator.verify(
            client, server, 0.5 ether, deadline, nonce, sig
        );
        assertTrue(valid);
        assertEq(reason, "");
    }

    function test_verify_expired() public {
        vm.prank(client);
        facilitator.deposit{value: 1 ether}();

        uint256 deadline = block.timestamp - 1;
        bytes32 nonce = keccak256("nonce8");
        bytes memory sig = _sign(client, server, 0.5 ether, deadline, nonce, clientKey);

        (bool valid, string memory reason) = facilitator.verify(
            client, server, 0.5 ether, deadline, nonce, sig
        );
        assertFalse(valid);
        assertEq(reason, "Expired");
    }

    function test_verify_used_nonce() public {
        vm.prank(client);
        facilitator.deposit{value: 2 ether}();

        uint256 deadline = block.timestamp + 60;
        bytes32 nonce = keccak256("nonce9");
        bytes memory sig = _sign(client, server, 0.5 ether, deadline, nonce, clientKey);

        facilitator.settle(client, server, 0.5 ether, deadline, nonce, sig);

        (bool valid, string memory reason) = facilitator.verify(
            client, server, 0.5 ether, deadline, nonce, sig
        );
        assertFalse(valid);
        assertEq(reason, "Nonce used");
    }

    function test_verify_insufficient() public {
        uint256 deadline = block.timestamp + 60;
        bytes32 nonce = keccak256("nonce10");
        bytes memory sig = _sign(client, server, 1 ether, deadline, nonce, clientKey);

        (bool valid, string memory reason) = facilitator.verify(
            client, server, 1 ether, deadline, nonce, sig
        );
        assertFalse(valid);
        assertEq(reason, "Insufficient balance");
    }

    // --- Reentrancy Test ---

    function test_settle_reentrancy() public {
        ReentrantReceiver attacker = new ReentrantReceiver(facilitator);
        vm.prank(client);
        facilitator.deposit{value: 2 ether}();

        uint256 deadline = block.timestamp + 60;
        bytes32 nonce = keccak256("nonce11");
        bytes memory sig = _sign(
            client, address(attacker), 1 ether, deadline, nonce, clientKey
        );

        facilitator.settle(client, address(attacker), 1 ether, deadline, nonce, sig);
        assertEq(facilitator.balances(client), 1 ether);
        assertEq(address(attacker).balance, 1 ether);
        assertFalse(attacker.reentered());
    }

    // --- Fuzz Tests ---

    function testFuzz_deposit_withdraw(uint96 amount) public {
        vm.assume(amount > 0);
        vm.deal(client, uint256(amount));
        vm.prank(client);
        facilitator.deposit{value: amount}();
        assertEq(facilitator.balances(client), amount);

        vm.prank(client);
        facilitator.withdraw(amount);
        assertEq(facilitator.balances(client), 0);
    }
}

contract ReentrantReceiver {
    TonPaymentFacilitator immutable target;
    bool public reentered;

    constructor(TonPaymentFacilitator _target) {
        target = _target;
    }

    receive() external payable {
        if (!reentered) {
            reentered = true;
            try target.withdraw(0.1 ether) {} catch {}
            reentered = false;
        }
    }
}
```

**Step 5: Run tests**

```bash
cd /Users/sahil/work/current/x402-ton/contracts
forge test -vvv
```
Expected: all tests pass.

**Step 6: Commit**

```bash
cd /Users/sahil/work/current/x402-ton
git add contracts/
git commit -m "feat: TonPaymentFacilitator contract with full test suite"
```

---

## Task 3: Common Package — Types, EIP-712, Chain Config

**Files:**
- Create: `packages/common/src/types.ts`
- Create: `packages/common/src/eip712.ts`
- Create: `packages/common/src/chain.ts`
- Create: `packages/common/src/abi.ts`
- Create: `packages/common/src/index.ts`

**Step 1: Create types.ts**

All shared types for the protocol: `PaymentRequirement`, `PaymentAuthorization`, `PaymentPayload`, `PaymentRequired`, `SettlementResponse`, `VerifyResponse`.

```typescript
export interface PaymentRequirement {
  scheme: "exact-ton";
  network: string;              // CAIP-2: "eip155:111551119090"
  maxAmountRequired: string;    // wei string (18 decimals)
  resource: string;             // URL path
  description: string;
  mimeType: string;
  payTo: `0x${string}`;        // recipient address
  maxTimeoutSeconds: number;
  asset: "native";              // native TON
  extra?: Record<string, unknown>;
}

export interface PaymentRequired {
  version: 2;
  accepts: PaymentRequirement[];
}

export interface PaymentAuthorization {
  from: `0x${string}`;
  to: `0x${string}`;
  amount: string;               // wei string
  deadline: string;             // unix timestamp string
  nonce: `0x${string}`;        // bytes32 hex
}

export interface PaymentPayload {
  x402Version: 2;
  scheme: "exact-ton";
  network: string;
  payload: {
    signature: `0x${string}`;
    authorization: PaymentAuthorization;
  };
}

export interface VerifyRequest {
  paymentPayload: PaymentPayload;
  paymentRequirements: PaymentRequirement;
}

export interface VerifyResponse {
  isValid: boolean;
  invalidReason?: string;
  payer?: `0x${string}`;
}

export interface SettleRequest {
  paymentPayload: PaymentPayload;
  paymentRequirements: PaymentRequirement;
}

export interface SettlementResponse {
  success: boolean;
  payer?: `0x${string}`;
  transaction?: `0x${string}`;
  network: string;
  errorReason?: string;
}
```

**Step 2: Create eip712.ts**

EIP-712 domain and types matching the Solidity contract exactly.

```typescript
import { type TypedDataDomain } from "viem";

export const PAYMENT_AUTH_TYPES = {
  PaymentAuth: [
    { name: "from", type: "address" },
    { name: "to", type: "address" },
    { name: "amount", type: "uint256" },
    { name: "deadline", type: "uint256" },
    { name: "nonce", type: "bytes32" },
  ],
} as const;

export function getFacilitatorDomain(
  contractAddress: `0x${string}`,
  chainId: number
): TypedDataDomain {
  return {
    name: "x402-TON Payment Facilitator",
    version: "1",
    chainId: BigInt(chainId),
    verifyingContract: contractAddress,
  };
}
```

**Step 3: Create chain.ts**

```typescript
import { defineChain } from "viem";

export const thanosSepolia = defineChain({
  id: 111551119090,
  name: "Thanos Sepolia",
  nativeCurrency: {
    name: "TON",
    symbol: "TON",
    decimals: 18,
  },
  rpcUrls: {
    default: {
      http: ["https://rpc.thanos-sepolia.tokamak.network"],
      webSocket: ["wss://rpc.thanos-sepolia.tokamak.network"],
    },
  },
  blockExplorers: {
    default: {
      name: "Blockscout",
      url: "https://explorer.thanos-sepolia.tokamak.network",
    },
  },
  testnet: true,
});

export const CAIP2_THANOS_SEPOLIA = "eip155:111551119090";

export const CONTRACTS = {
  facilitator: "0x0000000000000000000000000000000000000000" as `0x${string}`,
  entryPoint: "0x5c058Eb93CDee95d72398E5441d989ef6453D038" as `0x${string}`,
  paymaster: "0x9e2eb36F7161C066351DC9E418E7a0620EE5d095" as `0x${string}`,
} as const;

export function setFacilitatorAddress(address: `0x${string}`) {
  (CONTRACTS as any).facilitator = address;
}
```

**Step 4: Create abi.ts**

ABI for TonPaymentFacilitator (extracted from Foundry output after Task 2).

```typescript
export const FACILITATOR_ABI = [
  {
    type: "function",
    name: "deposit",
    inputs: [],
    outputs: [],
    stateMutability: "payable",
  },
  {
    type: "function",
    name: "withdraw",
    inputs: [{ name: "amount", type: "uint256" }],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "settle",
    inputs: [
      { name: "from", type: "address" },
      { name: "to", type: "address" },
      { name: "amount", type: "uint256" },
      { name: "deadline", type: "uint256" },
      { name: "nonce", type: "bytes32" },
      { name: "signature", type: "bytes" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "verify",
    inputs: [
      { name: "from", type: "address" },
      { name: "to", type: "address" },
      { name: "amount", type: "uint256" },
      { name: "deadline", type: "uint256" },
      { name: "nonce", type: "bytes32" },
      { name: "signature", type: "bytes" },
    ],
    outputs: [
      { name: "valid", type: "bool" },
      { name: "reason", type: "string" },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "balances",
    inputs: [{ name: "", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "usedNonces",
    inputs: [{ name: "", type: "bytes32" }],
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "domainSeparator",
    inputs: [],
    outputs: [{ name: "", type: "bytes32" }],
    stateMutability: "view",
  },
  {
    type: "event",
    name: "Deposited",
    inputs: [
      { name: "account", type: "address", indexed: true },
      { name: "amount", type: "uint256", indexed: false },
    ],
  },
  {
    type: "event",
    name: "Withdrawn",
    inputs: [
      { name: "account", type: "address", indexed: true },
      { name: "amount", type: "uint256", indexed: false },
    ],
  },
  {
    type: "event",
    name: "PaymentSettled",
    inputs: [
      { name: "from", type: "address", indexed: true },
      { name: "to", type: "address", indexed: true },
      { name: "amount", type: "uint256", indexed: false },
      { name: "nonce", type: "bytes32", indexed: true },
    ],
  },
  { type: "receive", stateMutability: "payable" },
] as const;
```

**Step 5: Create index.ts**

```typescript
export * from "./types.js";
export * from "./eip712.js";
export * from "./chain.js";
export * from "./abi.js";
```

**Step 6: Build and verify**

```bash
cd /Users/sahil/work/current/x402-ton
npx turbo build --filter=@x402-ton/common
```
Expected: builds cleanly, no TS errors.

**Step 7: Commit**

```bash
git add packages/common/
git commit -m "feat: common package with types, EIP-712, chain config, ABI"
```

---

## Task 4: Client SDK — EIP-712 Signing + Fetch Wrapper

**Files:**
- Create: `packages/client/src/signer.ts`
- Create: `packages/client/src/deposit.ts`
- Create: `packages/client/src/fetch.ts`
- Create: `packages/client/src/index.ts`

**Step 1: Create signer.ts**

Signs EIP-712 PaymentAuth messages using viem wallet client.

```typescript
import {
  type Account,
  type WalletClient,
  type Transport,
  type Chain,
  generatePrivateKey,
  privateKeyToAccount,
} from "viem";
import {
  type PaymentAuthorization,
  type PaymentPayload,
  type PaymentRequirement,
  PAYMENT_AUTH_TYPES,
  getFacilitatorDomain,
  CONTRACTS,
  thanosSepolia,
} from "@x402-ton/common";

export interface SignerConfig {
  account: Account;
  facilitatorAddress?: `0x${string}`;
  chainId?: number;
}

export async function signPayment(
  config: SignerConfig,
  requirement: PaymentRequirement
): Promise<PaymentPayload> {
  const facilitatorAddr = config.facilitatorAddress ?? CONTRACTS.facilitator;
  const chainId = config.chainId ?? thanosSepolia.id;

  const nonce = `0x${Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString("hex")}` as `0x${string}`;
  const deadline = String(Math.floor(Date.now() / 1000) + requirement.maxTimeoutSeconds);

  const domain = getFacilitatorDomain(facilitatorAddr, chainId);

  const authorization: PaymentAuthorization = {
    from: config.account.address,
    to: requirement.payTo,
    amount: requirement.maxAmountRequired,
    deadline,
    nonce,
  };

  const signature = await config.account.signTypedData({
    domain,
    types: PAYMENT_AUTH_TYPES,
    primaryType: "PaymentAuth",
    message: {
      from: authorization.from,
      to: authorization.to,
      amount: BigInt(authorization.amount),
      deadline: BigInt(authorization.deadline),
      nonce: authorization.nonce,
    },
  });

  return {
    x402Version: 2,
    scheme: "exact-ton",
    network: requirement.network,
    payload: { signature, authorization },
  };
}
```

**Step 2: Create deposit.ts**

Manages deposits into the facilitator contract.

```typescript
import {
  type PublicClient,
  type WalletClient,
  type Account,
  type Transport,
  type Chain,
  parseEther,
  formatEther,
} from "viem";
import { FACILITATOR_ABI, CONTRACTS } from "@x402-ton/common";

export async function getBalance(
  publicClient: PublicClient,
  account: `0x${string}`,
  facilitatorAddress?: `0x${string}`
): Promise<bigint> {
  return publicClient.readContract({
    address: facilitatorAddress ?? CONTRACTS.facilitator,
    abi: FACILITATOR_ABI,
    functionName: "balances",
    args: [account],
  }) as Promise<bigint>;
}

export async function deposit(
  walletClient: WalletClient<Transport, Chain, Account>,
  amount: bigint,
  facilitatorAddress?: `0x${string}`
): Promise<`0x${string}`> {
  return walletClient.writeContract({
    address: facilitatorAddress ?? CONTRACTS.facilitator,
    abi: FACILITATOR_ABI,
    functionName: "deposit",
    value: amount,
  });
}

export async function withdraw(
  walletClient: WalletClient<Transport, Chain, Account>,
  amount: bigint,
  facilitatorAddress?: `0x${string}`
): Promise<`0x${string}`> {
  return walletClient.writeContract({
    address: facilitatorAddress ?? CONTRACTS.facilitator,
    abi: FACILITATOR_ABI,
    functionName: "withdraw",
    args: [amount],
  });
}

export async function ensureBalance(
  publicClient: PublicClient,
  walletClient: WalletClient<Transport, Chain, Account>,
  requiredAmount: bigint,
  facilitatorAddress?: `0x${string}`
): Promise<`0x${string}` | null> {
  const current = await getBalance(
    publicClient,
    walletClient.account.address,
    facilitatorAddress
  );
  if (current >= requiredAmount) return null;

  const deficit = requiredAmount - current;
  return deposit(walletClient, deficit, facilitatorAddress);
}
```

**Step 3: Create fetch.ts**

Wraps native fetch to intercept 402 responses and auto-pay.

```typescript
import { type Account, type PublicClient, type WalletClient, type Transport, type Chain } from "viem";
import {
  type PaymentRequired,
  type PaymentPayload,
  type PaymentRequirement,
} from "@x402-ton/common";
import { signPayment, type SignerConfig } from "./signer.js";
import { ensureBalance } from "./deposit.js";

export interface X402TonClientConfig {
  account: Account;
  publicClient: PublicClient;
  walletClient: WalletClient<Transport, Chain, Account>;
  facilitatorAddress?: `0x${string}`;
  chainId?: number;
  autoDeposit?: boolean;
}

export function createX402TonFetch(config: X402TonClientConfig) {
  const signerConfig: SignerConfig = {
    account: config.account,
    facilitatorAddress: config.facilitatorAddress,
    chainId: config.chainId,
  };

  return async function x402Fetch(
    input: RequestInfo | URL,
    init?: RequestInit
  ): Promise<Response> {
    const response = await fetch(input, init);

    if (response.status !== 402) return response;

    const paymentRequiredHeader = response.headers.get("payment-required");
    if (!paymentRequiredHeader) return response;

    const paymentRequired: PaymentRequired = JSON.parse(
      Buffer.from(paymentRequiredHeader, "base64").toString("utf-8")
    );

    const requirement = paymentRequired.accepts.find(
      (r) => r.scheme === "exact-ton"
    );
    if (!requirement) return response;

    if (config.autoDeposit) {
      await ensureBalance(
        config.publicClient,
        config.walletClient,
        BigInt(requirement.maxAmountRequired),
        config.facilitatorAddress
      );
    }

    const payload = await signPayment(signerConfig, requirement);
    const paymentHeader = Buffer.from(JSON.stringify(payload)).toString("base64");

    return fetch(input, {
      ...init,
      headers: {
        ...init?.headers,
        "payment-signature": paymentHeader,
      },
    });
  };
}
```

**Step 4: Create index.ts**

```typescript
export { signPayment, type SignerConfig } from "./signer.js";
export { getBalance, deposit, withdraw, ensureBalance } from "./deposit.js";
export { createX402TonFetch, type X402TonClientConfig } from "./fetch.js";
```

**Step 5: Build**

```bash
npx turbo build --filter=@x402-ton/client
```

**Step 6: Commit**

```bash
git add packages/client/
git commit -m "feat: client SDK with EIP-712 signing, deposit management, fetch wrapper"
```

---

## Task 5: Server Middleware — Express 402 Gating

**Files:**
- Create: `packages/server/src/middleware.ts`
- Create: `packages/server/src/index.ts`

**Step 1: Create middleware.ts**

Express middleware that returns 402 for gated routes and verifies payment signatures.

```typescript
import { type Request, type Response, type NextFunction } from "express";
import {
  type PaymentRequired,
  type PaymentPayload,
  type PaymentRequirement,
  type VerifyResponse,
  type SettlementResponse,
  CAIP2_THANOS_SEPOLIA,
} from "@x402-ton/common";

export interface RouteConfig {
  price: string;
  payTo: `0x${string}`;
  description?: string;
  mimeType?: string;
  maxTimeoutSeconds?: number;
}

export interface MiddlewareConfig {
  routes: Record<string, RouteConfig>;
  facilitatorUrl: string;
  network?: string;
}

function matchRoute(method: string, path: string, routes: Record<string, RouteConfig>): RouteConfig | null {
  const key = `${method.toUpperCase()} ${path}`;
  for (const [pattern, config] of Object.entries(routes)) {
    const regex = new RegExp(
      "^" + pattern.replace(/\[(\w+)\]/g, "[^/]+") + "$"
    );
    if (regex.test(key)) return config;
  }
  return null;
}

export function paymentMiddleware(config: MiddlewareConfig) {
  const network = config.network ?? CAIP2_THANOS_SEPOLIA;

  return async (req: Request, res: Response, next: NextFunction) => {
    const route = matchRoute(req.method, req.path, config.routes);
    if (!route) return next();

    const paymentHeader = req.headers["payment-signature"] as string | undefined;

    if (!paymentHeader) {
      const requirement: PaymentRequirement = {
        scheme: "exact-ton",
        network,
        maxAmountRequired: route.price,
        resource: req.originalUrl,
        description: route.description ?? "",
        mimeType: route.mimeType ?? "application/json",
        payTo: route.payTo,
        maxTimeoutSeconds: route.maxTimeoutSeconds ?? 60,
        asset: "native",
      };

      const paymentRequired: PaymentRequired = {
        version: 2,
        accepts: [requirement],
      };

      const encoded = Buffer.from(JSON.stringify(paymentRequired)).toString("base64");
      res.status(402).set("payment-required", encoded).json({
        error: "Payment Required",
        message: "This resource requires TON payment",
      });
      return;
    }

    let payload: PaymentPayload;
    try {
      payload = JSON.parse(Buffer.from(paymentHeader, "base64").toString("utf-8"));
    } catch {
      res.status(400).json({ error: "Invalid payment header" });
      return;
    }

    try {
      const verifyRes = await fetch(`${config.facilitatorUrl}/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          paymentPayload: payload,
          paymentRequirements: {
            scheme: "exact-ton",
            network,
            maxAmountRequired: route.price,
            payTo: route.payTo,
            asset: "native",
          },
        }),
      });

      const verify: VerifyResponse = await verifyRes.json();
      if (!verify.isValid) {
        res.status(402).json({
          error: "Payment verification failed",
          reason: verify.invalidReason,
        });
        return;
      }

      (req as any).x402Payer = verify.payer;
    } catch (err) {
      res.status(502).json({ error: "Facilitator unreachable" });
      return;
    }

    const originalJson = res.json.bind(res);
    res.json = function (body: any) {
      // Settle payment after successful response
      fetch(`${config.facilitatorUrl}/settle`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          paymentPayload: payload,
          paymentRequirements: {
            scheme: "exact-ton",
            network,
            maxAmountRequired: route.price,
            payTo: route.payTo,
            asset: "native",
          },
        }),
      })
        .then((r) => r.json())
        .then((settlement: SettlementResponse) => {
          if (settlement.success && settlement.transaction) {
            res.set(
              "payment-response",
              Buffer.from(JSON.stringify(settlement)).toString("base64")
            );
          }
        })
        .catch(() => {});

      return originalJson(body);
    } as any;

    next();
  };
}
```

**Step 2: Create index.ts**

```typescript
export { paymentMiddleware, type RouteConfig, type MiddlewareConfig } from "./middleware.js";
```

**Step 3: Add express types dependency**

```bash
cd /Users/sahil/work/current/x402-ton/packages/server
npm install express
npm install -D @types/express
```

**Step 4: Build**

```bash
npx turbo build --filter=@x402-ton/server
```

**Step 5: Commit**

```bash
git add packages/server/
git commit -m "feat: server middleware with 402 gating and facilitator integration"
```

---

## Task 6: Facilitator Service — Verify + Settle Endpoints

**Files:**
- Create: `packages/facilitator/src/server.ts`
- Create: `packages/facilitator/src/verify.ts`
- Create: `packages/facilitator/src/settle.ts`
- Create: `packages/facilitator/src/index.ts`

**Step 1: Create verify.ts**

Calls the on-chain `verify()` view function. No gas cost.

```typescript
import { type PublicClient } from "viem";
import {
  type VerifyRequest,
  type VerifyResponse,
  FACILITATOR_ABI,
} from "@x402-ton/common";

export async function verifyPayment(
  publicClient: PublicClient,
  facilitatorAddress: `0x${string}`,
  request: VerifyRequest
): Promise<VerifyResponse> {
  const { authorization, signature } = request.paymentPayload.payload;
  const requirement = request.paymentRequirements;

  if (BigInt(authorization.amount) < BigInt(requirement.maxAmountRequired)) {
    return { isValid: false, invalidReason: "Amount too low" };
  }
  if (authorization.to.toLowerCase() !== requirement.payTo.toLowerCase()) {
    return { isValid: false, invalidReason: "Wrong recipient" };
  }

  const [valid, reason] = (await publicClient.readContract({
    address: facilitatorAddress,
    abi: FACILITATOR_ABI,
    functionName: "verify",
    args: [
      authorization.from,
      authorization.to,
      BigInt(authorization.amount),
      BigInt(authorization.deadline),
      authorization.nonce,
      signature,
    ],
  })) as [boolean, string];

  return {
    isValid: valid,
    invalidReason: valid ? undefined : reason,
    payer: valid ? authorization.from : undefined,
  };
}
```

**Step 2: Create settle.ts**

Submits on-chain `settle()` tx. Facilitator wallet pays gas.

```typescript
import { type PublicClient, type WalletClient, type Account, type Transport, type Chain } from "viem";
import {
  type SettleRequest,
  type SettlementResponse,
  FACILITATOR_ABI,
  CAIP2_THANOS_SEPOLIA,
} from "@x402-ton/common";

export async function settlePayment(
  publicClient: PublicClient,
  walletClient: WalletClient<Transport, Chain, Account>,
  facilitatorAddress: `0x${string}`,
  request: SettleRequest
): Promise<SettlementResponse> {
  const { authorization, signature } = request.paymentPayload.payload;

  try {
    const hash = await walletClient.writeContract({
      address: facilitatorAddress,
      abi: FACILITATOR_ABI,
      functionName: "settle",
      args: [
        authorization.from,
        authorization.to,
        BigInt(authorization.amount),
        BigInt(authorization.deadline),
        authorization.nonce,
        signature,
      ],
    });

    const receipt = await publicClient.waitForTransactionReceipt({ hash });

    if (receipt.status === "reverted") {
      return {
        success: false,
        network: CAIP2_THANOS_SEPOLIA,
        errorReason: "Transaction reverted",
      };
    }

    return {
      success: true,
      payer: authorization.from,
      transaction: hash,
      network: CAIP2_THANOS_SEPOLIA,
    };
  } catch (err: any) {
    return {
      success: false,
      network: CAIP2_THANOS_SEPOLIA,
      errorReason: err.message ?? "Settlement failed",
    };
  }
}
```

**Step 3: Create server.ts**

Express service with `/verify` and `/settle` endpoints + health check.

```typescript
import express from "express";
import {
  createPublicClient,
  createWalletClient,
  http,
  type Account,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { thanosSepolia } from "@x402-ton/common";
import { verifyPayment } from "./verify.js";
import { settlePayment } from "./settle.js";

export interface FacilitatorServerConfig {
  privateKey: `0x${string}`;
  facilitatorAddress: `0x${string}`;
  port?: number;
}

export function createFacilitatorServer(config: FacilitatorServerConfig) {
  const account = privateKeyToAccount(config.privateKey);
  const publicClient = createPublicClient({
    chain: thanosSepolia,
    transport: http(),
  });
  const walletClient = createWalletClient({
    account,
    chain: thanosSepolia,
    transport: http(),
  });

  const app = express();
  app.use(express.json());

  app.get("/health", (_req, res) => {
    res.json({ status: "ok", address: account.address });
  });

  app.post("/verify", async (req, res) => {
    try {
      const result = await verifyPayment(
        publicClient,
        config.facilitatorAddress,
        req.body
      );
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ isValid: false, invalidReason: err.message });
    }
  });

  app.post("/settle", async (req, res) => {
    try {
      const result = await settlePayment(
        publicClient,
        walletClient,
        config.facilitatorAddress,
        req.body
      );
      res.json(result);
    } catch (err: any) {
      res.status(500).json({
        success: false,
        network: "eip155:111551119090",
        errorReason: err.message,
      });
    }
  });

  return app;
}
```

**Step 4: Create index.ts (entrypoint)**

```typescript
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
```

**Step 5: Build**

```bash
npx turbo build --filter=@x402-ton/facilitator
```

**Step 6: Commit**

```bash
git add packages/facilitator/
git commit -m "feat: self-hosted facilitator service with verify and settle endpoints"
```

---

## Task 7: CLI Tool

**Files:**
- Create: `packages/cli/src/index.ts`

**Step 1: Create CLI**

```typescript
#!/usr/bin/env node
import { parseEther, formatEther, createPublicClient, createWalletClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { thanosSepolia, CONTRACTS, setFacilitatorAddress } from "@x402-ton/common";
import { createX402TonFetch } from "@x402-ton/client";
import { deposit, getBalance } from "@x402-ton/client";

const [,, command, ...args] = process.argv;

async function main() {
  const privateKey = process.env.PRIVATE_KEY as `0x${string}`;
  if (!privateKey) {
    console.error("Set PRIVATE_KEY env var");
    process.exit(1);
  }

  const facilitatorAddr = process.env.FACILITATOR_CONTRACT as `0x${string}`;
  if (facilitatorAddr) setFacilitatorAddress(facilitatorAddr);

  const account = privateKeyToAccount(privateKey);
  const publicClient = createPublicClient({ chain: thanosSepolia, transport: http() });
  const walletClient = createWalletClient({ account, chain: thanosSepolia, transport: http() });

  switch (command) {
    case "balance": {
      const bal = await getBalance(publicClient, account.address, facilitatorAddr);
      console.log(`Facilitator balance: ${formatEther(bal)} TON`);
      const native = await publicClient.getBalance({ address: account.address });
      console.log(`Wallet balance: ${formatEther(native)} TON`);
      break;
    }

    case "deposit": {
      const amount = args[0] ?? "1";
      console.log(`Depositing ${amount} TON...`);
      const hash = await deposit(walletClient, parseEther(amount), facilitatorAddr);
      console.log(`TX: ${hash}`);
      break;
    }

    case "pay": {
      const url = args[0];
      if (!url) { console.error("Usage: x402-ton pay <url>"); process.exit(1); }

      const x402Fetch = createX402TonFetch({
        account, publicClient, walletClient,
        facilitatorAddress: facilitatorAddr,
        autoDeposit: true,
      });

      console.log(`Fetching ${url}...`);
      const res = await x402Fetch(url);
      const paymentResponse = res.headers.get("payment-response");
      if (paymentResponse) {
        const settlement = JSON.parse(Buffer.from(paymentResponse, "base64").toString());
        console.log(`Payment TX: ${settlement.transaction}`);
      }
      console.log(`Status: ${res.status}`);
      console.log(await res.text());
      break;
    }

    default:
      console.log("x402-ton CLI");
      console.log("  x402-ton balance              Check balances");
      console.log("  x402-ton deposit <amount>     Deposit TON");
      console.log("  x402-ton pay <url>            Fetch with x402 payment");
  }
}

main().catch(console.error);
```

**Step 2: Build**

```bash
npx turbo build --filter=@x402-ton/cli
```

**Step 3: Commit**

```bash
git add packages/cli/
git commit -m "feat: CLI tool for balance, deposit, and pay commands"
```

---

## Task 8: Demo API Server

**Files:**
- Create: `examples/demo-api/package.json`
- Create: `examples/demo-api/tsconfig.json`
- Create: `examples/demo-api/src/index.ts`

**Step 1: Create demo-api package**

`package.json`:
```json
{
  "name": "x402-ton-demo-api",
  "private": true,
  "type": "module",
  "scripts": {
    "build": "tsc",
    "start": "node dist/index.js",
    "dev": "tsx src/index.ts"
  },
  "dependencies": {
    "@x402-ton/common": "workspace:*",
    "@x402-ton/server": "workspace:*",
    "express": "^4.21.0"
  },
  "devDependencies": {
    "@types/express": "^5.0.0",
    "tsx": "^4.0.0"
  }
}
```

**Step 2: Create demo server**

```typescript
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
      "/api/weather": "0.001 TON — weather data",
      "/api/joke": "0.0001 TON — random joke",
      "/api/premium/:id": "0.01 TON — premium content",
      "/api/free": "free — no payment required",
    },
  });
});

app.get("/api/free", (_req, res) => {
  res.json({ message: "This endpoint is free!", timestamp: Date.now() });
});

app.get("/api/weather", (req, res) => {
  res.json({
    location: "Thanos Sepolia",
    temperature: "42°C",
    condition: "Powered by TON",
    payer: (req as any).x402Payer,
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

app.get("/api/premium/:id", (req, res) => {
  res.json({
    id: req.params.id,
    content: "Premium content unlocked via x402 TON payment",
    payer: (req as any).x402Payer,
  });
});

app.listen(port, () => {
  console.log(`x402-TON demo API on port ${port}`);
  console.log(`Facilitator: ${facilitatorUrl}`);
  console.log(`PayTo: ${payTo}`);
});
```

**Step 3: Build**

```bash
npx turbo build
```

**Step 4: Commit**

```bash
git add examples/
git commit -m "feat: demo API server with weather, joke, and premium endpoints"
```

---

## Task 9: Deploy Contract to Thanos Sepolia

**Files:**
- Create: `contracts/script/Deploy.s.sol`

**Step 1: Write deploy script**

```solidity
// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

import "forge-std/Script.sol";
import {TonPaymentFacilitator} from "../src/TonPaymentFacilitator.sol";

contract DeployScript is Script {
    function run() external {
        uint256 deployerKey = vm.envUint("PRIVATE_KEY");
        vm.startBroadcast(deployerKey);

        TonPaymentFacilitator facilitator = new TonPaymentFacilitator();
        console.log("TonPaymentFacilitator:", address(facilitator));

        vm.stopBroadcast();
    }
}
```

**Step 2: Simulate deployment (no --broadcast)**

```bash
cd /Users/sahil/work/current/x402-ton/contracts
PRIVATE_KEY=a596d50f8da618b4de7f9fab615f708966bcc51d3e5b183ae773eab00ea69f02 \
  forge script script/Deploy.s.sol --rpc-url https://rpc.thanos-sepolia.tokamak.network -vvv
```
Expected: successful simulation, shows deployed address.

**Step 3: Deploy with --broadcast --slow**

```bash
PRIVATE_KEY=a596d50f8da618b4de7f9fab615f708966bcc51d3e5b183ae773eab00ea69f02 \
  forge script script/Deploy.s.sol \
  --rpc-url https://rpc.thanos-sepolia.tokamak.network \
  --broadcast --slow -vvv
```

**Step 4: Verify on explorer**

```bash
forge verify-contract <DEPLOYED_ADDRESS> \
  src/TonPaymentFacilitator.sol:TonPaymentFacilitator \
  --chain-id 111551119090 \
  --verifier blockscout \
  --verifier-url https://explorer.thanos-sepolia.tokamak.network/api/
```

**Step 5: Update CONTRACTS.facilitator in packages/common/src/chain.ts**

Replace the zero address with the actual deployed address.

**Step 6: Commit**

```bash
git add contracts/script/ packages/common/src/chain.ts
git commit -m "feat: deploy TonPaymentFacilitator to Thanos Sepolia"
```

---

## Task 10: End-to-End Integration Test

**Step 1: Start facilitator service**

```bash
cd /Users/sahil/work/current/x402-ton
FACILITATOR_PRIVATE_KEY=0xa596d50f8da618b4de7f9fab615f708966bcc51d3e5b183ae773eab00ea69f02 \
FACILITATOR_CONTRACT=<deployed_address> \
npx tsx packages/facilitator/src/index.ts
```

**Step 2: Start demo API**

```bash
PAY_TO_ADDRESS=0x8d56E94a02F06320BDc68FAfE23DEc9Ad7463496 \
FACILITATOR_URL=http://localhost:4402 \
npx tsx examples/demo-api/src/index.ts
```

**Step 3: Test with CLI**

```bash
# Check balance
PRIVATE_KEY=0xa596d50f8da618b4de7f9fab615f708966bcc51d3e5b183ae773eab00ea69f02 \
FACILITATOR_CONTRACT=<deployed_address> \
npx tsx packages/cli/src/index.ts balance

# Deposit 1 TON
npx tsx packages/cli/src/index.ts deposit 1

# Hit paid endpoint
npx tsx packages/cli/src/index.ts pay http://localhost:4403/api/weather

# Hit free endpoint (should work without payment)
curl http://localhost:4403/api/free
```

**Step 4: Verify on-chain**

Check the explorer for PaymentSettled events on the facilitator contract.

**Step 5: Commit**

```bash
git add -A
git commit -m "chore: complete e2e integration verified on Thanos Sepolia"
```

---

## Task 11 (Optional): ERC-4337 Gasless Integration

**Files:**
- Create: `packages/facilitator/src/gasless.ts`
- Modify: `packages/facilitator/src/settle.ts`
- Modify: `packages/client/src/fetch.ts`

This task integrates with the existing Dust Protocol ERC-4337 infra (EntryPoint at `0x5c058...`, DustPaymaster at `0x9e2eb...`) to allow gasless settlement. The facilitator builds a UserOp with paymaster coverage instead of a direct tx.

**Implementation**: Same pattern as `/api/bundle` + `/api/bundle/submit` in thanos-stealth. Build UserOp → sign paymaster hash → client signs userOpHash → submit via handleOps.

Deferred to after core flow is working and verified.
