import { abs, add, dec, div, gte, isZero, lt, mul, str, sum } from '../money';
import type { Decimal, Tier, Trade } from '../types';

export const MIN_TRADES_TO_QUALIFY = 5;
export const MIN_VOLUME_TO_QUALIFY = '50';

export interface TraderPeriodMetrics {
  tradesCount: number;
  volumeUsd: Decimal;
  realizedPnl: Decimal;
  /** Realized PnL relative to the cost basis of closed trades. */
  pnlPct: Decimal;
  winRatePct: Decimal;
}

/**
 * Realized PnL % = Σ realized / Σ cost basis of sells. Win rate = profitable
 * sells / all sells.
 */
export function traderMetrics(trades: Trade[]): TraderPeriodMetrics {
  const volumeUsd = sum(trades.map((t) => t.notional));
  const sells = trades.filter((t) => t.side === 'sell');
  const realizedPnl = sum(sells.map((t) => t.realizedPnl));
  const costBasis = sum(sells.map((t) => str(dec(t.notional).minus(dec(t.realizedPnl)))));
  const wins = sells.filter((t) => dec(t.realizedPnl).greaterThan(0)).length;
  return {
    tradesCount: trades.length,
    volumeUsd,
    realizedPnl,
    pnlPct: isZero(costBasis) ? '0' : mul(div(realizedPnl, costBasis), 100),
    winRatePct: sells.length === 0 ? '0' : mul(div(wins, sells.length), 100),
  };
}

export function qualifies(
  metrics: Pick<TraderPeriodMetrics, 'tradesCount' | 'volumeUsd'>,
): boolean {
  return (
    metrics.tradesCount >= MIN_TRADES_TO_QUALIFY && gte(metrics.volumeUsd, MIN_VOLUME_TO_QUALIFY)
  );
}

export function thesisAccuracyPct(hits: number, resolved: number): Decimal {
  if (resolved <= 0) return '0';
  return mul(div(hits, resolved), 100);
}

/**
 * Suspected wash trading: the same user buying and selling the same asset more
 * than 20 times within one hour with net PnL ≈ 0 (|net| < 0.5% of volume).
 */
export function isSuspectedWashTrading(
  trades: Trade[],
  windowMs = 3_600_000,
  threshold = 20,
): boolean {
  const byAsset = new Map<string, Trade[]>();
  for (const t of trades) {
    const list = byAsset.get(t.assetId) ?? [];
    list.push(t);
    byAsset.set(t.assetId, list);
  }
  for (const list of byAsset.values()) {
    const sorted = [...list].sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt));
    let start = 0;
    for (let end = 0; end < sorted.length; end++) {
      const endTrade = sorted[end]!;
      while (Date.parse(endTrade.createdAt) - Date.parse(sorted[start]!.createdAt) > windowMs)
        start++;
      const window = sorted.slice(start, end + 1);
      const hasBoth = window.some((t) => t.side === 'buy') && window.some((t) => t.side === 'sell');
      if (window.length > threshold && hasBoth) {
        const volume = sum(window.map((t) => t.notional));
        const net = sum(window.map((t) => t.realizedPnl));
        if (isZero(volume) || lt(abs(net), mul(volume, '0.005'))) return true;
      }
    }
  }
  return false;
}

export const DEFAULT_TIER_THRESHOLDS: Record<Tier, Decimal> = {
  rookie: '0',
  believer: '500',
  degen: '5000',
  whale: '50000',
  legend: '250000',
};

/** Tier from lifetime traded volume (USD). */
export function tierForVolume(volumeUsd: Decimal, thresholds = DEFAULT_TIER_THRESHOLDS): Tier {
  const order: Tier[] = ['legend', 'whale', 'degen', 'believer', 'rookie'];
  return order.find((tier) => gte(volumeUsd, thresholds[tier])) ?? 'rookie';
}

export interface Ranked<T> {
  item: T;
  rank: number;
}

/** Dense-free ranking: ties share a rank (1, 1, 3). */
export function rankBy<T>(items: T[], value: (item: T) => Decimal): Ranked<T>[] {
  const sorted = [...items].sort((a, b) => dec(value(b)).comparedTo(dec(value(a))));
  const ranked: Ranked<T>[] = [];
  sorted.forEach((item, i) => {
    const prev = ranked[i - 1];
    const rank = prev && dec(value(prev.item)).equals(dec(value(item))) ? prev.rank : i + 1;
    ranked.push({ item, rank });
  });
  return ranked;
}

export const accumulate = (a: Decimal, b: Decimal): Decimal => add(a, b);
