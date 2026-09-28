import { gte } from '@hopium/core';
import { DemoModePill, IconButton, LogoMark, Text, useTheme } from '@hopium/ui';
import { router } from 'expo-router';
import { Bell, Search, Wallet } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';

import { usePortfolio, useUnreadCount } from '@/hooks/queries';
import { useResponsive } from '@/hooks/useResponsive';
import { isDemo } from '@/lib/env';
import { useFormat } from '@/lib/format';
import { useSettings } from '@/stores/settings';

/** Mobile header: logo · search · notifications · wallet balance chip. */
export function AppHeader({ title, right }: { title?: string; right?: ReactNode }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const f = useFormat();
  const unread = useUnreadCount();
  const portfolio = usePortfolio();
  const hide = useSettings((s) => s.hideBalances);
  const { isDesktop } = useResponsive();

  if (isDesktop) {
    return title ? (
      <View className="flex-row items-center justify-between py-4">
        <Text variant="h1">{title}</Text>
        <View className="flex-row items-center gap-2">
          {right}
          {isDemo ? <DemoModePill label={t('common.demoMode')} /> : null}
        </View>
      </View>
    ) : null;
  }

  return (
    <View className="flex-row items-center gap-1 py-2">
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('nav.home')}
        onPress={() => router.push('/')}
        className="mr-1 flex-row items-center gap-2"
      >
        <LogoMark size={34} />
        {title ? <Text variant="h2">{title}</Text> : null}
      </Pressable>
      {isDemo ? <DemoModePill label={t('common.demoMode')} /> : null}
      <View className="flex-1" />
      {right}
      <IconButton
        accessibilityLabel={t('nav.search')}
        icon={<Search size={22} color={colors.text} />}
        onPress={() => router.push('/search')}
      />
      <IconButton
        testID="header-bell"
        accessibilityLabel={t('nav.notifications')}
        icon={<Bell size={22} color={colors.text} />}
        badge={unread}
        onPress={() => router.push('/notifications')}
      />
      <Pressable
        testID="header-balance"
        accessibilityRole="button"
        accessibilityLabel={t('nav.wallet')}
        onPress={() => router.push('/wallet')}
        className="rounded-pill border-border bg-surface ml-1 min-h-[36px] flex-row items-center gap-1.5 border px-3"
      >
        <Wallet size={14} color={colors.primary} />
        <Text variant="small" numeric weight="semibold">
          {portfolio.data
            ? hide
              ? f.hidden
              : f.money(portfolio.data.totalUsd, { compact: gte(portfolio.data.totalUsd, 100_000) })
            : '—'}
        </Text>
      </Pressable>
    </View>
  );
}
