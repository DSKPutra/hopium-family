import { Avatar, Button, DemoModePill, LogoLockup, Text, useTheme } from '@hopium/ui';
import { router, usePathname, type Href } from 'expo-router';
import {
  Bell,
  Compass,
  Home,
  LineChart,
  Settings,
  Trophy,
  User,
  Wallet,
} from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';

import { useMe, useUnreadCount } from '@/hooks/queries';
import { isDemo } from '@/lib/env';

export function Sidebar() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const pathname = usePathname();
  const unread = useUnreadCount();
  const me = useMe();
  const items: {
    href: Href;
    label: string;
    icon: typeof Home;
    match: (p: string) => boolean;
    badge?: number;
  }[] = [
    { href: '/', label: t('nav.home'), icon: Home, match: (p) => p === '/' },
    {
      href: '/discover',
      label: t('nav.discover'),
      icon: Compass,
      match: (p) => p.startsWith('/discover') || p.startsWith('/asset'),
    },
    {
      href: '/trade',
      label: t('nav.trade'),
      icon: LineChart,
      match: (p) => p.startsWith('/trade') || p.startsWith('/perps'),
    },
    {
      href: '/leaderboard',
      label: t('nav.leaderboard'),
      icon: Trophy,
      match: (p) => p.startsWith('/leaderboard'),
    },
    {
      href: '/notifications',
      label: t('nav.notifications'),
      icon: Bell,
      match: (p) => p.startsWith('/notifications'),
      badge: unread,
    },
    {
      href: '/wallet',
      label: t('nav.wallet'),
      icon: Wallet,
      match: (p) => p.startsWith('/wallet'),
    },
    {
      href: '/profile',
      label: t('nav.profile'),
      icon: User,
      match: (p) => p.startsWith('/profile'),
    },
    {
      href: '/settings',
      label: t('nav.settings'),
      icon: Settings,
      match: (p) => p.startsWith('/settings'),
    },
  ];
  return (
    <View role="navigation" className="border-border h-full w-[240px] gap-1 border-r px-3 py-5">
      <View className="mb-4 px-2">
        <LogoLockup size={30} />
        {isDemo ? (
          <View className="mt-2">
            <DemoModePill label={t('common.demoMode')} />
          </View>
        ) : null}
      </View>
      {items.map(({ href, label, icon: Icon, match, badge }) => {
        const active = match(pathname);
        return (
          <Pressable
            key={label}
            accessibilityRole="link"
            accessibilityState={{ selected: active }}
            onPress={() => router.navigate(href)}
            className={`rounded-pill web:focus-visible:outline web:focus-visible:outline-2 web:focus-visible:outline-primary min-h-[44px] flex-row items-center gap-3 px-3 ${active ? 'bg-surface-2' : 'hover:bg-surface'}`}
          >
            <Icon size={22} color={active ? colors.primary : colors.text} />
            <Text
              weight={active ? 'semibold' : 'medium'}
              tone={active ? 'default' : 'muted'}
              className="flex-1"
            >
              {label}
            </Text>
            {badge ? (
              <View className="rounded-pill bg-loss min-w-[20px] items-center px-1.5">
                <Text variant="micro" weight="semibold" style={{ color: '#FFFFFF' }}>
                  {badge > 99 ? '99+' : badge}
                </Text>
              </View>
            ) : null}
          </Pressable>
        );
      })}
      <Button
        label={t('nav.trade')}
        variant="gradient"
        className="mt-4"
        onPress={() => router.navigate('/trade')}
      />
      <View className="flex-1" />
      {me.data ? (
        <Pressable
          accessibilityRole="link"
          onPress={() => router.navigate('/profile')}
          className="rounded-pill hover:bg-surface flex-row items-center gap-2 p-2"
        >
          <Avatar
            id={me.data.id}
            name={me.data.displayName || me.data.username}
            uri={me.data.avatarUrl}
            size={36}
          />
          <View className="flex-1">
            <Text variant="small" weight="semibold" numberOfLines={1}>
              {me.data.displayName}
            </Text>
            <Text variant="micro" tone="muted" numberOfLines={1}>
              @{me.data.username}
            </Text>
          </View>
        </Pressable>
      ) : null}
      <Text variant="micro" tone="muted" className="px-2">
        {t('nav.shortcuts')}
      </Text>
    </View>
  );
}
