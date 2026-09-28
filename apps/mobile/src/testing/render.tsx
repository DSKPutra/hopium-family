import { ConfettiProvider, ThemeProvider, ToastProvider } from '@hopium/ui';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react-native';
import type { ReactElement } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import '@/i18n';
import { TradeProvider } from '@/providers/TradeProvider';

export async function renderWithProviders(ui: ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return await render(
    <SafeAreaProvider initialMetrics={{ frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } }}>
      <QueryClientProvider client={client}>
        <ThemeProvider preference="dark" onPreferenceChange={() => undefined}>
          <ToastProvider>
            <ConfettiProvider>
              <TradeProvider>{ui}</TradeProvider>
            </ConfettiProvider>
          </ToastProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </SafeAreaProvider>,
  );
}
