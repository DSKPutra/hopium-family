import { resolveProviderImpl, type AppMode, type ProviderKind } from '../config';
import type { Chain } from '../types';
import type { AnalyticsProvider, Providers } from './interfaces';
import { createMockProviders, type CreateMockProvidersOptions, type MockProviders } from './mock';
import {
  CoinGeckoMarketData,
  HostedKycProvider,
  HyperliquidPerps,
  MoonPayOnramp,
  PostHogAnalytics,
  RealStockTokenProvider,
  RealSwapProvider,
  RealWalletProvider,
  type FetchLike,
} from './real';

export interface ProviderRegistryConfig {
  mode: AppMode;
  flags: Partial<Record<ProviderKind, string | undefined>>;
  env: {
    walletAppId?: string;
    coingeckoKey?: string;
    stockTokenApiUrl?: string;
    perpsExchangeUrl?: string;
    onrampKey?: string;
    functionsUrl?: string;
    posthogKey?: string;
  };
  fetch: FetchLike;
  openBrowser: (url: string) => Promise<'completed' | 'cancelled'>;
  authHeader: () => Promise<Record<string, string>>;
  resolveToken: (assetId: string, chain: Chain) => { address: string; decimals: number };
  mock?: CreateMockProvidersOptions;
}

export type ProviderSelection = Record<ProviderKind, string>;

export function selectProviders(
  config: Pick<ProviderRegistryConfig, 'mode' | 'flags'>,
): ProviderSelection {
  const pick = (kind: ProviderKind) => resolveProviderImpl(config.mode, config.flags[kind]);
  return {
    wallet: pick('wallet'),
    marketdata: pick('marketdata'),
    onramp: pick('onramp'),
    perps: pick('perps'),
    stocktoken: pick('stocktoken'),
    swap: pick('swap'),
    kyc: pick('kyc'),
  };
}

/**
 * Picks mock vs real per provider. Demo mode (the default) always returns the
 * fully simulated set, so the app runs with no keys and no real money.
 */
export function createProviders(config: ProviderRegistryConfig): {
  providers: Providers;
  mock: MockProviders;
  selection: ProviderSelection;
} {
  const mock = createMockProviders(config.mock);
  const selection = selectProviders(config);
  if (config.mode === 'demo') return { providers: mock, mock, selection };

  const functions = config.env.functionsUrl ?? '';
  const wallet =
    selection.wallet === 'mock'
      ? mock.wallet
      : new RealWalletProvider({ provider: selection.wallet, appId: config.env.walletAppId });
  const analytics: AnalyticsProvider = config.env.posthogKey
    ? new PostHogAnalytics(config.fetch, { apiKey: config.env.posthogKey })
    : mock.analytics;
  const providers: Providers = {
    wallet,
    marketData:
      selection.marketdata === 'mock'
        ? mock.marketData
        : new CoinGeckoMarketData(config.fetch, { apiKey: config.env.coingeckoKey }),
    swap:
      selection.swap === 'mock'
        ? mock.swap
        : new RealSwapProvider(config.fetch, wallet, config.resolveToken),
    stockTokens:
      selection.stocktoken === 'mock'
        ? mock.stockTokens
        : new RealStockTokenProvider(config.fetch, wallet, { apiUrl: config.env.stockTokenApiUrl }),
    perps:
      selection.perps === 'mock'
        ? mock.perps
        : new HyperliquidPerps(config.fetch, wallet, {
            exchangeProxyUrl: config.env.perpsExchangeUrl,
          }),
    onramp:
      selection.onramp === 'mock'
        ? mock.onramp
        : new MoonPayOnramp(config.fetch, config.openBrowser, {
            publishableKey: config.env.onrampKey,
            signUrlEndpoint: functions ? `${functions}/onramp-sign-url` : undefined,
            walletAddress: async () => (await wallet.getAddresses()).solana,
          }),
    kyc:
      selection.kyc === 'mock'
        ? mock.kyc
        : new HostedKycProvider(config.fetch, config.openBrowser, {
            endpoint: functions ? `${functions}/kyc` : undefined,
            authHeader: config.authHeader,
          }),
    analytics,
  };
  return { providers, mock, selection };
}
