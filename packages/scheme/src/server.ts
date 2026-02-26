import { parseEther } from "viem";
import type {
  SchemeNetworkServer,
  PaymentRequirements,
  Network,
  Price,
  AssetAmount,
} from "@x402/core/types";

function isAssetAmount(price: Price): price is AssetAmount {
  return typeof price === "object" && "asset" in price && "amount" in price;
}

export class ExactTonServer implements SchemeNetworkServer {
  readonly scheme = "exact";

  async parsePrice(price: Price, _network: Network): Promise<AssetAmount> {
    if (isAssetAmount(price)) {
      return price;
    }

    // Money (string | number) — interpret as TON amount, convert to wei
    const tonAmount = typeof price === "string"
      ? price.replace(/^\$/, "")
      : String(price);

    return {
      asset: "native",
      amount: parseEther(tonAmount).toString(),
    };
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
