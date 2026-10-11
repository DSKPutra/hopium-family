import { Platform } from 'react-native';

/** Installable-web-app state. Native builds are already apps, so this is inert there. */
export interface PwaState {
  platform: 'ios' | 'android' | 'desktop';
  /** Running as an installed app (home-screen PWA or native). */
  isStandalone: boolean;
  /** The browser offered an install prompt we can show (Chrome/Edge/Android). */
  canPrompt: boolean;
}

const NATIVE: PwaState = {
  platform: Platform.OS === 'ios' ? 'ios' : Platform.OS === 'android' ? 'android' : 'desktop',
  isStandalone: true,
  canPrompt: false,
};

export function usePwa(): PwaState {
  return NATIVE;
}

export async function promptInstall(): Promise<boolean> {
  return false;
}

export function registerServiceWorker(): void {}
