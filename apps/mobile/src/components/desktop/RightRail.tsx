import { Avatar, Text } from '@hopium/ui';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, View } from 'react-native';

import { AssetRow } from '@/components/AssetRow';
import { useAssets, useLegendsBuying, usePositions } from '@/hooks/queries';
import { useFormat } from '@/lib/format';
import { useSettings } from '@/stores/settings';

function RailCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View className="border-border bg-surface gap-1 rounded-lg border p-4">
      <Text variant="h3" className="mb-1">
        {title}
      </Text>
      {children}
    </View>
  );
}

export function RightRail() {
  const { t } = useTranslation();
  const f = useFormat();
  const watchlist = useSettings((s) => s.watchlist);
  const assets = useAssets({ limit: 200 });
  const positions = usePositions();
  const legends = useLegendsBuying();
  const watched = (assets.data ?? []).filter((a) => watchlist.includes(a.id)).slice(0, 6);
  return (
    <View className="border-border border-l" style={{ width: 340, flexGrow: 0, flexShrink: 0 }}>
      <ScrollView contentContainerClassName="gap-4 p-4">
        <RailCard title={t('nav.watchlist')}>
          {watched.length ? (
            watched.map((a) => <AssetRow key={a.id} asset={a} showSpark={false} />)
          ) : (
            <Text variant="small" tone="muted">
              {t('trade.emptyWatchlist')}
            </Text>
          )}
        </RailCard>
        <RailCard title={t('nav.openPositions')}>
          {positions.data?.length ? (
            positions.data.map((p) => (
              <Pressable
                key={p.id}
                accessibilityRole="link"
                onPress={() =>
                  router.push({ pathname: '/perps/[market]', params: { market: p.marketId } })
                }
                className="flex-row items-center justify-between py-2"
              >
                <Text variant="small" weight="semibold">
                  {p.symbol} · {p.leverage}×
                </Text>
                <Text
                  variant="small"
                  numeric
                  tone={p.unrealizedPnl.startsWith('-') ? 'loss' : 'gain'}
                >
                  {f.money(p.unrealizedPnl, { signed: true })}
                </Text>
              </Pressable>
            ))
          ) : (
            <Text variant="small" tone="muted">
              {t('trade.noPositions')}
            </Text>
          )}
        </RailCard>
        <RailCard title={t('nav.legendsBuying')}>
          {(legends.data ?? []).slice(0, 6).map((l) => (
            <Pressable
              key={l.postId}
              accessibilityRole="link"
              onPress={() => router.push({ pathname: '/post/[id]', params: { id: l.postId } })}
              className="flex-row items-center gap-2 py-1.5"
            >
              <Avatar id={l.profile.id} name={l.profile.displayName} size={28} />
              <Text variant="small" className="flex-1" numberOfLines={1}>
                {t('home.legendBought', {
                  username: `@${l.profile.username}`,
                  symbol: l.trade.symbol,
                })}
              </Text>
            </Pressable>
          ))}
        </RailCard>
      </ScrollView>
    </View>
  );
}
