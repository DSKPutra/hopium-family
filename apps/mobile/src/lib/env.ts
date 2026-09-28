import { parseAppMode, resolveProviderImpl, type ProviderKind } from '@hopium/core';
import Constants from 'expo-constants';

/**
 * Public (client-safe) configuration. Only `EXPO_PUBLIC_*` values are inlined
 * into the bundle — secrets must never use that prefix.
 */
export const env = {
  appMode: parseAppMode(process.env.EXPO_PUBLIC_APP_MODE),
  supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL ?? '',
  supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '',
  walletAppId: process.env.EXPO_PUBLIC_WALLET_APP_ID ?? '',
  sentryDsn: process.env.EXPO_PUBLIC_SENTRY_DSN ?? '',
  posthogKey: process.env.EXPO_PUBLIC_POSTHOG_KEY ?? '',
  coingeckoKey: process.env.EXPO_PUBLIC_COINGECKO_KEY ?? '',
  onrampKey: process.env.EXPO_PUBLIC_ONRAMP_KEY ?? '',
  stockTokenApiUrl: process.env.EXPO_PUBLIC_STOCKTOKEN_API_URL ?? '',
  perpsExchangeUrl: process.env.EXPO_PUBLIC_PERPS_EXCHANGE_URL ?? '',
  providers: {
    wallet: process.env.EXPO_PUBLIC_WALLET_PROVIDER,
    marketdata: process.env.EXPO_PUBLIC_MARKETDATA_PROVIDER,
    onramp: process.env.EXPO_PUBLIC_ONRAMP_PROVIDER,
    perps: process.env.EXPO_PUBLIC_PERPS_PROVIDER,
    stocktoken: process.env.EXPO_PUBLIC_STOCKTOKEN_PROVIDER,
    swap: process.env.EXPO_PUBLIC_SWAP_PROVIDER,
    kyc: process.env.EXPO_PUBLIC_KYC_PROVIDER,
  } satisfies Record<ProviderKind, string | undefined>,
  version: Constants.expoConfig?.version ?? '1.0.0',
  build: String(Constants.expoConfig?.extra?.build ?? '1'),
} as const;

export const isDemo = env.appMode === 'demo';
export const useSupabase = !isDemo && !!env.supabaseUrl && !!env.supabaseAnonKey;

export const providerImpl = (kind: ProviderKind): string =>
  resolveProviderImpl(env.appMode, env.providers[kind]);
