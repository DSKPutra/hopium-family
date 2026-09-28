import { createContext, useContext, type ReactNode } from 'react';

import { useBackendEvents } from '@/hooks/useBackendEvents';

interface RealtimeValue {
  newPosts: number;
  resetNewPosts: () => void;
}

const RealtimeContext = createContext<RealtimeValue>({
  newPosts: 0,
  resetNewPosts: () => undefined,
});

export function RealtimeProvider({ children }: { children: ReactNode }) {
  const value = useBackendEvents();
  return <RealtimeContext.Provider value={value}>{children}</RealtimeContext.Provider>;
}

export const useRealtime = (): RealtimeValue => useContext(RealtimeContext);
