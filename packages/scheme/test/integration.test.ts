import { describe, it, expect, beforeAll } from "vitest";
import { privateKeyToAccount } from "viem/accounts";
import { createPublicClient, createWalletClient, http } from "viem";
import { x402Client } from "@x402/core/client";
import { x402Facilitator } from "@x402/core/facilitator";
import { x402ResourceServer } from "@x402/core/server";
import type { PaymentRequirements, Network } from "@x402/core/types";
import { thanosSepolia, CAIP2_THANOS_SEPOLIA, THANOS_USDC } from "@x402-ton/common";
import type { PaymentPayload } from "@x402-ton/common";
import {
  registerExactTonScheme,
  registerExactTonFacilitator,
  registerExactTonServer,
  toInternalRequirement,
  toPayloadResult,
  ExactTonServer,
} from "@x402-ton/scheme";

const TEST_PRIVATE_KEY = process.env.PRIVATE_KEY as `0x${string}` | undefined;

// Pure unit tests — always run, no env vars needed
describe("x402-ton scheme unit tests", () => {
  describe("toInternalRequirement", () => {
    it("maps core PaymentRequirements to internal format", () => {
      const coreRequirements: PaymentRequirements = {
        scheme: "exact",
        network: CAIP2_THANOS_SEPOLIA as Network,
        asset: THANOS_USDC,
        amount: "100000",
        payTo: "0x1234567890abcdef1234567890abcdef12345678",
        maxTimeoutSeconds: 300,
        extra: {
          name: "Bridged USDC (Tokamak Network)",
          version: "2",
        },
      };

      const internal = toInternalRequirement(coreRequirements);

      expect(internal.scheme).toBe("exact");
      expect(internal.network).toBe(coreRequirements.network);
      expect(internal.amount).toBe(coreRequirements.amount);
      expect(internal.payTo).toBe(coreRequirements.payTo);
      expect(internal.asset).toBe(THANOS_USDC);
      expect(internal.maxTimeoutSeconds).toBe(300);
      expect(internal.extra).toEqual({ name: "Bridged USDC (Tokamak Network)", version: "2" });
    });

    it("defaults missing extra to empty object", () => {
      const sparseReq: PaymentRequirements = {
        scheme: "exact",
        network: CAIP2_THANOS_SEPOLIA as Network,
        asset: THANOS_USDC,
        amount: "500",
        payTo: "0x0000000000000000000000000000000000000001",
        maxTimeoutSeconds: 60,
      };

      const sparseInternal = toInternalRequirement(sparseReq);

      expect(sparseInternal.extra).toEqual({});
    });
  });

  describe("toPayloadResult", () => {
    it("round-trips payload fields", () => {
      const testPayload: PaymentPayload = {
        x402Version: 2,
        scheme: "exact",
        network: CAIP2_THANOS_SEPOLIA,
        payload: {
          signature: "0xdeadbeef" as `0x${string}`,
          authorization: {
            from: "0xaaaa" as `0x${string}`,
            to: "0xbbbb" as `0x${string}`,
            value: "100000",
            validAfter: "0",
            validBefore: "9999999999",
            nonce:
              "0x0000000000000000000000000000000000000000000000000000000000000001" as `0x${string}`,
          },
        },
      };

      const payloadResult = toPayloadResult(testPayload);

      expect(payloadResult.signature).toBe(testPayload.payload.signature);
      expect(payloadResult.authorization).toEqual(
        testPayload.payload.authorization,
      );
      expect(typeof payloadResult).toBe("object");
      expect(payloadResult).not.toBeNull();
    });
  });

  describe("ExactTonServer.parsePrice", () => {
    const tonServer = new ExactTonServer();
    const network = CAIP2_THANOS_SEPOLIA as Network;

    it("converts number to USDC base units (6 decimals)", async () => {
      const result = await tonServer.parsePrice(1.5, network);
      expect(result.asset).toBe(THANOS_USDC);
      expect(result.amount).toBe("1500000");
    });

    it("converts string to USDC base units", async () => {
      const result = await tonServer.parsePrice("2.0", network);
      expect(result.amount).toBe("2000000");
    });

    it("passes through AssetAmount directly", async () => {
      const result = await tonServer.parsePrice(
        { asset: THANOS_USDC, amount: "42" },
        network,
      );
      expect(result.amount).toBe("42");
      expect(result.asset).toBe(THANOS_USDC);
    });

    it("strips dollar sign prefix", async () => {
      const result = await tonServer.parsePrice("$3.0", network);
      expect(result.amount).toBe("3000000");
    });
  });
});

// Integration tests requiring a private key — skipped in CI
describe.skipIf(!TEST_PRIVATE_KEY)("x402-ton scheme integration (requires PRIVATE_KEY)", () => {
  let account: ReturnType<typeof privateKeyToAccount>;
  let publicClient: ReturnType<typeof createPublicClient>;
  let walletClient: ReturnType<typeof createWalletClient>;

  beforeAll(() => {
    account = privateKeyToAccount(TEST_PRIVATE_KEY!);
    publicClient = createPublicClient({
      chain: thanosSepolia,
      transport: http(),
    });
    walletClient = createWalletClient({
      chain: thanosSepolia,
      transport: http(),
      account,
    });
  });

  describe("registration", () => {
    it("registers with real x402Client", () => {
      const client = new x402Client();
      registerExactTonScheme(client, { account });
    });

    it("registers with real x402Facilitator and returns supported kinds", () => {
      const facilitator = new x402Facilitator();
      registerExactTonFacilitator(facilitator, {
        publicClient,
        walletClient,
      });

      const supported = facilitator.getSupported();
      expect(supported.kinds.length).toBeGreaterThan(0);

      const kind = supported.kinds[0];
      expect(kind.scheme).toBe("exact");
      expect(kind.network).toBe(CAIP2_THANOS_SEPOLIA);
    });

    it("registers with real x402ResourceServer", () => {
      const server = new x402ResourceServer();
      registerExactTonServer(server);

      const hasScheme = server.hasRegisteredScheme(
        CAIP2_THANOS_SEPOLIA as Network,
        "exact",
      );
      expect(hasScheme).toBe(true);
    });
  });
});
