import { mul, type Asset, type AssetClass, type PerpMarket } from '@hopium/core';
import { Card, Chip, ChangeText, Input, Screen, SkeletonList, Text, useTheme } from '@hopium/ui';
import { router } from 'expo-router';
import { Search } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, View } from 'react-native';

import { AppHeader } from '@/components/AppHeader';
import { AssetRow } from '@/components/AssetRow';
import { SectionHeader } from '@/components/SectionHeader';
import { Seo } from '@/components/Seo';
import { TraderCard } from '@/components/TraderCard';
import { useAssets, useFollowSuggestions, usePerpMarkets } from '@/hooks/queries';
import { useFormat } from '@/lib/format';

type Filter = 'all' | 'crypto' | 'memes' | 'stocks' | 'perps';

function AssetSection({
  title,
  assets,
  loading,
}: {
  title: string;
  assets?: Asset[];
  loading: boolean;
}) {
  const { t } = useTranslation();
  return (
    <View>
      <SectionHeader title={title} />
      <Card padded={false} className="px-4">
        {loading ? (
          <SkeletonList count={4} />
        ) : assets?.length ? (
          assets.map((a) => <AssetRow key={a.id} asset={a} />)
        ) : (
          <Text tone="muted" className="py-4">
            {t('discover.empty')}
          </Text>
        )}
      </Card>
    </View>
  );
}

function PerpRow({ m }: { m: PerpMarket }) {
  const { t } = useTranslation();
  const f = useFormat();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={m.symbol}
      onPress={() => router.push({ pathname: '/perps/[market]', params: { market: m.id } })}
      className="min-h-[60px] flex-row items-center gap-3 py-2"
    >
      <View className="flex-1 gap-0.5">
        <Text weight="semibold">{m.symbol}</Text>
        <Text variant="small" tone="muted" numeric>
          {t('discover.funding', { rate: f.pct(mul(m.fundingRate, 100), { decimals: 4 }) })} ·{' '}
          {t('discover.openInterest', { value: f.compact(m.openInterestUsd) })}
        </Text>
      </View>
      <View className="items-end">
        <Text numeric weight="semibold">
          {f.price(m.markPrice)}
        </Text>
        <ChangeText pct={m.change24hPct} locale={f.locale} />
      </View>
    </Pressable>
  );
}

export default function Discover() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const [filter, setFilter] = useState<Filter>('all');
  const cls: AssetClass | undefined =
    filter === 'crypto' || filter === 'memes'
      ? 'crypto'
      : filter === 'stocks'
        ? 'stock_token'
        : undefined;
  const tag = filter === 'memes' ? 'meme' : undefined;
  const trending = useAssets({ sort: 'trending', class: cls, tag, limit: 6 }, filter !== 'perps');
  const gainers = useAssets({ sort: 'gainers', class: cls, tag, limit: 5 }, filter !== 'perps');
  const losers = useAssets({ sort: 'losers', class: cls, tag, limit: 5 }, filter !== 'perps');
  const stocks = useAssets(
    { class: 'stock_token', sort: 'volume', limit: 6 },
    filter === 'all' || filter === 'stocks',
  );
  const fresh = useAssets(
    { sort: 'new', class: cls, tag, limit: 5 },
    filter !== 'perps' && filter !== 'stocks',
  );
  const perps = usePerpMarkets();
  const traders = useFollowSuggestions(8);

  return (
    <Screen testID="discover-screen">
      <Seo title={`${t('nav.discover')} · hopium.family`} path="/discover" />
      <AppHeader title={t('nav.discover')} />
      <Pressable accessibilityRole="search" onPress={() => router.push('/search')}>
        <View pointerEvents="none">
          <Input
            placeholder={t('discover.searchPlaceholder')}
            left={<Search size={18} color={colors.textMuted} />}
            editable={false}
            accessibilityLabel={t('discover.searchPlaceholder')}
          />
        </View>
      </Pressable>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        className="mt-3"
        contentContainerStyle={{ gap: 8 }}
      >
        {(
          [
            ['all', t('discover.all')],
            ['crypto', t('discover.crypto')],
            ['memes', t('discover.memes')],
            ['stocks', t('discover.stockTokens')],
            ['perps', t('discover.perps')],
          ] as [Filter, string][]
        ).map(([v, label]) => (
          <Chip
            key={v}
            testID={`filter-${v}`}
            label={label}
            selected={filter === v}
            onPress={() => setFilter(v)}
          />
        ))}
      </ScrollView>
      {filter !== 'perps' ? (
        <>
          <AssetSection
            title={t('discover.trending')}
            assets={trending.data}
            loading={trending.isLoading}
          />
          <AssetSection
            title={t('discover.gainers')}
            assets={gainers.data}
            loading={gainers.isLoading}
          />
          <AssetSection
            title={t('discover.losers')}
            assets={losers.data}
            loading={losers.isLoading}
          />
        </>
      ) : null}
      {filter === 'all' || filter === 'stocks' ? (
        <AssetSection
          title={`${t('discover.stockTokensSection')} · ${t('discover.badge247')}`}
          assets={stocks.data}
          loading={stocks.isLoading}
        />
      ) : null}
      {filter === 'all' || filter === 'perps' ? (
        <View>
          <SectionHeader title={t('discover.perpsMarkets')} />
          <Card padded={false} className="px-4">
            {perps.isLoading ? (
              <SkeletonList count={4} />
            ) : (
              (perps.data ?? [])
                .slice(0, filter === 'perps' ? 12 : 5)
                .map((m) => <PerpRow key={m.id} m={m} />)
            )}
          </Card>
        </View>
      ) : null}
      {filter !== 'perps' && filter !== 'stocks' ? (
        <AssetSection
          title={t('discover.newListings')}
          assets={fresh.data}
          loading={fresh.isLoading}
        />
      ) : null}
      <SectionHeader title={t('discover.topTraders')} />
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 12 }}
      >
        {(traders.data ?? []).map((u) => (
          <TraderCard key={u.profile.id} user={u} compact />
        ))}
      </ScrollView>
    </Screen>
  );
}
