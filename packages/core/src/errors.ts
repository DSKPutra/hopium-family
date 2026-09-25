/**
 * Typed errors carry a stable `code` so the UI can map them to translated,
 * plain-language messages (see `errors.*` keys in the i18n files).
 */
export type AppErrorCode =
  | 'slippage_exceeded'
  | 'insufficient_balance'
  | 'network_busy'
  | 'min_order'
  | 'quote_expired'
  | 'invalid_amount'
  | 'invalid_tp'
  | 'invalid_sl'
  | 'sl_beyond_liquidation'
  | 'leverage_out_of_range'
  | 'high_leverage_unacknowledged'
  | 'region_restricted'
  | 'kyc_required'
  | 'not_found'
  | 'not_authenticated'
  | 'username_taken'
  | 'invalid_input'
  | 'rate_limited'
  | 'blocked'
  | 'content_rejected'
  | 'provider_not_configured'
  | 'unknown';

export class AppError extends Error {
  readonly code: AppErrorCode;
  readonly details: Record<string, string | number> | undefined;

  constructor(code: AppErrorCode, message?: string, details?: Record<string, string | number>) {
    super(message ?? code);
    this.name = 'AppError';
    this.code = code;
    this.details = details;
  }
}

export class ProviderNotConfiguredError extends AppError {
  readonly provider: string;
  readonly missing: string[];

  constructor(provider: string, missing: string[], hint?: string) {
    super(
      'provider_not_configured',
      `${provider} is not configured. Set ${missing.join(', ')}${hint ? ` — ${hint}` : ''}.`,
      { provider },
    );
    this.name = 'ProviderNotConfiguredError';
    this.provider = provider;
    this.missing = missing;
  }
}

export function toAppError(err: unknown): AppError {
  if (err instanceof AppError) return err;
  if (err instanceof Error) return new AppError('unknown', err.message);
  return new AppError('unknown', String(err));
}
