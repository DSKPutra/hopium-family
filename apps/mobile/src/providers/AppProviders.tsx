import { BottomSheetProvider, ConfettiProvider, ThemeProvider, ToastProvider } from '@hopium/ui';
import { QueryClientProvider } from '@tanstack/react-query';
import { useEffect, type ReactNode } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import i18n, { detectDeviceLanguage } from '@/i18n';
import { addNotificationResponseListener } from '@/lib/notifications';
import { queryClient } from '@/lib/queryClient';
import { useSettings } from '@/stores/settings';
import { RealtimeProvider } from './RealtimeProvider';
import { TradeProvider } from './TradeProvider';

function LanguageSync() {
  const language = useSettings((s) => s.language);
  useEffect(() => {
    const next = language ?? detectDeviceLanguage();
    if (i18n.language !== next) void i18n.changeLanguage(next);
    if (typeof document !== 'undefined') document.documentElement.lang = next;
  }, [language]);
  return null;
}

export function AppProviders({ children }: { children: ReactNode }) {
  const theme = useSettings((s) => s.theme);
  const setSettings = useSettings((s) => s.set);
  useEffect(() => addNotificationResponseListener(), []);
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <ThemeProvider preference={theme} onPreferenceChange={(t) => setSettings({ theme: t })}>
            <LanguageSync />
            <ToastProvider>
              <ConfettiProvider>
                <BottomSheetProvider>
                  <RealtimeProvider>
                    <TradeProvider>{children}</TradeProvider>
                  </RealtimeProvider>
                </BottomSheetProvider>
              </ConfettiProvider>
            </ToastProvider>
          </ThemeProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
