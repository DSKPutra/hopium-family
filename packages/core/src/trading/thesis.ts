import { dec, div, gt, gte, lte, max, str, sub } from '../money';
import type { Decimal, ISODate, Thesis, ThesisDirection, ThesisStatus } from '../types';

export const THESIS_TIMEFRAMES = ['24h', '3d', '1w', '1m'] as const;
export type ThesisTimeframe = (typeof THESIS_TIMEFRAMES)[number] | 'custom';
const TIMEFRAME_MS: Record<(typeof THESIS_TIMEFRAMES)[number], number> = {
  '24h': 86_400_000,
  '3d': 3 * 86_400_000,
  '1w': 7 * 86_400_000,
  '1m': 30 * 86_400_000,
};

export function timeframeEnd(
  timeframe: (typeof THESIS_TIMEFRAMES)[number],
  from = Date.now(),
): ISODate {
  return new Date(from + TIMEFRAME_MS[timeframe]).toISOString();
}

export type ThesisPriceError = 'target_wrong_side' | 'invalidation_wrong_side';

/** Long: target > entry > invalidation. Short: target < entry < invalidation. */
export function validateThesisPrices(
  direction: ThesisDirection,
  entry: Decimal,
  target: Decimal,
  invalidation: Decimal,
): ThesisPriceError[] {
  const errors: ThesisPriceError[] = [];
  if (direction === 'long') {
    if (!gt(target, entry)) errors.push('target_wrong_side');
    if (!(gt(entry, invalidation) && gt(invalidation, 0))) errors.push('invalidation_wrong_side');
  } else {
    if (!(gt(entry, target) && gt(target, 0))) errors.push('target_wrong_side');
    if (!gt(invalidation, entry)) errors.push('invalidation_wrong_side');
  }
  return errors;
}

/**
 * Progress from entry toward target (0..1, positive) or toward invalidation
 * (0..−1, negative).
 */
export function thesisProgress(
  direction: ThesisDirection,
  entry: Decimal,
  target: Decimal,
  invalidation: Decimal,
  current: Decimal,
): number {
  const move = direction === 'long' ? sub(current, entry) : sub(entry, current);
  if (gte(move, 0)) {
    const range = direction === 'long' ? sub(target, entry) : sub(entry, target);
    if (!gt(range, 0)) return 0;
    return Math.min(1, dec(div(move, range)).toNumber());
  }
  const range = direction === 'long' ? sub(entry, invalidation) : sub(invalidation, entry);
  if (!gt(range, 0)) return 0;
  return Math.max(-1, dec(div(move, range)).toNumber());
}

/** Favorable excursion % from entry. */
export function favorablePct(direction: ThesisDirection, entry: Decimal, price: Decimal): Decimal {
  const move = direction === 'long' ? sub(price, entry) : sub(entry, price);
  return str(dec(move).dividedBy(dec(entry)).times(100));
}

export function resolveThesis(
  thesis: Pick<
    Thesis,
    | 'direction'
    | 'entryPrice'
    | 'targetPrice'
    | 'invalidationPrice'
    | 'timeframeEnd'
    | 'status'
    | 'maxFavorablePct'
  >,
  price: Decimal,
  now = Date.now(),
): { status: ThesisStatus; maxFavorablePct: Decimal } {
  const maxFavorablePct = max(
    thesis.maxFavorablePct,
    favorablePct(thesis.direction, thesis.entryPrice, price),
  );
  if (thesis.status !== 'active')
    return { status: thesis.status, maxFavorablePct: thesis.maxFavorablePct };
  const { direction, targetPrice, invalidationPrice } = thesis;
  const hit = direction === 'long' ? gte(price, targetPrice) : lte(price, targetPrice);
  if (hit) return { status: 'hit', maxFavorablePct };
  const invalid =
    direction === 'long' ? lte(price, invalidationPrice) : gte(price, invalidationPrice);
  if (invalid) return { status: 'invalidated', maxFavorablePct };
  if (now >= Date.parse(thesis.timeframeEnd)) return { status: 'expired', maxFavorablePct };
  return { status: 'active', maxFavorablePct };
}
