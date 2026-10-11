import { useSyncExternalStore } from 'react';

import type { PwaState } from './pwa';

export type { PwaState } from './pwa';

/** Chrome/Edge/Android install prompt (not in the standard DOM typings). */
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const isBrowser = typeof window !== 'undefined';
let deferred: BeforeInstallPromptEvent | null = null;
let installed = false;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());

// Captured at import time: the event can fire before React mounts.
if (isBrowser) {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferred = e as BeforeInstallPromptEvent;
    notify();
  });
  window.addEventListener('appinstalled', () => {
    deferred = null;
    installed = true;
    notify();
  });
}

function standalone(): boolean {
  if (!isBrowser) return false;
  const nav = navigator as Navigator & { standalone?: boolean };
  return (
    installed || nav.standalone === true || window.matchMedia('(display-mode: standalone)').matches
  );
}

function detectPlatform(): PwaState['platform'] {
  if (!isBrowser) return 'desktop';
  const ua = navigator.userAgent;
  // iPadOS reports as Mac; touch support tells them apart.
  if (/iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1))
    return 'ios';
  if (/Android/.test(ua)) return 'android';
  return 'desktop';
}

let snapshot: PwaState | null = null;
function getSnapshot(): PwaState {
  const next: PwaState = {
    platform: detectPlatform(),
    isStandalone: standalone(),
    canPrompt: deferred !== null,
  };
  if (
    !snapshot ||
    snapshot.platform !== next.platform ||
    snapshot.isStandalone !== next.isStandalone ||
    snapshot.canPrompt !== next.canPrompt
  )
    snapshot = next;
  return snapshot;
}

function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export function usePwa(): PwaState {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

/** Shows the browser's install dialog. Resolves true when the user accepts. */
export async function promptInstall(): Promise<boolean> {
  if (!deferred) return false;
  const event = deferred;
  deferred = null;
  notify();
  await event.prompt();
  const { outcome } = await event.userChoice;
  return outcome === 'accepted';
}

/** Registers the service worker (offline shell + push). Safe to call repeatedly. */
export function registerServiceWorker(): void {
  if (!isBrowser || !('serviceWorker' in navigator)) return;
  // Dev server: a caching worker would serve stale bundles while you edit.
  if (__DEV__) return;
  void navigator.serviceWorker.register('/sw.js').catch(() => undefined);
}
