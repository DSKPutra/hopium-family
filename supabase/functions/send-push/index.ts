import { z } from 'zod';
import { handler, json } from '../_shared/http.ts';
import { sendExpoPush } from '../_shared/push.ts';
import { adminClient, requireCron } from '../_shared/supabase.ts';

const schema = z.object({ userIds: z.array(z.string().uuid()).min(1).max(1000), title: z.string().min(1).max(120), body: z.string().max(400), data: z.record(z.string(), z.unknown()).optional() });

/** Internal: sends Expo push (native) and prunes invalid tokens. Web Push is delivered by the service worker subscription. */
Deno.serve(
  handler(async (req) => {
    requireCron(req);
    const input = schema.parse(await req.json());
    const sent = await sendExpoPush(adminClient(), input.userIds, input.title, input.body, input.data ?? {});
    return json({ sent });
  }),
);
