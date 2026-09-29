import { z } from 'zod';
import { handler, json } from '../_shared/http.ts';
import { adminClient, rateLimit, requireUser } from '../_shared/supabase.ts';
import { AppError } from '@hopium/core/errors';
import { closeAmounts } from './logic.ts';

const schema = z.object({ positionId: z.string().uuid(), sizePct: z.number().min(1).max(100) });

Deno.serve(
  handler(async (req) => {
    const admin = adminClient();
    const user = await requireUser(req, admin);
    await rateLimit(admin, user.id, 'perps');
    const { positionId, sizePct } = schema.parse(await req.json());
    const { data: pos } = await admin.from('perp_positions').select('*').eq('id', positionId).eq('user_id', user.id).single();
    if (!pos || pos.status !== 'open') throw new AppError('not_found', 'Position not found');
    const [meta, ctxs] = await fetch('https://api.hyperliquid.xyz/info', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ type: 'metaAndAssetCtxs' }),
    }).then((r) => r.json() as Promise<[{ universe: { name: string }[] }, { markPx: string }[]]>);
    const coin = String(pos.market).replace('-perp', '').toUpperCase();
    const mark = ctxs[meta.universe.findIndex((u) => u.name === coin)]?.markPx;
    if (!mark) throw new AppError('not_found', 'Unknown market');
    const r = closeAmounts({ side: pos.side, entry: String(pos.entry_price), size: String(pos.size), margin: String(pos.margin), realized: String(pos.realized_pnl) }, mark, sizePct);
    await admin
      .from('perp_positions')
      .update(r.full ? { status: 'closed', closed_at: new Date().toISOString(), realized_pnl: r.realized } : { size: r.remainingSize, margin: r.remainingMargin, realized_pnl: r.realized })
      .eq('id', pos.id);
    await admin.from('activity').insert({ user_id: user.id, kind: 'perp_close', title: pos.side, symbol: `${coin}-PERP`, amount_usd: r.closedMargin, side: pos.side });
    return json({ txHash: `close:${pos.id}`, chain: 'arbitrum', status: 'confirmed', gasSponsored: true, explorerUrl: '' });
  }),
);
