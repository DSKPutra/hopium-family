import { z } from 'zod';
import { handler, json } from '../_shared/http.ts';
import { moderateText } from '../_shared/moderation.ts';
import { adminClient, rateLimit, requireUser } from '../_shared/supabase.ts';

const schema = z.object({ body: z.string().min(1).max(2000) });

/** Profanity/spam filter and link blocking; 3+ reports auto-hide via trigger. */
Deno.serve(
  handler(async (req) => {
    const admin = adminClient();
    const user = await requireUser(req, admin);
    await rateLimit(admin, user.id, 'moderate', 60);
    return json(moderateText(schema.parse(await req.json()).body));
  }),
);
