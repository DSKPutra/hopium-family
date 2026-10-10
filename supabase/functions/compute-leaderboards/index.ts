import { handler, json } from '../_shared/http.ts';
import { adminClient, requireCron } from '../_shared/supabase.ts';
import type { LeaderboardMetric, LeaderboardPeriod, Thesis, Trade } from '@hopium/core/types';
import { computeBoard } from './logic.ts';

const PERIODS: Record<LeaderboardPeriod, number> = {
  daily: 1,
  weekly: 7,
  season: 90,
  all_time: 3650,
};
const METRICS: LeaderboardMetric[] = ['pnl_pct', 'thesis_accuracy', 'copiers'];

/** Cron (hourly): writes leaderboard_snapshots for every period × metric. */
Deno.serve(
  handler(async (req) => {
    requireCron(req);
    const admin = adminClient();
    let written = 0;
    for (const [period, days] of Object.entries(PERIODS) as [LeaderboardPeriod, number][]) {
      const since = new Date(Date.now() - days * 86_400_000).toISOString();
      const { data: trades } = await admin
        .from('trades')
        .select('*')
        .gte('created_at', since)
        .not('user_id', 'is', null)
        .limit(50_000);
      const { data: theses } = await admin
        .from('theses')
        .select('*')
        .gte('created_at', since)
        .limit(20_000);
      const byUser = new Map<string, Trade[]>();
      for (const t of trades ?? []) {
        const list = byUser.get(t.user_id) ?? [];
        list.push({
          ...t,
          userId: t.user_id,
          realizedPnl: String(t.realized_pnl),
          notional: String(t.notional),
          createdAt: t.created_at,
          assetId: t.asset_id,
          copiers: t.copiers,
        } as Trade);
        byUser.set(t.user_id, list);
      }
      const thesesByUser = new Map<string, Thesis[]>();
      for (const t of theses ?? []) {
        const list = thesesByUser.get(t.author_id) ?? [];
        list.push({ ...t, status: t.status } as Thesis);
        thesesByUser.set(t.author_id, list);
      }
      for (const metric of METRICS) {
        const { data: prev } = await admin
          .from('leaderboard_snapshots')
          .select('user_id, rank')
          .eq('period', period)
          .eq('metric', metric);
        const prevRank = new Map((prev ?? []).map((p) => [p.user_id as string, p.rank as number]));
        const rows = computeBoard(metric, byUser, thesesByUser).slice(0, 500);
        await admin
          .from('leaderboard_snapshots')
          .delete()
          .eq('period', period)
          .eq('metric', metric);
        if (rows.length) {
          await admin.from('leaderboard_snapshots').insert(
            rows.map((r) => ({
              period,
              metric,
              user_id: r.userId,
              rank: r.rank,
              previous_rank: prevRank.get(r.userId) ?? null,
              value: r.value,
            })),
          );
        }
        written += rows.length;
      }
    }
    return json({ written });
  }),
);
