import {
  createProviders,
  DemoBackend,
  type Backend,
  type MarketDataProvider,
  type MockProviders,
  type Providers,
} from '@hopium/core';
import * as WebBrowser from 'expo-web-browser';
import { AppState, Platform } from 'react-native';

import { env, useSupabase } from './env';
import { kv } from './storage';
import type { SupabaseBackend } from './supabaseBackend';

export interface Services {
  backend: Backend;
  providers: Providers;
  mock: MockProviders;
  market: MarketDataProvider;
  demo: DemoBackend | null;
}

const DEMO_KEY = 'hopium.demo.state.v3';

let services: Services | null = null;
let supabase: SupabaseBackend | null = null;

async function openBrowser(url: string): Promise<'completed' | 'cancelled'> {
  const res = await WebBrowser.openAuthSessionAsync(url, 'hopium://');
  return res.type === 'success' ? 'completed' : 'cancelled';
}

/**
 * Wires providers and the backend once. Demo mode (default) uses the
 * in-memory DemoBackend persisted to device storage; with a Supabase project
 * configured in live mode it uses SupabaseBackend.
 */
export function getServices(): Services {
  if (services) return services;
  const { providers, mock } = createProviders({
    mode: env.appMode,
    flags: env.providers,
    env: {
      walletAppId: env.walletAppId,
      coingeckoKey: env.coingeckoKey,
      stockTokenApiUrl: env.stockTokenApiUrl,
      perpsExchangeUrl: env.perpsExchangeUrl,
      onrampKey: env.onrampKey,
      functionsUrl: env.supabaseUrl ? `${env.supabaseUrl}/functions/v1` : undefined,
      posthogKey: env.posthogKey,
    },
    fetch: (input, init) => fetch(input, init),
    openBrowser,
    authHeader: async () => (supabase ? supabase.authHeader() : {}),
    resolveToken: (assetId) => ({ address: assetId, decimals: 6 }),
  });
  let backend: Backend;
  let demo: DemoBackend | null = null;
  // The literal env check lets production bundles drop the Supabase client
  // entirely from demo builds (EXPO_PUBLIC_* values are inlined at build time).
  if (process.env.EXPO_PUBLIC_APP_MODE === 'live' && useSupabase) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- conditional require keeps Supabase out of demo bundles
    const mod = require('./supabaseBackend') as typeof import('./supabaseBackend');
    supabase = new mod.SupabaseBackend({
      url: env.supabaseUrl,
      anonKey: env.supabaseAnonKey,
      providers,
    });
    backend = supabase;
  } else {
    demo = new DemoBackend(mock, {
      storage: {
        load: () => kv.getString(DEMO_KEY) ?? null,
        save: (v) => kv.set(DEMO_KEY, v),
        clear: () => kv.remove(DEMO_KEY),
      },
    });
    backend = demo;
    flushOnExit(demo);
  }
  services = { backend, providers, mock, market: providers.marketData, demo };
  return services;
}

/** Persist pending demo state when the tab is hidden/closed or the app backgrounds. */
function flushOnExit(demo: DemoBackend): void {
  if (Platform.OS === 'web') {
    if (typeof window === 'undefined') return;
    window.addEventListener('pagehide', () => demo.saveNow());
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') demo.saveNow();
    });
    return;
  }
  AppState.addEventListener('change', (state) => {
    if (state !== 'active') demo.saveNow();
  });
}

/** Convenience accessor for non-React code. */
export const backend = (): Backend => getServices().backend;
