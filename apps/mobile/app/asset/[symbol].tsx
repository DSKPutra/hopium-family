import { CANDLE_RANGES, truncateAddress, type CandleRange } from '@hopium/core';
import {
  AssetLogo,
  AvatarStack,
  Button,
  Card,
  ChangeText,
  CopyableText,
  ErrorState,
  IconButton,
  PnLBadge,
  PriceText,
  RiskBanner,
  Screen,
  SegmentedControl,
  Skeleton,
  Text,
  useTheme,
  useToast,
} from '@hopium/ui';
import { router, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, BellPlus, Share2, Star } from 'lucide-react-native';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { ThesisBody } from '@/components/feed/FeedItemView';
import { PriceChart } from '@/components/PriceChart';
import { SectionHeader } from '@/components/SectionHeader';
import { Seo } from '@/components/Seo';
import { PriceAlertSheet } from '@/components/PriceAlertSheet';
import {
  useAsset,
  useAssetTheses,
  useCandles,
  useHolding,
  useHoldersIFollow,
} from '@/hooks/queries';
import { useLivePrice } from '@/hooks/useLivePrice';
import { errorMessage } from '@/lib/errors';
import { displaySymbol, useFormat } from '@/lib/format';
import { useShare } from '@/lib/share';
import { useTrade } from '@/providers/TradeProvider';
import { useSettings } from '@/stores/settings';
import { useUi } from '@/stores/ui';

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View className="border-border min-h-[44px] flex-row items-center justify-between border-b py-2 last:border-b-0">
      <Text variant="small" tone="muted">
        {label}
      </Text>
      <Text variant="small" numeric weight="medium">
        {value}
      </Text>
    </View>
  );
}

export default function AssetDetail() {
  const { symbol = '' } = useLocalSearchParams<{ symbol: string }>();
  const { t } = useTranslation();
  const { colors } = useTheme();
  const toast = useToast();
  const share = useShare();
  const f = useFormat();
  const { openOrder } = useTrade();
  const [range, setRange] = useState<CandleRange>('1D');
  const [alerts, setAlerts] = useState(false);
  const assetQ = useAsset(symbol);
  const asset = assetQ.data;
  const initial = useMemo(
    () => (asset ? { price: asset.price, change24hPct: asset.change24hPct } : undefined),
    [asset],
  );
  const live = useLivePrice(asset?.id, initial);
  const candles = useCandles(asset?.id, range);
  const holding = useHolding(asset?.id);
  const holders = useHoldersIFollow(asset?.id);
  const theses = useAssetTheses(asset?.id);
  const watchlist = useSettings((s) => s.watchlist);
  const toggleWatch = useSettings((s) => s.toggleWatch);
  const setFocused = useUi((s) => s.setFocusedAsset);

  useEffect(() => {
    setFocused(asset?.id ?? null);
    return () => setFocused(null);
  }, [asset?.id, setFocused]);

  if (assetQ.isLoading) {
    return (
      <Screen>
        <Skeleton height={60} className="mt-4" />
        <Skeleton height={220} className="mt-4" />
      </Screen>
    );
  }
  if (assetQ.error || !asset) {
    return (
      <Screen>
        <ErrorState
          title={t('asset.notFound')}
          message={assetQ.error ? errorMessage(t, assetQ.error) : undefined}
          retryLabel={t('common.retry')}
          onRetry={() => void assetQ.refetch()}
        />
      </Screen>
    );
  }

  const price = live?.price ?? asset.price;
  const change = live?.change24hPct ?? asset.change24hPct;
  const up = !change.startsWith('-');
  const watched = watchlist.includes(asset.id);
  const sym = displaySymbol(asset.symbol, asset.tags);
  const isStock = asset.class === 'stock_token';
  const perpMarket = [
    'btc',
    'eth',
    'sol',
    'xrp',
    'doge',
    'avax',
    'link',
    'arb',
    'sui',
    'ton',
    'hope',
    'fam',
  ].includes(asset.id)
    ? `${asset.id}-perp`
    : null;

  return (
    <Screen
      footer={
        <View className="flex-row gap-3">
          <Button
            testID="asset-buy"
            label={t('asset.buy')}
            variant="gain"
            size="lg"
            className="flex-1"
            onPress={() => openOrder({ assetId: asset.id, side: 'buy' })}
          />
          <Button
            testID="asset-sell"
            label={t('asset.sell')}
            variant="outline"
            size="lg"
            className="flex-1"
            onPress={() => openOrder({ assetId: asset.id, side: 'sell' })}
          />
        </View>
      }
    >
      <Seo
        title={t('meta.asset', { symbol: asset.symbol })}
        description={asset.name}
        path={`/a/${asset.symbol}`}
      />
      <View className="flex-row items-center gap-1 py-2">
        <IconButton
          accessibilityLabel={t('common.back')}
          icon={<ArrowLeft size={22} color={colors.text} />}
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/discover'))}
        />
        <View className="flex-1" />
        <IconButton
          accessibilityLabel={t('asset.priceAlert')}
          icon={<BellPlus size={22} color={colors.text} />}
          onPress={() => setAlerts(true)}
        />
        <IconButton
          testID="watch-toggle"
          accessibilityLabel={watched ? t('asset.unwatch') : t('asset.watch')}
          icon={
            <Star
              size={22}
              color={watched ? colors.accent : colors.text}
              fill={watched ? colors.accent : 'transparent'}
            />
          }
          onPress={() =>
            toast.show(toggleWatch(asset.id) ? t('asset.watched') : t('asset.unwatched'), 'success')
          }
        />
        <IconButton
          accessibilityLabel={t('asset.share')}
          icon={<Share2 size={22} color={colors.text} />}
          onPress={() =>
            void share(
              t('asset.shareMessage', { symbol: sym }),
              `https://hopium.family/a/${asset.symbol}`,
            )
          }
        />
      </View>

      <View className="flex-row items-center gap-3">
        <AssetLogo
          symbol={asset.symbol}
          uri={asset.logoUrl}
          size={48}
          shape={isStock ? 'squircle' : 'circle'}
        />
        <View className="flex-1">
          <View className="flex-row items-center gap-2">
            <Text variant="h2">{sym}</Text>
            <View className="rounded-pill bg-surface-2 px-2 py-0.5">
              <Text variant="micro" weight="semibold" tone="muted">
                {isStock
                  ? t('discover.stockTokens')
                  : asset.tags.includes('meme')
                    ? t('discover.memes')
                    : t('discover.crypto')}
              </Text>
            </View>
          </View>
          <Text tone="muted">{asset.underlyingName ?? asset.name}</Text>
        </View>
      </View>

      <View className="mt-4 gap-1">
        <PriceText
          testID="asset-price"
          value={price}
          formatted={f.price(price)}
          variant="display"
          weight="bold"
        />
        <ChangeText pct={change} variant="body" locale={f.locale} />
      </View>

      {asset.tags.includes('meme') ? (
        <RiskBanner
          tone="warning"
          title={t('discover.highVolatility')}
          message={t('asset.memeRisk')}
          className="mt-3"
        />
      ) : null}

      <View className="mt-4">
        {candles.data ? (
          <PriceChart
            candles={candles.data}
            color={up ? colors.gain : colors.loss}
            accessibilityLabel={t('asset.chartLabel', { symbol: asset.symbol })}
            formatPrice={f.price}
            locale={f.locale}
          />
        ) : (
          <Skeleton height={220} />
        )}
        <SegmentedControl
          className="mt-3"
          segments={CANDLE_RANGES.map((r) => ({ value: r, label: r }))}
          value={range}
          onChange={setRange}
        />
      </View>

      {holding.data ? (
        <>
          <SectionHeader title={t('asset.yourPosition')} />
          <Card className="gap-1" testID="your-position">
            <Stat label={t('asset.qty')} value={`${f.qty(holding.data.qty)} ${asset.symbol}`} />
            <Stat label={t('asset.avgEntry')} value={f.price(holding.data.avgEntry)} />
            <Stat label={t('asset.value')} value={f.money(holding.data.valueUsd)} />
            <View className="flex-row items-center justify-between py-2">
              <Text variant="small" tone="muted">
                {t('asset.unrealized')}
              </Text>
              <PnLBadge
                pct={holding.data.unrealizedPnlPct}
                amount={f.money(holding.data.unrealizedPnl, { signed: true })}
                locale={f.locale}
                size="md"
              />
            </View>
          </Card>
        </>
      ) : null}

      <SectionHeader title={t('asset.stats')} />
      <Card className="gap-0">
        {isStock ? (
          <>
            <Stat label={t('asset.company')} value={asset.underlyingName ?? asset.name} />
            <Stat label={t('asset.tradingHours')} value={t('asset.hours247')} />
            <Stat
              label={t('asset.volume')}
              value={f.money(asset.volume24h ?? '0', { compact: true })}
            />
          </>
        ) : (
          <>
            {asset.marketCap ? (
              <Stat
                label={t('asset.marketCap')}
                value={f.money(asset.marketCap, { compact: true })}
              />
            ) : null}
            <Stat
              label={t('asset.volume')}
              value={f.money(asset.volume24h ?? '0', { compact: true })}
            />
            <Stat label={t('asset.holders')} value={f.compact(String(asset.holders ?? 0))} />
            <Stat label={t('asset.chain')} value={asset.chain ?? '—'} />
          </>
        )}
        {asset.address ? (
          <View className="gap-1 pt-2">
            <Text variant="small" tone="muted">
              {t('asset.contract')}
            </Text>
            <CopyableText
              value={asset.address}
              display={truncateAddress(asset.address, 8, 6)}
              copyLabel={t('common.copyToClipboard')}
              copiedLabel={t('common.copied')}
            />
          </View>
        ) : null}
      </Card>

      {isStock ? (
        <Card className="mt-3 gap-1">
          <Text weight="semibold">{t('asset.tokenizedTitle')}</Text>
          <Text variant="small" tone="muted">
            {t('asset.tokenizedBody')}
          </Text>
        </Card>
      ) : null}

      {perpMarket ? (
        <Button
          label={t('asset.openPerp', { symbol: asset.symbol })}
          variant="secondary"
          className="mt-3"
          onPress={() =>
            router.push({ pathname: '/perps/[market]', params: { market: perpMarket } })
          }
        />
      ) : null}

      {holders.data?.length ? (
        <>
          <SectionHeader title={t('asset.friendsHold')} />
          <AvatarStack
            people={holders.data.map((p) => ({
              id: p.id,
              name: p.displayName || p.username,
              uri: p.avatarUrl,
            }))}
            ringColor={colors.bg}
            moreLabel={(n) => t('common.moreCount', { count: n })}
          />
        </>
      ) : null}

      <SectionHeader title={t('asset.relatedTheses')} />
      {theses.data?.length ? (
        <View className="gap-3">
          {theses.data.map(({ thesis }) => (
            <ThesisBody key={thesis.id} item={{ thesis }} />
          ))}
        </View>
      ) : (
        <Text tone="muted">{t('asset.noTheses')}</Text>
      )}
      <PriceAlertSheet visible={alerts} onClose={() => setAlerts(false)} asset={asset} />
    </Screen>
  );
}
