import { describe, it, expect } from "vitest";
import { getFacilitatorDomain, PAYMENT_AUTH_TYPES } from "../src/eip712.js";

describe("PAYMENT_AUTH_TYPES", () => {
  it("defines PaymentAuth struct with expected fields", () => {
    // #then
    const fields = PAYMENT_AUTH_TYPES.PaymentAuth;
    expect(fields).toHaveLength(5);

    const names = fields.map((f) => f.name);
    expect(names).toEqual(["from", "to", "amount", "deadline", "nonce"]);
  });

  it("uses correct Solidity types", () => {
    // #then
    const types = PAYMENT_AUTH_TYPES.PaymentAuth.map((f) => f.type);
    expect(types).toEqual(["address", "address", "uint256", "uint256", "bytes32"]);
  });
});

describe("getFacilitatorDomain", () => {
  it("constructs a valid EIP-712 domain", () => {
    // #given
    const address = "0x0af530d6d66947aD930a7d1De60E58c43D40a308" as `0x${string}`;
    const chainId = 111551119090;

    // #when
    const domain = getFacilitatorDomain(address, chainId);

    // #then
    expect(domain.name).toBe("x402-TON Payment Facilitator");
    expect(domain.version).toBe("1");
    expect(domain.chainId).toBe(BigInt(chainId));
    expect(domain.verifyingContract).toBe(address);
  });

  it("produces consistent output for same inputs", () => {
    // #given
    const address = "0xaaaa" as `0x${string}`;
    const chainId = 1;

    // #when
    const domain1 = getFacilitatorDomain(address, chainId);
    const domain2 = getFacilitatorDomain(address, chainId);

    // #then
    expect(domain1).toEqual(domain2);
  });

  it("produces different domains for different addresses", () => {
    // #given
    const chainId = 1;

    // #when
    const domain1 = getFacilitatorDomain("0xaaaa" as `0x${string}`, chainId);
    const domain2 = getFacilitatorDomain("0xbbbb" as `0x${string}`, chainId);

    // #then
    expect(domain1.verifyingContract).not.toBe(domain2.verifyingContract);
  });

  it("produces different domains for different chain IDs", () => {
    // #given
    const address = "0xaaaa" as `0x${string}`;

    // #when
    const domain1 = getFacilitatorDomain(address, 1);
    const domain2 = getFacilitatorDomain(address, 137);

    // #then
    expect(domain1.chainId).not.toBe(domain2.chainId);
  });
});
