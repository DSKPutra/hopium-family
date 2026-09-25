import { AppError } from '../errors';
import { add, cmp, dec, div, gt, isZero, lt, mul, str, sub } from '../money';
import type { AssetClass, Decimal, SizeBucket } from '../types';
import { DEFAULT_MIN_ORDER_USD } from './fees';

export const SLIPPAGE_PRESETS_BPS = [50, 100, 200, 500] as const;
export const DEFAULT_SLIPPAGE_BPS = 100;
export const MAX_SLIPPAGE_BPS = 2000;
export const SLIPPAGE_WARNING_BPS = 500;

export type SlippageLevel = 'ok' | 'warning' | 'invalid';

export function slippageLevel(bps: number): SlippageLevel {
  if (!Number.isInteger(bps) || bps <= 0 || bps > MAX_SLIPPAGE_BPS) return 'invalid';
  return bps > SLIPPAGE_WARNING_BPS ? 'warning' : 'ok';
}

/** Throws `min_order` when a spot order is below the class minimum. */
export function assertMinOrder(
  notionalUsd: Decimal,
  assetClass: Exclude<AssetClass, 'perp'>,
  minimums = DEFAULT_MIN_ORDER_USD,
): void {
  const minimum = minimums[assetClass];
  if (lt(notionalUsd, minimum)) {
    throw new AppError('min_order', `Minimum order is $${minimum}`, { min: minimum });
  }
}

export function meetsMinOrder(
  notionalUsd: Decimal,
  assetClass: Exclude<AssetClass, 'perp'>,
  minimums = DEFAULT_MIN_ORDER_USD,
): boolean {
  return !lt(notionalUsd, minimums[assetClass]);
}

/** priceImpact% compared with slippage bps (100 bps = 1%). */
export function exceedsSlippage(priceImpactPct: Decimal, slippageBps: number): boolean {
  return gt(priceImpactPct, div(slippageBps, 100));
}

export function assertWithinSlippage(priceImpactPct: Decimal, slippageBps: number): void {
  if (exceedsSlippage(priceImpactPct, slippageBps)) {
    throw new AppError('slippage_exceeded', 'Price moved more than your slippage setting.');
  }
}

export interface Lot {
  qty: Decimal;
  price: Decimal;
}

/** Quantity-weighted average entry after adding a buy. */
export function averageEntry(
  currentQty: Decimal,
  currentAvg: Decimal,
  buyQty: Decimal,
  buyPrice: Decimal,
): Decimal {
  const totalQty = add(currentQty, buyQty);
  if (isZero(totalQty)) return '0';
  return div(add(mul(currentQty, currentAvg), mul(buyQty, buyPrice)), totalQty);
}

export function weightedAverage(lots: Lot[]): Decimal {
  const totalQty = lots.reduce((acc, l) => add(acc, l.qty), '0');
  if (isZero(totalQty)) return '0';
  return div(
    lots.reduce((acc, l) => add(acc, mul(l.qty, l.price)), '0'),
    totalQty,
  );
}

export interface FifoResult {
  realizedPnl: Decimal;
  remainingLots: Lot[];
  /** Cost basis of the quantity sold. */
  costBasis: Decimal;
}

/**
 * Realized PnL of a sell using FIFO lots. Selling more than is held throws
 * `insufficient_balance`. Fees are excluded (reported separately).
 */
export function fifoSell(lots: Lot[], sellQty: Decimal, sellPrice: Decimal): FifoResult {
  if (!gt(sellQty, 0)) throw new AppError('invalid_amount', 'Sell quantity must be positive');
  const held = lots.reduce((acc, l) => add(acc, l.qty), '0');
  if (gt(sellQty, held))
    throw new AppError('insufficient_balance', 'Not enough balance for this order.');

  let remaining = sellQty;
  let costBasis = '0';
  const remainingLots: Lot[] = [];
  for (const lot of lots) {
    if (isZero(remaining)) {
      remainingLots.push({ ...lot });
      continue;
    }
    if (cmp(lot.qty, remaining) <= 0) {
      costBasis = add(costBasis, mul(lot.qty, lot.price));
      remaining = sub(remaining, lot.qty);
    } else {
      costBasis = add(costBasis, mul(remaining, lot.price));
      remainingLots.push({ qty: sub(lot.qty, remaining), price: lot.price });
      remaining = '0';
    }
  }
  const proceeds = mul(sellQty, sellPrice);
  return { realizedPnl: sub(proceeds, costBasis), remainingLots, costBasis };
}

/** (mark − avgEntry) × qty */
export const unrealizedPnl = (mark: Decimal, avgEntry: Decimal, qty: Decimal): Decimal =>
  mul(sub(mark, avgEntry), qty);

export function unrealizedPnlPct(mark: Decimal, avgEntry: Decimal): Decimal {
  if (isZero(avgEntry)) return '0';
  return str(dec(mark).minus(dec(avgEntry)).dividedBy(dec(avgEntry)).times(100));
}

/**
 * Mock/real-agnostic constant-product style impact estimate: impact grows with
 * order size relative to liquidity (24h volume proxy).
 */
export function estimatePriceImpactPct(notionalUsd: Decimal, liquidityUsd: Decimal): Decimal {
  if (!gt(liquidityUsd, 0)) return '0';
  // impact% ≈ notional / (notional + liquidity) × 100
  return str(
    dec(notionalUsd)
      .dividedBy(dec(notionalUsd).plus(dec(liquidityUsd)))
      .times(100),
  );
}

/** Size bucket shown in the feed instead of exact amounts. */
export function sizeBucket(notionalUsd: Decimal): SizeBucket {
  if (lt(notionalUsd, 100)) return 'lt100';
  if (lt(notionalUsd, 1000)) return '100to1k';
  if (lt(notionalUsd, 10000)) return '1kto10k';
  return 'gt10k';
}
