import { explorerUrl, type ActivityKind } from '@hopium/core';
import { Card, Chip, IconButton, Screen, Text, useTheme } from '@hopium/ui';
import { router } from 'expo-router';
import {
  ArrowDownToLine,
  ArrowLeft,
  ArrowUpFromLine,
  Flame,
  LineChart,
  Repeat,
} from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Linking, Pressable, ScrollView, View } from 'react-native';

import { QueryState } from '@/components/QueryState';
import { Seo } from '@/components/Seo';
import { useActivity } from '@/hooks/queries';

import { timeAgo, useFormat } from '@/lib/format';

const FILTERS: { value: ActivityKind | 'all'; key: string }[] = [
  { value: 'all', key: 'filterAll' },
  { value: 'deposit', key: 'filterDeposits' },
  { value: 'withdrawal', key: 'filterWithdrawals' },
  { value: 'trade', key: 'filterTrades' },
  { value: 'perp_open', key: 'filterPerps' },
];

export default function History() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const f = useFormat();
  const [filter, setFilter] = useState<ActivityKind | 'all'>('all');
  const q = useActivity(filter);
  const icon = (kind: ActivityKind) => {
    switch (kind) {
      case 'deposit':
        return <ArrowDownToLine size={18} color={colors.gain} />;
      case 'withdrawal':
        return <ArrowUpFromLine size={18} color={colors.text} />;
      case 'trade':
        return <Repeat size={18} color={colors.primary} />;
      case 'perp_liquidation':
        return <Flame size={18} color={colors.loss} />;
      default:
        return <LineChart size={18} color={colors.secondary} />;
    }
  };
  return (
    <Screen onRefresh={() => void q.refetch()} refreshing={q.isRefetching}>
      <Seo title={`${t('wallet.historyTitle')} · hopium.family`} path="/wallet/history" />
      <View className="flex-row items-center gap-2 py-2">
        <IconButton
          accessibilityLabel={t('common.back')}
          icon={<ArrowLeft size={22} color={colors.text} />}
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/wallet'))}
        />
        <Text variant="h2">{t('wallet.historyTitle')}</Text>
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 8 }}
        className="mb-3"
      >
        {FILTERS.map((fl) => (
          <Chip
            key={fl.value}
            label={t(`wallet.${fl.key}` as never)}
            selected={filter === fl.value}
            onPress={() => setFilter(fl.value)}
          />
        ))}
      </ScrollView>
      <QueryState
        query={q}
        isEmpty={(d) => d.length === 0}
        empty={{ title: t('wallet.noHistory') }}
      >
        {(items) => (
          <Card padded={false} className="px-4">
            {items.map((a) => (
              <Pressable
                key={a.id}
                accessibilityRole="button"
                disabled={!a.txHash || !a.chain}
                onPress={() =>
                  a.txHash && a.chain && void Linking.openURL(explorerUrl(a.chain, a.txHash))
                }
                className="min-h-[64px] flex-row items-center gap-3 py-2"
              >
                <View className="rounded-pill bg-surface-2 h-9 w-9 items-center justify-center">
                  {icon(a.kind)}
                </View>
                <View className="flex-1">
                  <Text weight="semibold">
                    {t(`wallet.kind.${a.kind}`)} · {a.symbol}
                  </Text>
                  <Text variant="micro" tone="muted">
                    {timeAgo(t, a.createdAt)}
                  </Text>
                </View>
                <View className="items-end">
                  <Text
                    numeric
                    weight="medium"
                    tone={
                      a.kind === 'deposit'
                        ? 'gain'
                        : a.kind === 'perp_liquidation'
                          ? 'loss'
                          : 'default'
                    }
                  >
                    {a.kind === 'deposit' ? '+' : ''}
                    {f.usd(a.amountUsd)}
                  </Text>
                  {a.qty ? (
                    <Text variant="micro" tone="muted" numeric>
                      {f.qty(a.qty)} {a.symbol}
                    </Text>
                  ) : null}
                </View>
              </Pressable>
            ))}
          </Card>
        )}
      </QueryState>
    </Screen>
  );
}
