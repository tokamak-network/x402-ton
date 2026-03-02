import { describe, it, expect } from "vitest";
import { getUsdcDomain, TRANSFER_WITH_AUTHORIZATION_TYPES } from "../src/eip3009.js";

describe("TRANSFER_WITH_AUTHORIZATION_TYPES", () => {
  it("defines TransferWithAuthorization struct with expected fields", () => {
    // #then
    const fields = TRANSFER_WITH_AUTHORIZATION_TYPES.TransferWithAuthorization;
    expect(fields).toHaveLength(6);

    const names = fields.map((f) => f.name);
    expect(names).toEqual(["from", "to", "value", "validAfter", "validBefore", "nonce"]);
  });

  it("uses correct Solidity types", () => {
    // #then
    const types = TRANSFER_WITH_AUTHORIZATION_TYPES.TransferWithAuthorization.map((f) => f.type);
    expect(types).toEqual(["address", "address", "uint256", "uint256", "uint256", "bytes32"]);
  });
});

describe("getUsdcDomain", () => {
  it("constructs a valid EIP-712 domain", () => {
    // #given
    const address = "0x4200000000000000000000000000000000000778" as `0x${string}`;
    const chainId = 111551119090;

    // #when
    const domain = getUsdcDomain(address, chainId);

    // #then
    expect(domain.name).toBe("Bridged USDC (Tokamak Network)");
    expect(domain.version).toBe("2");
    expect(domain.chainId).toBe(BigInt(chainId));
    expect(domain.verifyingContract).toBe(address);
  });

  it("respects extra overrides for name and version", () => {
    // #given
    const address = "0xaaaa" as `0x${string}`;
    const chainId = 1;

    // #when
    const domain = getUsdcDomain(address, chainId, { name: "Custom USDC", version: "3" });

    // #then
    expect(domain.name).toBe("Custom USDC");
    expect(domain.version).toBe("3");
  });

  it("produces consistent output for same inputs", () => {
    // #given
    const address = "0xaaaa" as `0x${string}`;
    const chainId = 1;

    // #when
    const domain1 = getUsdcDomain(address, chainId);
    const domain2 = getUsdcDomain(address, chainId);

    // #then
    expect(domain1).toEqual(domain2);
  });

  it("produces different domains for different addresses", () => {
    // #given
    const chainId = 1;

    // #when
    const domain1 = getUsdcDomain("0xaaaa" as `0x${string}`, chainId);
    const domain2 = getUsdcDomain("0xbbbb" as `0x${string}`, chainId);

    // #then
    expect(domain1.verifyingContract).not.toBe(domain2.verifyingContract);
  });

  it("produces different domains for different chain IDs", () => {
    // #given
    const address = "0xaaaa" as `0x${string}`;

    // #when
    const domain1 = getUsdcDomain(address, 1);
    const domain2 = getUsdcDomain(address, 137);

    // #then
    expect(domain1.chainId).not.toBe(domain2.chainId);
  });
});
