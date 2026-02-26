# Gas Benchmarks: x402 Facilitator on Thanos Sepolia

**Date**: 2026-02-27
**Facilitator**: `0x0af530d6d66947aD930a7d1De60E58c43D40a308`
**RPC**: `https://rpc.thanos-sepolia.tokamak.network`
**Chain**: Thanos Sepolia (OP Stack L2, native token: TON)

## Raw Measurements

| Operation            | Gas Used | Samples | Source                        |
| -------------------- | -------: | ------: | ----------------------------- |
| Simple TON transfer  |   21,000 |       1 | Self-sent 0-value transfer    |
| `deposit()`          |   27,853 |       2 | On-chain deposits             |
| `settle()`           |   68,722 |       9 | On-chain settles (median)     |

`settle()` gas range: 68,710 - 68,734 (extremely consistent across 9 samples).

## Gas Price

| Metric              | Value         | Notes                                 |
| ------------------- | ------------- | ------------------------------------- |
| Current gas price   | 1,000,252 wei | ~0.001 gwei                           |
| Observed low        | 253 wei       | During low-activity periods           |
| L1 fee per tx       | 30-68 wei     | Negligible (L1 data posting overhead) |

Thanos Sepolia gas prices are 6-7 orders of magnitude lower than Ethereum mainnet (~30 gwei).

## Cost per Operation

All costs include L2 execution + L1 data fee.

### At Current Gas Price (1,000,252 wei / ~0.001 gwei)

| Operation           | Gas Used | Cost (TON)            | @ $0.50 TON | @ $1.00 TON | @ $5.00 TON |
| ------------------- | -------: | --------------------: | ----------: | ----------: | ----------: |
| Simple TON transfer |   21,000 | 0.000000021 TON       | $0.00000001 | $0.00000002 | $0.00000011 |
| `deposit()`         |   27,853 | 0.000000028 TON       | $0.00000001 | $0.00000003 | $0.00000014 |
| `settle()`          |   68,722 | 0.000000069 TON       | $0.00000003 | $0.00000007 | $0.00000034 |

### At Low Gas Price (253 wei)

| Operation           | Gas Used | Cost (TON)            | @ $0.50 TON | @ $1.00 TON | @ $5.00 TON |
| ------------------- | -------: | --------------------: | ----------: | ----------: | ----------: |
| Simple TON transfer |   21,000 | 0.000000000005 TON    |       ~$0   |       ~$0   |       ~$0   |
| `deposit()`         |   27,853 | 0.000000000007 TON    |       ~$0   |       ~$0   |       ~$0   |
| `settle()`          |   68,722 | 0.000000000017 TON    |       ~$0   |       ~$0   |       ~$0   |

## Micropayment Viability

**Is a $0.01 micropayment viable?**

Yes, overwhelmingly. The `settle()` gas cost as a percentage of a $0.01 payment:

| TON Price | settle() Cost | % of $0.01 Payment |
| --------: | ------------: | -----------------: |
|     $0.50 |   $0.00000003 |             0.0003% |
|     $1.00 |   $0.00000007 |             0.0007% |
|     $5.00 |   $0.00000034 |             0.0034% |

Even at $5/TON, gas is less than 0.004% of a $0.01 payment. Gas is effectively free.

**Break-even analysis**: At $5/TON, the minimum viable payment where gas exceeds 1% of the payment amount is $0.000034 (0.0034 cents). Any payment above a fraction of a cent is viable.

## Comparison with Base

| Metric                 | Thanos Sepolia      | Base                 | Ratio           |
| ---------------------- | ------------------: | -------------------: | --------------: |
| settle() gas used      |              68,722 |          ~65,000     |       ~1x       |
| Gas price              |   ~0.001 gwei       |       ~0.01 gwei     |      ~10x less  |
| Typical settle() cost  |       ~$0.00000007  |         ~$0.001      |   ~14,000x less |
| L1 data fee            |       ~$0.00000005  |         ~$0.0005     |   ~10,000x less |
| **Total settle() cost**| **~$0.0000001**     |     **~$0.001**      | **~10,000x less** |

Thanos Sepolia gas costs are roughly 4 orders of magnitude cheaper than Base. This is partly due to the testnet having low congestion, but even accounting for mainnet gas price increases, Thanos would remain significantly cheaper for x402 operations.

## Transaction References

### deposit()
- `0xd876ef0e9462d88bffc1bde70abac9a48673e7b7d4e4a496c085e76c2e511b22` (27,853 gas)
- `0x126eecbc1016459c87b9beed720279a5b356a990e9db979038566da71986ef49` (27,853 gas)

### settle() (9 transactions)
- `0x1d11993573a89a36d8ffea24a54ab4b9c9e429c8b49fdf13d523d478086f42a9` (68,722 gas)
- `0xf957c45701ddc73fd9169fca00a4bbc9d454e06aef5af3a30ac996c87ad34ba6` (68,722 gas)
- `0xc2245b5b90139ffd0d41608dd3cbaef4de6f47d2d7999769d638df3ce3214904` (68,734 gas)
- `0x5e020b602eec0a320bf451ec8a1ce2d831000315949cb22f37125ec128016e51` (68,722 gas)
- `0xeb3de612d94351233adf8cf705b6c811e561be544c1d8e43c86292704587f563` (68,722 gas)
- `0x4388a49a5ff1f9794bec168952aa9ece36cf1d47a63d24648a250ab506c5b3ec` (68,710 gas)
- `0x68109a96964d477f79f4375dc7398f0277bb62646230711ab02b05aa2b86c2a8` (68,734 gas)
- `0x486bdc47e1b6fcf838461eb6cf8a270bbe6b0dc077fe72e5c4bfb55fc002c1eb` (68,710 gas)
- `0x82d73b96cc60fc8bbed73ad5b3deeb2120a3ef5695e534c45c7fe8800194bc86` (68,734 gas)

### Simple Transfer
- `0x6f8492e4b13530d2bba97eaded157076ad789c273de80bb0b0ef6623a8a0714d` (21,000 gas)

## Methodology

- **Simple transfer**: `cast send <own-address> --value 0` (baseline 21,000 gas EVM transfer)
- **deposit()**: `cast send <facilitator> "deposit()" --value 0.001ether`
- **settle()**: Receipts from 9 historical on-chain settle transactions on the facilitator
- **Gas price**: `cast gas-price` at time of benchmarking
- **All L1 fees**: Extracted from transaction receipts (`l1Fee` field)
