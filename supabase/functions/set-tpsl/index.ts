import { z } from 'zod';
import { handler, json } from '../_shared/http.ts';
import { adminClient, rateLimit, requireUser } from '../_shared/supabase.ts';
import { AppError } from '@hopium/core/errors';
import { assertTpSl } from '@hopium/core/trading/perps';

const decimal = z.string().regex(/^\d+(\.\d+)?$/);
const schema = z.object({ positionId: z.string().uuid(), tp: decimal.optional(), sl: decimal.optional() });

Deno.serve(
  handler(async (req) => {
    const admin = adminClient();
    const user = await requireUser(req, admin);
    await rateLimit(admin, user.id, 'perps');
    const input = schema.parse(await req.json());
    const { data: pos } = await admin.from('perp_positions').select('*').eq('id', input.positionId).eq('user_id', user.id).single();
    if (!pos || pos.status !== 'open') throw new AppError('not_found', 'Position not found');
    assertTpSl({ side: pos.side, entry: String(pos.entry_price), liqPrice: String(pos.liq_price), tp: input.tp, sl: input.sl });
    await admin.from('perp_positions').update({ tp: input.tp ?? null, sl: input.sl ?? null }).eq('id', pos.id);
    return json({ ok: true });
  }),
);
