import { Card, IconButton, Screen, Text, useTheme } from '@hopium/ui';
import { router } from 'expo-router';
import { ArrowLeft } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { QueryState } from '@/components/QueryState';
import { Seo } from '@/components/Seo';
import { useOrders } from '@/hooks/queries';
import { errorMessage } from '@/lib/errors';
import { timeAgo, useFormat } from '@/lib/format';
import { AppError } from '@hopium/core';

export default function Orders() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const f = useFormat();
  const q = useOrders();
  return (
    <Screen onRefresh={() => void q.refetch()} refreshing={q.isRefetching}>
      <Seo title={`${t('nav.orders')} · hopium.family`} path="/orders" />
      <View className="flex-row items-center gap-2 py-2">
        <IconButton
          accessibilityLabel={t('common.back')}
          icon={<ArrowLeft size={22} color={colors.text} />}
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/trade'))}
        />
        <Text variant="h2">{t('nav.orders')}</Text>
      </View>
      <QueryState query={q} isEmpty={(d) => d.length === 0} empty={{ title: t('trade.noTrades') }}>
        {(orders) => (
          <Card padded={false} className="px-4">
            {orders.map((o) => (
              <View
                key={o.id}
                className="min-h-[64px] flex-row items-center justify-between gap-3 py-2"
              >
                <View className="flex-1">
                  <Text weight="semibold">
                    <Text weight="semibold" tone={o.side === 'buy' ? 'gain' : 'loss'}>
                      {o.side === 'buy' ? t('feed.bought') : t('feed.sold')}
                    </Text>{' '}
                    {o.assetId.toUpperCase()}
                  </Text>
                  <Text variant="micro" tone={o.status === 'failed' ? 'loss' : 'muted'}>
                    {o.status}
                    {o.errorCode
                      ? ` · ${errorMessage(t, new AppError(o.errorCode as never))}`
                      : ''}{' '}
                    · {timeAgo(t, o.createdAt)}
                  </Text>
                </View>
                <View className="items-end">
                  <Text variant="small" numeric>
                    {o.side === 'buy' ? f.usd(o.amountIn) : f.usd(o.amountOut)}
                  </Text>
                  <Text variant="micro" tone="muted" numeric>
                    @ {f.price(o.price)}
                  </Text>
                </View>
              </View>
            ))}
          </Card>
        )}
      </QueryState>
    </Screen>
  );
}
