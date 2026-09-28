import { router } from 'expo-router';
import { useEffect } from 'react';
import { Platform } from 'react-native';

import { useTrade } from '@/providers/TradeProvider';
import { useUi } from '@/stores/ui';

/** Web shortcuts: `/` search, `b` buy, `s` sell, `g h` home. */
export function useKeyboardShortcuts(enabled: boolean): void {
  const { openOrder } = useTrade();
  useEffect(() => {
    if (!enabled || Platform.OS !== 'web' || typeof window === 'undefined') return;
    let lastG = 0;
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (
        target &&
        (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)
      )
        return;
      const focused = useUi.getState().focusedAssetId;
      if (e.key === '/') {
        e.preventDefault();
        router.push('/search');
      } else if (e.key === 'b' || e.key === 's') {
        e.preventDefault();
        if (focused) openOrder({ assetId: focused, side: e.key === 'b' ? 'buy' : 'sell' });
        else router.push('/trade');
      } else if (e.key === 'g') {
        lastG = Date.now();
      } else if (e.key === 'h' && Date.now() - lastG < 800) {
        router.push('/');
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [enabled, openOrder]);
}
