import type { SupabaseClient } from '@supabase/supabase-js';

/** Sends Expo push notifications and removes tokens Expo reports invalid. */
export async function sendExpoPush(admin: SupabaseClient, userIds: string[], title: string, body: string, data: Record<string, unknown> = {}): Promise<number> {
  if (!userIds.length) return 0;
  const { data: tokens } = await admin.from('push_tokens').select('token, platform').in('user_id', userIds);
  const expoTokens = (tokens ?? []).filter((t) => t.platform !== 'web').map((t) => t.token as string);
  if (!expoTokens.length) return 0;
  const headers: Record<string, string> = { 'content-type': 'application/json', accept: 'application/json' };
  const accessToken = Deno.env.get('EXPO_ACCESS_TOKEN');
  if (accessToken) headers.authorization = `Bearer ${accessToken}`;
  const res = await fetch('https://exp.host/--/api/v2/push/send', {
    method: 'POST',
    headers,
    body: JSON.stringify(expoTokens.map((to) => ({ to, title, body, data, sound: 'default' }))),
  });
  const payload = (await res.json()) as { data?: { status: string; details?: { error?: string } }[] };
  const invalid = (payload.data ?? [])
    .map((r, i) => (r.status === 'error' && r.details?.error === 'DeviceNotRegistered' ? expoTokens[i] : null))
    .filter((t): t is string => !!t);
  if (invalid.length) await admin.from('push_tokens').delete().in('token', invalid);
  return expoTokens.length - invalid.length;
}
