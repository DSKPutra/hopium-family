import { round } from '../money';
import type { Trade } from '../types';
import {
  isSuspectedWashTrading,
  qualifies,
  rankBy,
  thesisAccuracyPct,
  tierForVolume,
  traderMetrics,
  accumulate,
} from './leaderboard';
import { portfolioValue, addAll } from './portfolio';

let n = 0;
const trade = (over: Partial<Trade>): Trade => ({
  id: `t${n++}`,
  userId: 'u',
  orderId: 'o',
  assetId: 'a',
  symbol: 'A',
  assetClass: 'crypto',
  side: 'buy',
  qty: '1',
  price: '10',
  notional: '10',
  fee: '0',
  realizedPnl: '0',
  isPublic: true,
  copiedFromTradeId: null,
  copiers: 0,
  createdAt: new Date(0).toISOString(),
  ...over,
});

describe('trader metrics', () => {
  it('computes pnl %, win rate and volume', () => {
    const m = traderMetrics([
      trade({ side: 'buy', notional: '100' }),
      trade({ side: 'sell', notional: '120', realizedPnl: '20' }),
      trade({ side: 'sell', notional: '40', realizedPnl: '-10' }),
    ]);
    expect(m.volumeUsd).toBe('260');
    expect(m.realizedPnl).toBe('10');
    expect(round(m.pnlPct, 2)).toBe('6.67');
    expect(m.winRatePct).toBe('50');
  });
  it('handles no sells', () => {
    const m = traderMetrics([trade({})]);
    expect(m.pnlPct).toBe('0');
    expect(m.winRatePct).toBe('0');
  });
  it('requires 5 trades and $50 volume to qualify', () => {
    expect(qualifies({ tradesCount: 5, volumeUsd: '50' })).toBe(true);
    expect(qualifies({ tradesCount: 4, volumeUsd: '500' })).toBe(false);
    expect(qualifies({ tradesCount: 10, volumeUsd: '49.99' })).toBe(false);
  });
  it('computes thesis accuracy', () => {
    expect(thesisAccuracyPct(3, 4)).toBe('75');
    expect(thesisAccuracyPct(0, 0)).toBe('0');
  });
});

describe('wash trading detection', () => {
  const base = Date.parse('2026-01-01T00:00:00Z');
  it('flags >20 round trips in an hour with flat PnL', () => {
    const trades = Array.from({ length: 22 }, (_, i) =>
      trade({
        side: i % 2 ? 'sell' : 'buy',
        notional: '100',
        realizedPnl: '0',
        createdAt: new Date(base + i * 60_000).toISOString(),
      }),
    );
    expect(isSuspectedWashTrading(trades)).toBe(true);
  });
  it('ignores spread-out or profitable trading', () => {
    const spread = Array.from({ length: 22 }, (_, i) =>
      trade({
        side: i % 2 ? 'sell' : 'buy',
        createdAt: new Date(base + i * 3_600_000).toISOString(),
      }),
    );
    expect(isSuspectedWashTrading(spread)).toBe(false);
    const profitable = Array.from({ length: 22 }, (_, i) =>
      trade({
        side: i % 2 ? 'sell' : 'buy',
        notional: '100',
        realizedPnl: i % 2 ? '10' : '0',
        createdAt: new Date(base + i * 60_000).toISOString(),
      }),
    );
    expect(isSuspectedWashTrading(profitable)).toBe(false);
    const buysOnly = Array.from({ length: 22 }, (_, i) =>
      trade({ createdAt: new Date(base + i * 1000).toISOString() }),
    );
    expect(isSuspectedWashTrading(buysOnly)).toBe(false);
  });
});

describe('tiers & ranking', () => {
  it('maps volume to tiers', () => {
    expect(tierForVolume('0')).toBe('rookie');
    expect(tierForVolume('500')).toBe('believer');
    expect(tierForVolume('5000')).toBe('degen');
    expect(tierForVolume('60000')).toBe('whale');
    expect(tierForVolume('250000')).toBe('legend');
  });
  it('ranks with ties sharing a rank', () => {
    const ranked = rankBy([{ v: '5' }, { v: '10' }, { v: '5' }, { v: '1' }], (x) => x.v);
    expect(ranked.map((r) => r.rank)).toEqual([1, 2, 2, 4]);
  });
  it('sums portfolio parts', () => {
    expect(
      portfolioValue({
        cashUsd: '10',
        cryptoUsd: '20',
        stockTokensUsd: '5',
        perpsMarginUsd: '15',
        perpsUnrealizedUsd: '-3',
      }),
    ).toBe('47');
    expect(addAll(['1', '2'])).toBe('3');
    expect(accumulate('1', '2')).toBe('3');
  });
});
