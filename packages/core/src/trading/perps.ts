import { AppError } from '../errors';
import { dec, div, gt, gte, isZero, lt, lte, mul, str, sub } from '../money';
import type { Decimal, PerpSide } from '../types';

export const DEFAULT_LEVERAGE = 3;
export const HIGH_LEVERAGE_THRESHOLD = 10;
export const LEVERAGE_TICKS = [1, 3, 5, 10, 20] as const;
/** Warn when mark is within this fraction of the liquidation price. */
export const LIQUIDATION_WARNING_FRACTION = '0.10';

export const notional = (size: Decimal, entryPrice: Decimal): Decimal => mul(size, entryPrice);

export function initialMargin(notionalUsd: Decimal, leverage: number): Decimal {
  assertLeverage(leverage, Number.MAX_SAFE_INTEGER);
  return div(notionalUsd, leverage);
}

/** Size in base units bought with `marginUsd` at `leverage`. */
export function sizeFromMargin(marginUsd: Decimal, leverage: number, entryPrice: Decimal): Decimal {
  if (!gt(entryPrice, 0)) throw new AppError('invalid_amount', 'Entry price must be positive');
  return div(mul(marginUsd, leverage), entryPrice);
}

export function assertLeverage(leverage: number, maxLeverage: number): void {
  if (!Number.isFinite(leverage) || leverage < 1 || leverage > maxLeverage) {
    throw new AppError('leverage_out_of_range', `Leverage must be between 1× and ${maxLeverage}×`, {
      max: maxLeverage,
    });
  }
}

export const isHighLeverage = (leverage: number): boolean => leverage > HIGH_LEVERAGE_THRESHOLD;

/**
 * Estimated liquidation price (isolated margin):
 *   long:  entry × (1 − 1/leverage + mmr)
 *   short: entry × (1 + 1/leverage − mmr)
 * Always labelled "estimated" in the UI.
 */
export function liquidationPrice(
  side: PerpSide,
  entry: Decimal,
  leverage: number,
  mmr: Decimal,
): Decimal {
  assertLeverage(leverage, Number.MAX_SAFE_INTEGER);
  const inv = dec(1).dividedBy(leverage);
  const factor =
    side === 'long' ? dec(1).minus(inv).plus(dec(mmr)) : dec(1).plus(inv).minus(dec(mmr));
  const price = dec(entry).times(factor);
  return str(price.isNegative() ? 0 : price);
}

/** (mark − entry) × size × (long ? 1 : −1) */
export function perpUnrealizedPnl(
  side: PerpSide,
  entry: Decimal,
  mark: Decimal,
  size: Decimal,
): Decimal {
  const pnl = mul(sub(mark, entry), size);
  return side === 'long' ? pnl : str(dec(pnl).negated());
}

/** unrealizedPnl / initialMargin × 100 */
export function roePct(unrealized: Decimal, margin: Decimal): Decimal {
  if (isZero(margin)) return '0';
  return str(dec(unrealized).dividedBy(dec(margin)).times(100));
}

export function isLiquidatable(side: PerpSide, mark: Decimal, liqPrice: Decimal): boolean {
  return side === 'long' ? lte(mark, liqPrice) : gte(mark, liqPrice);
}

/** True when mark is within 10% (of mark) of the liquidation price. */
export function isNearLiquidation(side: PerpSide, mark: Decimal, liqPrice: Decimal): boolean {
  if (isZero(mark)) return false;
  const distance = side === 'long' ? sub(mark, liqPrice) : sub(liqPrice, mark);
  if (lte(distance, 0)) return true;
  return lte(div(distance, mark), LIQUIDATION_WARNING_FRACTION);
}

/** Price that would trigger when converting a TP/SL % move (of entry) to a price. */
export function priceFromPct(
  side: PerpSide,
  entry: Decimal,
  pct: Decimal,
  kind: 'tp' | 'sl',
): Decimal {
  const move = dec(pct).dividedBy(100);
  const up = (side === 'long') === (kind === 'tp');
  return str(dec(entry).times(up ? dec(1).plus(move) : dec(1).minus(move)));
}

export type TpSlError = 'invalid_tp' | 'invalid_sl' | 'sl_beyond_liquidation';

/**
 * TP must be above entry for longs / below for shorts; SL the opposite, and SL
 * must trigger before the estimated liquidation price.
 */
export function validateTpSl(params: {
  side: PerpSide;
  entry: Decimal;
  liqPrice: Decimal;
  tp?: Decimal | null;
  sl?: Decimal | null;
}): TpSlError[] {
  const { side, entry, liqPrice, tp, sl } = params;
  const errors: TpSlError[] = [];
  if (tp) {
    const ok = side === 'long' ? gt(tp, entry) : lt(tp, entry) && gt(tp, 0);
    if (!ok) errors.push('invalid_tp');
  }
  if (sl) {
    const directionOk = side === 'long' ? lt(sl, entry) && gt(sl, 0) : gt(sl, entry);
    if (!directionOk) errors.push('invalid_sl');
    else {
      const beforeLiq = side === 'long' ? gt(sl, liqPrice) : lt(sl, liqPrice);
      if (!beforeLiq) errors.push('sl_beyond_liquidation');
    }
  }
  return errors;
}

export function assertTpSl(params: Parameters<typeof validateTpSl>[0]): void {
  const [first] = validateTpSl(params);
  if (first) throw new AppError(first);
}

export interface PerpPreview {
  size: Decimal;
  notional: Decimal;
  margin: Decimal;
  liqPrice: Decimal;
  fee: Decimal;
}

export function previewPerp(params: {
  side: PerpSide;
  marginUsd: Decimal;
  leverage: number;
  price: Decimal;
  mmr: Decimal;
  feeRate: Decimal;
}): PerpPreview {
  const { side, marginUsd, leverage, price, mmr, feeRate } = params;
  const size = sizeFromMargin(marginUsd, leverage, price);
  const n = notional(size, price);
  return {
    size,
    notional: n,
    margin: marginUsd,
    liqPrice: liquidationPrice(side, price, leverage, mmr),
    fee: mul(n, feeRate),
  };
}
