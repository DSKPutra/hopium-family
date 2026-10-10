import { handler, json } from '../_shared/http.ts';
import { assertFeature } from '../_shared/compliance.ts';
import { adminClient, rateLimit, requireUser } from '../_shared/supabase.ts';
import { AppError } from '@hopium/core/errors';
import { openPerpSchema, preparePerp } from './logic.ts';

/** Validates and records a perp order; execution goes to Hyperliquid via an agent wallet. */
Deno.serve(
  handler(async (req) => {
    const admin = adminClient();
    const user = await requireUser(req, admin);
    await rateLimit(admin, user.id, 'perps');
    const input = openPerpSchema.parse(await req.json());
    await assertFeature(admin, user.id, 'perps');
    const markets = await fetch('https://api.hyperliquid.xyz/info', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ type: 'metaAndAssetCtxs' }),
    }).then(
      (r) =>
        r.json() as Promise<
          [{ universe: { name: string; maxLeverage: number }[] }, { markPx: string }[]]
        >,
    );
    const coin = input.marketId.replace('-perp', '').toUpperCase();
    const idx = markets[0].universe.findIndex((u) => u.name === coin);
    if (idx < 0) throw new AppError('not_found', 'Unknown market');
    const meta = markets[0].universe[idx]!;
    const ctx = markets[1][idx]!;
    const { size, liqPrice } = preparePerp(input, {
      maxLeverage: meta.maxLeverage,
      maintenanceMarginRate: String(1 / (meta.maxLeverage * 2)),
      markPrice: ctx.markPx,
    });
    const { data, error } = await admin
      .from('perp_positions')
      .insert({
        user_id: user.id,
        market: input.marketId,
        side: input.side,
        size,
        entry_price: ctx.markPx,
        leverage: input.leverage,
        margin: input.marginUsd,
        liq_price: liqPrice,
        tp: input.tp,
        sl: input.sl,
      })
      .select('*')
      .single();
    if (error) throw new Error(error.message);
    await admin.from('activity').insert({
      user_id: user.id,
      kind: 'perp_open',
      title: input.side,
      symbol: `${coin}-PERP`,
      amount_usd: input.marginUsd,
      qty: size,
      side: input.side,
    });
    return json(data);
  }),
);
