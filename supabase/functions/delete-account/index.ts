import { handler, json } from '../_shared/http.ts';
import { adminClient, rateLimit, requireUser } from '../_shared/supabase.ts';
import { deleteSchema } from './logic.ts';

/**
 * Deletes the user's data. Trade records are kept anonymized (user_id → null)
 * where retention is legally required; everything else cascades with auth.users.
 */
Deno.serve(
  handler(async (req) => {
    const admin = adminClient();
    const user = await requireUser(req, admin);
    await rateLimit(admin, user.id, 'delete-account', 3);
    deleteSchema.parse(await req.json());
    await admin.from('trades').update({ user_id: null, is_public: false }).eq('user_id', user.id);
    await admin.storage
      .from('avatars')
      .remove([`${user.id}.jpg`])
      .catch(() => undefined);
    const { error } = await admin.auth.admin.deleteUser(user.id);
    if (error) throw new Error(error.message);
    return json({ deleted: true });
  }),
);
