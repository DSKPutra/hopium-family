import { handler, json } from '../_shared/http.ts';
import { fetchPrices } from '../_shared/prices.ts';
import { sendExpoPush } from '../_shared/push.ts';
import { adminClient, requireCron } from '../_shared/supabase.ts';
import { isNearLiquidation } from '@hopium/core/trading/perps';

/** Cron (every minute): warns users when mark is within 10% of the estimated liquidation price. */
Deno.serve(
  handler(async (req) => {
    requireCron(req);
    const admin = adminClient();
    const { data: positions } = await admin.from('perp_positions').select('*').eq('status', 'open').limit(10_000);
    const prices = await fetchPrices((positions ?? []).map((p) => p.market as string));
    let warned = 0;
    for (const p of positions ?? []) {
      const mark = prices[p.market as string];
      if (!mark || !isNearLiquidation(p.side, mark, String(p.liq_price))) continue;
      const since = new Date(Date.now() - 30 * 60_000).toISOString();
      const { count } = await admin.from('notifications').select('id', { count: 'exact', head: true }).eq('user_id', p.user_id).eq('type', 'liquidation_risk').gte('created_at', since).contains('data', { positionId: p.id });
      if (count) continue;
      warned++;
      const market = String(p.market).toUpperCase();
      await admin.from('notifications').insert({
        user_id: p.user_id, type: 'liquidation_risk', title: 'notifications.liquidationRisk.title', body: 'notifications.liquidationRisk.body',
        data: { href: `/perps/${p.market}`, positionId: p.id, params: { market } },
      });
      await sendExpoPush(admin, [p.user_id], 'Liquidation risk', `Your ${market} position is close to its estimated liquidation price.`, { href: `/perps/${p.market}` });
    }
    return json({ checked: positions?.length ?? 0, warned });
  }),
);
