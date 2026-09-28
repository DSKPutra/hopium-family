import type { AppNotification } from '@hopium/core';
import {
  Button,
  Card,
  EmptyState,
  IconButton,
  Screen,
  SkeletonList,
  Text,
  useTheme,
} from '@hopium/ui';
import { useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import {
  AlertTriangle,
  ArrowLeft,
  Award,
  Bell,
  Heart,
  MessageCircle,
  Rocket,
  TrendingUp,
  Trash2,
  UserPlus,
  Wallet,
} from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';

import { Seo } from '@/components/Seo';
import { useNotifications } from '@/hooks/queries';
import { useServices } from '@/hooks/useServices';
import { tKey } from '@/lib/errors';
import { timeAgo } from '@/lib/format';
import { queryKeys } from '@/lib/queryKeys';

export default function Notifications() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const qc = useQueryClient();
  const { backend } = useServices();
  const q = useNotifications();
  const refresh = () => void qc.invalidateQueries({ queryKey: queryKeys.notifications });
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const today = (q.data ?? []).filter((n) => Date.parse(n.createdAt) >= startOfDay.getTime());
  const earlier = (q.data ?? []).filter((n) => Date.parse(n.createdAt) < startOfDay.getTime());

  const iconFor = (type: AppNotification['type']) => {
    switch (type) {
      case 'followed_trade':
        return <Rocket size={18} color={colors.primary} />;
      case 'liquidation_risk':
      case 'liquidated':
        return <AlertTriangle size={18} color={colors.loss} />;
      case 'price_alert':
        return <TrendingUp size={18} color={colors.accent} />;
      case 'social_like':
        return <Heart size={18} color={colors.loss} />;
      case 'social_comment':
        return <MessageCircle size={18} color={colors.secondary} />;
      case 'social_follow':
        return <UserPlus size={18} color={colors.secondary} />;
      case 'badge':
      case 'rank_up':
        return <Award size={18} color={colors.accent} />;
      case 'deposit':
        return <Wallet size={18} color={colors.gain} />;
      default:
        return <Bell size={18} color={colors.text} />;
    }
  };

  const renderItem = (n: AppNotification) => (
    <View key={n.id} className="flex-row items-center gap-3 py-2">
      <Pressable
        accessibilityRole="button"
        onPress={async () => {
          await backend.markNotificationRead(n.id);
          refresh();
          if (n.data.href) router.push(n.data.href as never);
        }}
        className="flex-1 flex-row items-center gap-3"
      >
        <View className="rounded-pill bg-surface-2 h-10 w-10 items-center justify-center">
          {iconFor(n.type)}
        </View>
        <View className="flex-1 gap-0.5">
          <Text weight={n.readAt ? 'medium' : 'semibold'}>{tKey(t, n.titleKey, n.params)}</Text>
          <Text variant="small" tone="muted">
            {tKey(t, n.bodyKey, n.params)}
          </Text>
          <Text variant="micro" tone="muted">
            {timeAgo(t, n.createdAt)}
          </Text>
        </View>
        {!n.readAt ? (
          <View className="rounded-pill bg-primary h-2.5 w-2.5" accessibilityLabel="unread" />
        ) : null}
      </Pressable>
      <IconButton
        accessibilityLabel={t('notifications.deleteLabel')}
        icon={<Trash2 size={18} color={colors.textMuted} />}
        onPress={async () => {
          await backend.deleteNotification(n.id);
          refresh();
        }}
      />
    </View>
  );

  return (
    <Screen onRefresh={refresh} refreshing={q.isRefetching}>
      <Seo title={`${t('notifications.title')} · hopium.family`} path="/notifications" />
      <View className="flex-row items-center gap-2 py-2">
        <IconButton
          accessibilityLabel={t('common.back')}
          icon={<ArrowLeft size={22} color={colors.text} />}
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
        />
        <Text variant="h2" className="flex-1">
          {t('notifications.title')}
        </Text>
        <Button
          testID="mark-all-read"
          label={t('notifications.markAllRead')}
          size="sm"
          variant="ghost"
          onPress={async () => {
            await backend.markAllNotificationsRead();
            refresh();
          }}
        />
      </View>
      {q.isLoading ? (
        <SkeletonList count={5} />
      ) : !q.data?.length ? (
        <EmptyState
          title={t('notifications.empty')}
          icon={<Bell size={32} color={colors.textMuted} />}
        />
      ) : (
        <View className="gap-4" testID="notification-list">
          {today.length ? (
            <View className="gap-1">
              <Text variant="small" weight="semibold" tone="muted">
                {t('notifications.today')}
              </Text>
              <Card padded={false} className="px-3">
                {today.map(renderItem)}
              </Card>
            </View>
          ) : null}
          {earlier.length ? (
            <View className="gap-1">
              <Text variant="small" weight="semibold" tone="muted">
                {t('notifications.earlier')}
              </Text>
              <Card padded={false} className="px-3">
                {earlier.map(renderItem)}
              </Card>
            </View>
          ) : null}
        </View>
      )}
    </Screen>
  );
}
