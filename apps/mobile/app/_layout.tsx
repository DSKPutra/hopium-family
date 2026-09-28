import '../global.css';
import '@/i18n';

import { Inter_400Regular, Inter_500Medium, Inter_600SemiBold } from '@expo-google-fonts/inter';
import { SpaceGrotesk_500Medium, SpaceGrotesk_700Bold } from '@expo-google-fonts/space-grotesk';
import { useTheme } from '@hopium/ui';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider as NavThemeProvider } from 'expo-router';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { AppLock } from '@/components/AppLock';
import { DesktopShell } from '@/components/desktop/DesktopShell';
import { NotificationPrimer } from '@/components/NotificationPrimer';
import { Seo } from '@/components/Seo';
import { useMe, useSession } from '@/hooks/queries';
import { AppProviders } from '@/providers/AppProviders';

void SplashScreen.preventAutoHideAsync().catch(() => undefined);

function RootNavigator({ fontsLoaded }: { fontsLoaded: boolean }) {
  const { t } = useTranslation();
  const { scheme, colors } = useTheme();
  const session = useSession();
  const me = useMe();
  const signedIn = !!session.data;
  const ready = fontsLoaded && !session.isLoading && (!signedIn || !me.isLoading);
  const onboarded = signedIn && !!me.data?.onboardedAt;

  useEffect(() => {
    if (ready) void SplashScreen.hideAsync().catch(() => undefined);
  }, [ready]);

  const navTheme = useMemo(() => {
    const base = scheme === 'dark' ? DarkTheme : DefaultTheme;
    return {
      ...base,
      colors: {
        ...base.colors,
        primary: colors.primary,
        background: colors.bg,
        card: colors.surface,
        text: colors.text,
        border: colors.border,
        notification: colors.loss,
      },
    };
  }, [scheme, colors]);

  if (!ready) return null;

  return (
    <NavThemeProvider value={navTheme}>
      <Seo title={t('meta.home')} description={t('meta.description')} path="/" />
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
      <DesktopShell enabled={onboarded}>
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: colors.bg },
            animation: 'slide_from_right',
          }}
        >
          <Stack.Protected guard={!onboarded}>
            <Stack.Screen name="(auth)" />
          </Stack.Protected>
          <Stack.Protected guard={onboarded}>
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="asset/[symbol]" />
            <Stack.Screen name="perps/[market]" />
            <Stack.Screen name="user/[username]" />
            <Stack.Screen name="thesis" />
            <Stack.Screen name="post/[id]" />
            <Stack.Screen name="wallet" />
            <Stack.Screen name="positions" />
            <Stack.Screen name="orders" />
            <Stack.Screen name="notifications" />
            <Stack.Screen name="search" options={{ animation: 'fade' }} />
            <Stack.Screen name="settings" />
            <Stack.Screen name="dev/components" />
            <Stack.Screen name="u/[username]" />
            <Stack.Screen name="a/[symbol]" />
            <Stack.Screen name="t/[id]" />
          </Stack.Protected>
          <Stack.Screen name="legal/[doc]" />
          <Stack.Screen name="+not-found" />
        </Stack>
      </DesktopShell>
      {onboarded ? <NotificationPrimer /> : null}
      <AppLock />
    </NavThemeProvider>
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    SpaceGrotesk_500Medium,
    SpaceGrotesk_700Bold,
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
  });
  return (
    <AppProviders>
      <RootNavigator fontsLoaded={fontsLoaded || !!fontError} />
    </AppProviders>
  );
}
