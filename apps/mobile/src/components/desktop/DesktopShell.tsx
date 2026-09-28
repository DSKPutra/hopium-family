import type { ReactNode } from 'react';
import { View } from 'react-native';

import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
import { useResponsive } from '@/hooks/useResponsive';
import { RightRail } from './RightRail';
import { Sidebar } from './Sidebar';

/** ≥1024px web: sidebar (240) · content (≤680) · right rail (340). */
export function DesktopShell({ enabled, children }: { enabled: boolean; children: ReactNode }) {
  const { isDesktop, width } = useResponsive();
  useKeyboardShortcuts(enabled && isDesktop);
  if (!enabled || !isDesktop) return <>{children}</>;
  return (
    <View className="bg-bg flex-1 flex-row justify-center">
      <Sidebar />
      <View className="flex-1" style={{ maxWidth: 760 }}>
        {children}
      </View>
      {width >= 1280 ? <RightRail /> : null}
    </View>
  );
}
