import type { Asset } from '@hopium/core';
import { AssetLogo, ChangeText, PriceText, Sparkline, Text, useTheme } from '@hopium/ui';
import { router } from 'expo-router';
import { memo, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';

import { useCandles } from '@/hooks/queries';
import { useLivePrice } from '@/hooks/useLivePrice';
import { displaySymbol, useFormat } from '@/lib/format';

export const AssetRow = memo(function AssetRow({
  asset,
  onPress,
  showSpark = true,
}: {
  asset: Asset;
  onPress?: () => void;
  showSpark?: boolean;
}) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const f = useFormat();
  const initial = useMemo(
    () => ({ price: asset.price, change24hPct: asset.change24hPct }),
    [asset.price, asset.change24hPct],
  );
  const live = useLivePrice(asset.id, initial);
  const candles = useCandles(showSpark ? asset.id : undefined, '1D');
  const values = useMemo(
    () => (candles.data ?? []).filter((_, i) => i % 3 === 0).map((c) => Number(c.close)),
    [candles.data],
  );
  const up = !live?.change24hPct.startsWith('-');
  const symbol = displaySymbol(asset.symbol, asset.tags);
  return (
    <Pressable
      testID={`asset-row-${asset.symbol}`}
      accessibilityRole="button"
      accessibilityLabel={`${symbol} ${asset.name} ${f.price(live?.price ?? asset.price)}`}
      onPress={
        onPress ??
        (() => router.push({ pathname: '/asset/[symbol]', params: { symbol: asset.symbol } }))
      }
      className="web:focus-visible:outline web:focus-visible:outline-2 web:focus-visible:outline-primary min-h-[64px] flex-row items-center gap-3 py-2.5 active:opacity-70"
    >
      <AssetLogo
        symbol={asset.symbol}
        uri={asset.logoUrl}
        size={40}
        shape={asset.class === 'stock_token' ? 'squircle' : 'circle'}
      />
      <View className="flex-1 gap-0.5">
        <View className="flex-row items-center gap-1.5">
          <Text weight="semibold" numberOfLines={1}>
            {symbol}
          </Text>
          {asset.class === 'stock_token' ? (
            <View className="bg-secondary/20 rounded-sm px-1">
              <Text variant="micro" tone="secondary" weight="semibold">
                {t('discover.badge247')}
              </Text>
            </View>
          ) : null}
        </View>
        <Text variant="small" tone="muted" numberOfLines={1}>
          {asset.underlyingName ?? asset.name}
        </Text>
      </View>
      {showSpark && values.length > 1 ? (
        <Sparkline values={values} color={up ? colors.gain : colors.loss} />
      ) : null}
      <View className="min-w-[92px] items-end gap-0.5">
        <PriceText
          value={live?.price ?? asset.price}
          formatted={f.price(live?.price ?? asset.price)}
          weight="semibold"
        />
        <ChangeText pct={live?.change24hPct ?? asset.change24hPct} locale={f.locale} />
      </View>
    </Pressable>
  );
});
