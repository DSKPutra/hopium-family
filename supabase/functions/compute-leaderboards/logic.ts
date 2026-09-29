import { isSuspectedWashTrading, qualifies, rankBy, thesisAccuracyPct, traderMetrics } from '@hopium/core/trading/leaderboard';
import type { LeaderboardMetric, Thesis, Trade } from '@hopium/core/types';

/** Ranks users for one metric, excluding suspected wash traders from PnL boards. */
export function computeBoard(metric: LeaderboardMetric, tradesByUser: Map<string, Trade[]>, thesesByUser: Map<string, Thesis[]>) {
  const rows: { userId: string; value: string }[] = [];
  for (const [userId, trades] of tradesByUser) {
    if (metric === 'pnl_pct') {
      const m = traderMetrics(trades);
      if (qualifies(m) && !isSuspectedWashTrading(trades)) rows.push({ userId, value: m.pnlPct });
    } else if (metric === 'copiers') {
      rows.push({ userId, value: String(trades.reduce((a, t) => a + t.copiers, 0)) });
    }
  }
  if (metric === 'thesis_accuracy') {
    for (const [userId, theses] of thesesByUser) {
      const resolved = theses.filter((t) => t.status !== 'active');
      if (resolved.length >= 2) rows.push({ userId, value: thesisAccuracyPct(resolved.filter((t) => t.status === 'hit').length, resolved.length) });
    }
  }
  return rankBy(rows, (r) => r.value).map(({ item, rank }) => ({ ...item, rank }));
}
