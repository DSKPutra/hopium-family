import { Card, Screen, Text, useTheme } from '@hopium/ui';
import { router, type Href } from 'expo-router';
import { Banknote, LineChart, PenLine, Rocket, TrendingUp } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';

import { AppHeader } from '@/components/AppHeader';
import { AssetRow } from '@/components/AssetRow';
import { QueryState } from '@/components/QueryState';
import { SectionHeader } from '@/components/SectionHeader';
import { Seo } from '@/components/Seo';
import { PositionRow } from '@/components/trading/PositionRow';
import { useAssets, useMe, usePositions, useUserTrades } from '@/hooks/queries';
import { timeAgo, useFormat } from '@/lib/format';
import { useSettings } from '@/stores/settings';

function Action({
  label,
  icon,
  href,
  testID,
}: {
  label: string;
  icon: React.ReactNode;
  href: Href;
  testID: string;
}) {
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={() => router.push(href)}
      className="border-border bg-surface min-h-[88px] min-w-[30%] flex-1 items-center justify-center gap-2 rounded-lg border p-3 active:opacity-70"
    >
      {icon}
      <Text variant="small" weight="semibold" align="center">
        {label}
      </Text>
    </Pressable>
  );
}

export default function TradeHub() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const f = useFormat();
  const watchlist = useSettings((s) => s.watchlist);
  const all = useAssets({ limit: 200 });
  const positions = usePositions();
  const me = useMe();
  const trades = useUserTrades(me.data?.id);
  const watched = (all.data ?? []).filter((a) => watchlist.includes(a.id));
  const recent = trades.data?.pages.flatMap((p) => p.items).slice(0, 5) ?? [];

  return (
    <Screen>
      <Seo title={`${t('trade.title')} · hopium.family`} path="/trade" />
      <AppHeader title={t('trade.title')} />
      <View className="mt-2 flex-row flex-wrap gap-3">
        <Action
          testID="action-buy-crypto"
          label={t('trade.buyCrypto')}
          icon={<Rocket size={24} color={colors.primary} />}
          href={{ pathname: '/search', params: { scope: 'crypto' } }}
        />
        <Action
          testID="action-buy-stock"
          label={t('trade.buyStock')}
          icon={<TrendingUp size={24} color={colors.secondary} />}
          href={{ pathname: '/search', params: { scope: 'stock_token' } }}
        />
        <Action
          testID="action-open-perp"
          label={t('trade.openPerp')}
          icon={<LineChart size={24} color={colors.accent} />}
          href={{ pathname: '/perps/[market]', params: { market: 'btc-perp' } }}
        />
        <Action
          testID="action-deposit"
          label={t('trade.deposit')}
          icon={<Banknote size={24} color={colors.gain} />}
          href="/wallet/deposit"
        />
        <Action
          testID="action-thesis"
          label={t('trade.postThesis')}
          icon={<PenLine size={24} color={colors.warning} />}
          href="/thesis/new"
        />
      </View>

      <SectionHeader title={t('trade.watchlist')} />
      <Card padded={false} className="px-4">
        <QueryState
          query={all}
          isEmpty={() => watched.length === 0}
          empty={{ title: t('trade.emptyWatchlist') }}
        >
          {() => watched.map((a) => <AssetRow key={a.id} asset={a} />)}
        </QueryState>
      </Card>

      <SectionHeader
        title={t('trade.positionsSummary')}
        href="/positions"
        actionLabel={t('common.seeAll')}
      />
      <QueryState
        query={positions}
        isEmpty={(d) => d.length === 0}
        empty={{ title: t('trade.noPositions') }}
      >
        {(list) => (
          <View className="gap-3">
            {list.slice(0, 3).map((p) => (
              <PositionRow key={p.id} position={p} showMarketLink />
            ))}
          </View>
        )}
      </QueryState>

      <SectionHeader
        title={t('trade.recentTrades')}
        href="/orders"
        actionLabel={t('common.seeAll')}
      />
      <Card>
        {recent.length ? (
          recent.map((tr) => (
            <Pressable
              key={tr.id}
              accessibilityRole="button"
              onPress={() =>
                router.push({ pathname: '/asset/[symbol]', params: { symbol: tr.symbol } })
              }
              className="min-h-[48px] flex-row items-center justify-between py-2"
            >
              <Text weight="medium">
                <Text tone={tr.side === 'buy' ? 'gain' : 'loss'} weight="semibold">
                  {tr.side === 'buy' ? t('feed.bought') : t('feed.sold')}
                </Text>{' '}
                {tr.symbol}
              </Text>
              <View className="items-end">
                <Text variant="small" numeric>
                  {f.money(tr.notional)}
                </Text>
                <Text variant="micro" tone="muted">
                  {timeAgo(t, tr.createdAt)}
                </Text>
              </View>
            </Pressable>
          ))
        ) : (
          <Text tone="muted">{t('trade.noTrades')}</Text>
        )}
      </Card>
    </Screen>
  );
}
