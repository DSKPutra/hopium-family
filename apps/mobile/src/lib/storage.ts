import type { MMKV } from 'react-native-mmkv';
import type { StateStorage } from 'zustand/middleware';

import { logger } from './logger';

export interface KeyValueStore {
  getString(key: string): string | undefined;
  set(key: string, value: string): void;
  remove(key: string): void;
}

/** In-memory fallback when native MMKV isn't available (e.g. Expo Go). */
function memoryStore(): KeyValueStore {
  const map = new Map<string, string>();
  return {
    getString: (k) => map.get(k),
    set: (k, v) => void map.set(k, v),
    remove: (k) => void map.delete(k),
  };
}

function create(): KeyValueStore {
  try {
    // MMKV on native, localStorage on web (react-native-mmkv ships a web build).
    // Loaded lazily: the import itself throws when the native module is absent
    // (Expo Go, Jest), and we want the in-memory fallback instead of a crash.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { createMMKV } = require('react-native-mmkv') as typeof import('react-native-mmkv');
    const mmkv: MMKV = createMMKV({ id: 'hopium' });
    return {
      getString: (k) => mmkv.getString(k),
      set: (k, v) => mmkv.set(k, v),
      remove: (k) => void mmkv.remove(k),
    };
  } catch (err) {
    logger.warn('Persistent storage unavailable, using memory store', err);
    return memoryStore();
  }
}

export const kv: KeyValueStore = create();

/** zustand `persist` adapter. */
export const zustandStorage: StateStorage = {
  getItem: (name) => kv.getString(name) ?? null,
  setItem: (name, value) => kv.set(name, value),
  removeItem: (name) => kv.remove(name),
};
