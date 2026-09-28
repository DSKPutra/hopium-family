import { DEFAULT_SLIPPAGE_BPS, type Language, type ThemePreference } from '@hopium/core';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { zustandStorage } from '@/lib/storage';

export interface SettingsState {
  theme: ThemePreference;
  language: Language | null;
  displayCurrency: 'USD' | 'IDR';
  hideBalances: boolean;
  biometricOnOpen: boolean;
  biometricForTrades: boolean;
  slippageBps: number;
  lastAmountUsd: string;
  watchlist: string[];
  recentSearches: string[];
  notificationPrimerSeen: boolean;
  set: (
    patch: Partial<Omit<SettingsState, 'set' | 'toggleWatch' | 'addRecentSearch' | 'reset'>>,
  ) => void;
  toggleWatch: (assetId: string) => boolean;
  addRecentSearch: (q: string) => void;
  reset: () => void;
}

const defaults = {
  theme: 'dark' as ThemePreference,
  language: null,
  displayCurrency: 'USD' as const,
  hideBalances: false,
  biometricOnOpen: false,
  biometricForTrades: false,
  slippageBps: DEFAULT_SLIPPAGE_BPS,
  lastAmountUsd: '25',
  watchlist: ['btc', 'sol', 'hope', 'aaplx'],
  recentSearches: [] as string[],
  notificationPrimerSeen: false,
};

/** Per-device preferences, persisted with MMKV (native) / localStorage (web). */
export const useSettings = create<SettingsState>()(
  persist(
    (set, get) => ({
      ...defaults,
      set: (patch) => set(patch),
      toggleWatch: (assetId) => {
        const has = get().watchlist.includes(assetId);
        set({
          watchlist: has
            ? get().watchlist.filter((a) => a !== assetId)
            : [assetId, ...get().watchlist],
        });
        return !has;
      },
      addRecentSearch: (q) => {
        const query = q.trim();
        if (!query) return;
        set({
          recentSearches: [query, ...get().recentSearches.filter((r) => r !== query)].slice(0, 8),
        });
      },
      reset: () => set(defaults),
    }),
    { name: 'hopium.settings', storage: createJSONStorage(() => zustandStorage), version: 1 },
  ),
);
