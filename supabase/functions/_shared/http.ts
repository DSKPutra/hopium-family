/** Structured JSON responses and errors shared by every edge function. */
import { AppError, toAppError } from '@hopium/core/errors';
import { ZodError } from 'zod';

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'content-type': 'application/json' } });
}

const STATUS: Record<string, number> = {
  not_authenticated: 401,
  kyc_required: 403,
  region_restricted: 403,
  blocked: 403,
  not_found: 404,
  rate_limited: 429,
  invalid_input: 400,
  invalid_amount: 400,
  min_order: 400,
  invalid_tp: 400,
  invalid_sl: 400,
  sl_beyond_liquidation: 400,
  leverage_out_of_range: 400,
  high_leverage_unacknowledged: 400,
  insufficient_balance: 400,
  slippage_exceeded: 409,
  quote_expired: 409,
  content_rejected: 422,
};

/** Maps any thrown error to `{ code, message }` without leaking internals. */
export function errorResponse(err: unknown): Response {
  if (err instanceof ZodError) return json({ code: 'invalid_input', message: err.issues[0]?.message ?? 'Invalid input' }, 400);
  const e = toAppError(err);
  const status = STATUS[e.code] ?? 500;
  return json({ code: e.code, message: status === 500 ? 'Something went wrong. Please try again.' : e.message }, status);
}

export function handler(fn: (req: Request) => Promise<Response>): (req: Request) => Promise<Response> {
  return async (req) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
    try {
      return await fn(req);
    } catch (err) {
      if (!(err instanceof AppError) && !(err instanceof ZodError)) console.error('[edge]', err instanceof Error ? err.message : err);
      return errorResponse(err);
    }
  };
}
