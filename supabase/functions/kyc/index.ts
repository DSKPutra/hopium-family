import { handler, json } from '../_shared/http.ts';
import { adminClient, rateLimit, requireUser } from '../_shared/supabase.ts';

/**
 * KYC: /status returns the stored status; /start creates a hosted verification
 * session with the provider (Sumsub/Persona) and marks the profile pending.
 * Results arrive through the provider's webhook (not included in demo mode).
 */
Deno.serve(
  handler(async (req) => {
    const admin = adminClient();
    const user = await requireUser(req, admin);
    await rateLimit(admin, user.id, 'kyc', 10);
    const path = new URL(req.url).pathname;
    if (path.endsWith('/status')) {
      const { data } = await admin.from('profiles').select('kyc_status').eq('id', user.id).single();
      return json({ status: data?.kyc_status ?? 'none' });
    }
    const template = Deno.env.get('KYC_TEMPLATE_ID');
    const apiKey = Deno.env.get('KYC_API_KEY');
    if (!template || !apiKey) return json({ code: 'provider_not_configured', message: 'KYC provider is not configured.' }, 503);
    const res = await fetch('https://withpersona.com/api/v1/inquiries', {
      method: 'POST',
      headers: { authorization: `Bearer ${apiKey}`, 'content-type': 'application/json' },
      body: JSON.stringify({ data: { attributes: { 'inquiry-template-id': template, 'reference-id': user.id } } }),
    });
    if (!res.ok) return json({ code: 'network_busy', message: 'Verification is temporarily unavailable.' }, 502);
    const body = (await res.json()) as { data: { id: string } };
    await admin.from('profiles').update({ kyc_status: 'pending' }).eq('id', user.id);
    return json({ url: `https://withpersona.com/verify?inquiry-id=${body.data.id}` });
  }),
);
