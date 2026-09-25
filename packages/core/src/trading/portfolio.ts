import { add, sum } from '../money';
import type { Decimal } from '../types';

/** Portfolio value = spot holdings + stock tokens + perp margin + unrealized PnL (+ cash). */
export function portfolioValue(parts: {
  cashUsd: Decimal;
  cryptoUsd: Decimal;
  stockTokensUsd: Decimal;
  perpsMarginUsd: Decimal;
  perpsUnrealizedUsd: Decimal;
}): Decimal {
  return sum([
    parts.cashUsd,
    parts.cryptoUsd,
    parts.stockTokensUsd,
    parts.perpsMarginUsd,
    parts.perpsUnrealizedUsd,
  ]);
}

export const addAll = (values: Decimal[]): Decimal => values.reduce((acc, v) => add(acc, v), '0');
