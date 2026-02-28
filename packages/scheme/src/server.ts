import type {
  SchemeNetworkServer,
  PaymentRequirements,
  Network,
  Price,
  AssetAmount,
} from "@x402/core/types";
import { THANOS_USDC } from "@x402-ton/common";

function isAssetAmount(price: Price): price is AssetAmount {
  return typeof price === "object" && "asset" in price && "amount" in price;
}

export class ExactTonServer implements SchemeNetworkServer {
  readonly scheme = "exact";

  async parsePrice(price: Price, _network: Network): Promise<AssetAmount> {
    if (isAssetAmount(price)) return price;

    // USDC has 6 decimals
    const usdcAmount = typeof price === "string"
      ? price.replace(/^\$/, "")
      : String(price);

    const decimals = 6;
    const parts = usdcAmount.split(".");
    const whole = parts[0] ?? "0";
    const frac = (parts[1] ?? "").padEnd(decimals, "0").slice(0, decimals);
    const amount = (BigInt(whole) * BigInt(10 ** decimals) + BigInt(frac)).toString();

    return { asset: THANOS_USDC, amount };
  }

  async enhancePaymentRequirements(
    requirements: PaymentRequirements,
    supportedKind: {
      x402Version: number;
      scheme: string;
      network: Network;
      extra?: Record<string, unknown>;
    },
    _facilitatorExtensions: string[],
  ): Promise<PaymentRequirements> {
    return {
      ...requirements,
      extra: {
        ...supportedKind.extra,
        ...requirements.extra,
      },
    };
  }
}
