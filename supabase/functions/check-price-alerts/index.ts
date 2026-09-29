import { handler, json } from '../_shared/http.ts';
import { fetchPrices } from '../_shared/prices.ts';
import { sendExpoPush } from '../_shared/push.ts';
import { adminClient, requireCron } from '../_shared/supabase.ts';
import { alertTriggered } from './logic.ts';

/** Cron (every minute): triggers active price alerts and sends push. */
Deno.serve(
  handler(async (req) => {
    requireCron(req);
    const admin = adminClient();
    const { data: alerts } = await admin.from('price_alerts').select('*').eq('is_active', true).limit(5000);
    const prices = await fetchPrices((alerts ?? []).map((a) => a.asset_id as string));
    let triggered = 0;
    for (const a of alerts ?? []) {
      const price = prices[a.asset_id as string];
      if (!price || !alertTriggered(a.condition, String(a.value), String(a.base_price), price)) continue;
      triggered++;
      await admin.from('price_alerts').update({ is_active: false, triggered_at: new Date().toISOString() }).eq('id', a.id);
      const { data: settings } = await admin.from('notification_settings').select('price_alerts').eq('user_id', a.user_id).maybeSingle();
      if (settings?.price_alerts === false) continue;
      await admin.from('notifications').insert({
        user_id: a.user_id, type: 'price_alert', title: 'notifications.priceAlert.title', body: `notifications.priceAlert.${a.condition}`,
        data: { href: `/asset/${a.symbol}`, params: { symbol: a.symbol, value: String(a.value) } },
      });
      await sendExpoPush(admin, [a.user_id], a.symbol, `${a.symbol}: ${price}`, { href: `/asset/${a.symbol}` });
    }
    return json({ checked: alerts?.length ?? 0, triggered });
  }),
);
