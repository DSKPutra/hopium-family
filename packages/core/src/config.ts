export type AppMode = 'demo' | 'live';

export const PROVIDER_KINDS = [
  'wallet',
  'marketdata',
  'onramp',
  'perps',
  'stocktoken',
  'swap',
  'kyc',
] as const;
export type ProviderKind = (typeof PROVIDER_KINDS)[number];

/** Anything other than an explicit `live` is treated as demo — safe by default. */
export function parseAppMode(raw: string | undefined | null): AppMode {
  return raw?.trim().toLowerCase() === 'live' ? 'live' : 'demo';
}

/**
 * Resolves which implementation a provider should use. Demo mode always forces
 * mocks so no real keys or funds are ever touched.
 */
export function resolveProviderImpl(mode: AppMode, flag: string | undefined | null): string {
  const value = flag?.trim().toLowerCase();
  if (mode === 'demo' || !value) return 'mock';
  return value;
}
