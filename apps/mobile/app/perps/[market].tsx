import { mul, type CandleRange } from '@hopium/core';
import {
  Card,
  ChangeText,
  ErrorState,
  IconButton,
  PriceText,
  RiskBanner,
  Screen,
  SegmentedControl,
  Skeleton,
  Text,
  useTheme,
} from '@hopium/ui';
import { router, useLocalSearchParams } from 'expo-router';
import { ArrowLeft } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { FeatureGate } from '@/components/FeatureGate';
import { PriceChart } from '@/components/PriceChart';
import { SectionHeader } from '@/components/SectionHeader';
import { Seo } from '@/components/Seo';
import { PerpOrderPanel } from '@/components/trading/PerpOrderPanel';
import { PositionRow } from '@/components/trading/PositionRow';
import { useCandles, usePerpMarket, usePositions } from '@/hooks/queries';
import { useNow } from '@/hooks/useNow';
import { errorMessage } from '@/lib/errors';
import { countdown, useFormat } from '@/lib/format';

function HeaderStat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <View className="min-w-[45%] flex-1 gap-0.5">
      <Text variant="micro" tone="muted">
        {label}
      </Text>
      <Text variant="small" numeric weight="semibold">
        {value}
      </Text>
      {sub ? (
        <Text variant="micro" tone="muted" numeric>
          {sub}
        </Text>
      ) : null}
    </View>
  );
}

export default function PerpMarketScreen() {
  const { market: marketId = 'btc-perp' } = useLocalSearchParams<{ market: string }>();
  const { t } = useTranslation();
  const { colors } = useTheme();
  const f = useFormat();
  const now = useNow(1000);
  const [range, setRange] = useState<CandleRange>('1D');
  const marketQ = usePerpMarket(marketId);
  const market = marketQ.data;
  const candles = useCandles(market?.baseAssetId, range);
  const positions = usePositions();
  const mine = (positions.data ?? []).filter((p) => p.marketId === marketId);

  return (
    <Screen>
      <Seo
        title={`${market?.symbol ?? marketId.toUpperCase()} · hopium.family`}
        path={`/perps/${marketId}`}
      />
      <View className="flex-row items-center py-2">
        <IconButton
          accessibilityLabel={t('common.back')}
          icon={<ArrowLeft size={22} color={colors.text} />}
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/trade'))}
        />
      </View>
      <FeatureGate feature="perps">
        {marketQ.isLoading ? (
          <Skeleton height={300} />
        ) : marketQ.error || !market ? (
          <ErrorState
            title={t('perps.notFound')}
            message={marketQ.error ? errorMessage(t, marketQ.error) : undefined}
            retryLabel={t('common.retry')}
            onRetry={() => void marketQ.refetch()}
          />
        ) : (
          <View className="gap-4">
            <View className="gap-1">
              <View className="flex-row items-center gap-2">
                <Text variant="h2">{market.symbol}</Text>
                <View className="rounded-pill bg-surface-2 px-2 py-0.5">
                  <Text variant="micro" tone="muted" weight="semibold">
                    {t('perps.maxLeverage', { value: market.maxLeverage })}
                  </Text>
                </View>
              </View>
              <PriceText
                testID="perp-mark"
                value={market.markPrice}
                formatted={f.price(market.markPrice)}
                variant="h1"
                weight="bold"
              />
              <ChangeText pct={market.change24hPct} locale={f.locale} />
            </View>
            <Card className="flex-row flex-wrap gap-y-3">
              <HeaderStat label={t('perps.mark')} value={f.price(market.markPrice)} />
              <HeaderStat label={t('perps.index')} value={f.price(market.indexPrice)} />
              <HeaderStat
                label={t('perps.funding')}
                value={f.pct(mul(market.fundingRate, 100), { decimals: 4 })}
                sub={t('perps.fundingIn', { time: countdown(t, market.nextFundingAt, now) })}
              />
              <HeaderStat
                label={t('perps.openInterest')}
                value={f.money(market.openInterestUsd, { compact: true })}
              />
            </Card>
            <RiskBanner tone="warning" message={t('perps.riskBanner')} />
            {candles.data ? (
              <PriceChart
                candles={candles.data}
                color={colors.secondary}
                accessibilityLabel={t('asset.chartLabel', { symbol: market.symbol })}
                formatPrice={f.price}
                locale={f.locale}
              />
            ) : (
              <Skeleton height={220} />
            )}
            <SegmentedControl
              segments={(['1H', '1D', '1W', '1M'] as CandleRange[]).map((r) => ({
                value: r,
                label: r,
              }))}
              value={range}
              onChange={setRange}
            />
            <Card>
              <PerpOrderPanel market={market} />
            </Card>
            <SectionHeader title={t('perps.positions')} />
            {mine.length ? (
              <View className="gap-3">
                {mine.map((p) => (
                  <PositionRow key={p.id} position={p} />
                ))}
              </View>
            ) : (
              <Text tone="muted">{t('perps.noPositions')}</Text>
            )}
          </View>
        )}
      </FeatureGate>
    </Screen>
  );
}
