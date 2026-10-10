import { handler, json } from '../_shared/http.ts';
import { fetchPrices } from '../_shared/prices.ts';
import { sendExpoPush } from '../_shared/push.ts';
import { adminClient, requireCron } from '../_shared/supabase.ts';
import { resolveThesis } from '@hopium/core/trading/thesis';

/** Cron (every 5 min): marks theses hit / invalidated / expired; awards badges; notifies authors. */
Deno.serve(
  handler(async (req) => {
    requireCron(req);
    const admin = adminClient();
    const { data: theses } = await admin
      .from('theses')
      .select('*')
      .eq('status', 'active')
      .limit(1000);
    const prices = await fetchPrices((theses ?? []).map((t) => t.asset_id as string));
    let resolved = 0;
    for (const t of theses ?? []) {
      const price = prices[t.asset_id as string];
      if (!price) continue;
      const r = resolveThesis(
        {
          direction: t.direction,
          entryPrice: String(t.entry_price),
          targetPrice: String(t.target_price),
          invalidationPrice: String(t.invalidation_price),
          timeframeEnd: t.timeframe_end,
          status: 'active',
          maxFavorablePct: String(t.max_favorable_pct),
        },
        price,
      );
      if (r.status === 'active') {
        await admin.from('theses').update({ max_favorable_pct: r.maxFavorablePct }).eq('id', t.id);
        continue;
      }
      resolved++;
      await admin
        .from('theses')
        .update({
          status: r.status,
          resolved_at: new Date().toISOString(),
          max_favorable_pct: r.maxFavorablePct,
        })
        .eq('id', t.id);
      if (r.status === 'hit')
        await admin.from('user_badges').upsert({ user_id: t.author_id, slug: 'oracle' });
      await admin.from('notifications').insert({
        user_id: t.author_id,
        type: 'thesis_update',
        title: `notifications.thesis.${r.status}.title`,
        body: 'notifications.thesis.body',
        data: { href: `/thesis/${t.id}`, params: { symbol: t.symbol } },
      });
      await sendExpoPush(admin, [t.author_id], 'hopium.family', `${t.symbol}: ${r.status}`, {
        href: `/thesis/${t.id}`,
      });
    }
    return json({ checked: theses?.length ?? 0, resolved });
  }),
);
