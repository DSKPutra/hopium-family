import type { FeedItem, Side } from '@hopium/core';
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';

import { OrderSheet } from '@/components/trading/OrderSheet';

export interface OrderRequest {
  assetId: string;
  side: Side;
  copyFrom?: FeedItem | null;
  amountUsd?: string;
}

interface TradeApi {
  openOrder: (req: OrderRequest) => void;
}

const TradeContext = createContext<TradeApi | null>(null);

/** One global order sheet, opened from any screen (asset, feed copy, shortcuts). */
export function TradeProvider({ children }: { children: ReactNode }) {
  const [request, setRequest] = useState<OrderRequest | null>(null);
  const openOrder = useCallback((req: OrderRequest) => setRequest(req), []);
  const api = useMemo(() => ({ openOrder }), [openOrder]);
  return (
    <TradeContext.Provider value={api}>
      {children}
      {request ? (
        <OrderSheet
          key={`${request.assetId}-${request.side}-${request.copyFrom?.post.id ?? ''}`}
          request={request}
          onClose={() => setRequest(null)}
        />
      ) : null}
    </TradeContext.Provider>
  );
}

export function useTrade(): TradeApi {
  const ctx = useContext(TradeContext);
  if (!ctx) throw new Error('useTrade must be used inside <TradeProvider>');
  return ctx;
}
