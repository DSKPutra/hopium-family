import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { AppError } from '@hopium/core/errors';

/** Service-role client (bypasses RLS) — server only, never shipped to clients. */
export function adminClient(): SupabaseClient {
  const url = Deno.env.get('SUPABASE_URL');
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !key) throw new Error('Supabase env is not configured');
  return createClient(url, key, { auth: { persistSession: false } });
}

/** Resolves the calling user from the Authorization header. */
export async function requireUser(
  req: Request,
  admin: SupabaseClient,
): Promise<{ id: string; email: string | null }> {
  const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (!token) throw new AppError('not_authenticated', 'Please sign in.');
  const { data, error } = await admin.auth.getUser(token);
  if (error || !data.user) throw new AppError('not_authenticated', 'Please sign in.');
  return { id: data.user.id, email: data.user.email ?? null };
}

/** Per-user rate limit (default 30 requests/minute per bucket). */
export async function rateLimit(
  admin: SupabaseClient,
  userId: string,
  bucket: string,
  limit = 30,
): Promise<void> {
  const { data, error } = await admin.rpc('hit_rate_limit', {
    p_user: userId,
    p_bucket: bucket,
    p_limit: limit,
  });
  if (error) throw new Error(error.message);
  if (data === false)
    throw new AppError('rate_limited', 'Too many requests. Please wait a moment.');
}

/** Cron-only functions require the service role key as bearer. */
export function requireCron(req: Request): void {
  const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (!token || token !== Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'))
    throw new AppError('not_authenticated', 'Cron only.');
}
