import type { Decimal } from '@hopium/core';
import { useIsFocused } from 'expo-router';
import { useEffect, useState } from 'react';

import { useServices } from './useServices';

/** Focus state, or `true` when rendered outside a navigator (desktop rail, global sheets). */
function useSafeIsFocused(): boolean {
  try {
    return useIsFocused();
  } catch {
    return true;
  }
}

export interface LivePrice {
  price: Decimal;
  change24hPct: Decimal;
}

/**
 * Subscribes to price ticks while the screen is focused and unsubscribes on
 * blur, so only visible assets stream.
 */
export function useLivePrice(
  assetId: string | undefined,
  initial?: LivePrice,
): LivePrice | undefined {
  const { market } = useServices();
  const focused = useSafeIsFocused();
  const [tick, setTick] = useState<(LivePrice & { assetId: string }) | undefined>(undefined);

  useEffect(() => {
    if (!assetId || !focused) return;
    return market.subscribePrices([assetId], (t) =>
      setTick({ assetId, price: t.price, change24hPct: t.change24hPct }),
    );
  }, [assetId, focused, market]);

  if (tick && tick.assetId === assetId)
    return { price: tick.price, change24hPct: tick.change24hPct };
  const last = assetId ? market.lastPrice?.(assetId) : undefined;
  if (last) return { price: last, change24hPct: initial?.change24hPct ?? '0' };
  return initial;
}
