import { z } from 'zod';
import { handler, json } from '../_shared/http.ts';
import { adminClient, rateLimit, requireUser } from '../_shared/supabase.ts';
import { signUrl } from './logic.ts';

const schema = z.object({
  quote: z.object({
    fiat: z.enum(['USD', 'IDR']),
    fiatAmount: z.string(),
    asset: z.string(),
    chain: z.string(),
  }),
  method: z.enum(['apple_pay', 'google_pay', 'card']),
  walletAddress: z.string().min(20),
});

/** Signs a MoonPay widget URL with the server-only secret (never shipped to clients). */
Deno.serve(
  handler(async (req) => {
    const admin = adminClient();
    const user = await requireUser(req, admin);
    await rateLimit(admin, user.id, 'onramp', 10);
    const { quote, method, walletAddress } = schema.parse(await req.json());
    const key = Deno.env.get('ONRAMP_PUBLISHABLE_KEY');
    const secret = Deno.env.get('ONRAMP_SECRET_KEY');
    if (!key || !secret)
      return json({ code: 'provider_not_configured', message: 'On-ramp is not configured.' }, 503);
    const params = new URLSearchParams({
      apiKey: key,
      currencyCode:
        `${quote.asset}_${quote.chain === 'solana' ? 'sol' : quote.chain}`.toLowerCase(),
      baseCurrencyCode: quote.fiat.toLowerCase(),
      baseCurrencyAmount: quote.fiatAmount,
      walletAddress,
      paymentMethod: method === 'card' ? 'credit_debit_card' : method,
      externalCustomerId: user.id,
    });
    return json({ url: await signUrl(`https://buy.moonpay.com?${params.toString()}`, secret) });
  }),
);
