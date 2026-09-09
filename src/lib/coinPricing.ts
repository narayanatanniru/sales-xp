/**
 * Coin economy pricing utilities.
 *
 * In normal mode: 1 coin = $0.10 (10 coins = $1).
 * Purchases are billed: subtotal + 6% fee (fee_bps = 600).
 * Minimum purchase: 5 coins (Stripe's $0.50 floor).
 *
 * In in-house mode: no Stripe, org sets a cosmetic coin_to_dollar_rate.
 */

export const DEFAULT_COIN_VALUE = 0.10;
export const FEE_BPS = 600;
export const MIN_PURCHASE_COINS = 5;

export interface CoinPurchaseBreakdown {
  coins: number;
  subtotalUsd: number;
  feeUsd: number;
  totalUsd: number;
  coinValueUsd: number;
}

export function priceCoinPurchase(
  coins: number,
  coinValueUsd: number = DEFAULT_COIN_VALUE,
): CoinPurchaseBreakdown {
  const subtotalUsd = Math.round(coins * coinValueUsd * 100) / 100;
  const feeUsd = Math.round(subtotalUsd * (FEE_BPS / 10000) * 100) / 100;
  const totalUsd = Math.round((subtotalUsd + feeUsd) * 100) / 100;
  return { coins, subtotalUsd, feeUsd, totalUsd, coinValueUsd };
}

export function formatUsd(amount: number): string {
  return `$${amount.toFixed(2)}`;
}

export function coinsToUsd(coins: number, rate: number = DEFAULT_COIN_VALUE): number {
  return Math.round(coins * rate * 100) / 100;
}
