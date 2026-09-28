import { feeRatePct, gt, type SpotQuote } from '@hopium/core';
import { Divider, Text } from '@hopium/ui';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { displaySymbol, useFormat } from '@/lib/format';

function Row({
  label,
  value,
  tone,
  testID,
}: {
  label: string;
  value: string;
  tone?: 'gain' | 'muted' | 'default' | 'warning';
  testID?: string;
}) {
  return (
    <View className="min-h-[28px] flex-row items-center justify-between gap-3">
      <Text variant="small" tone="muted">
        {label}
      </Text>
      <Text testID={testID} variant="small" numeric weight="medium" tone={tone ?? 'default'}>
        {value}
      </Text>
    </View>
  );
}

export function QuoteBreakdown({
  quote,
  tags,
  refreshLabel,
}: {
  quote: SpotQuote;
  tags: string[];
  refreshLabel: string;
}) {
  const { t } = useTranslation();
  const f = useFormat();
  const symbol = displaySymbol(quote.symbol, tags);
  const impactHigh = gt(quote.priceImpactPct, 1);
  return (
    <View
      className="border-border bg-surface-2 gap-1 rounded-md border p-3"
      testID="quote-breakdown"
    >
      <Row
        testID="quote-receive"
        label={t('order.youReceive')}
        value={quote.side === 'buy' ? `${f.qty(quote.qty)} ${symbol}` : f.usd(quote.totalUsd)}
        tone="default"
      />
      <Row label={t('order.price')} value={f.price(quote.price)} />
      <Row
        label={t('order.priceImpact')}
        value={f.pct(quote.priceImpactPct, { signed: false, decimals: 3 })}
        tone={impactHigh ? 'warning' : 'muted'}
      />
      <Row
        label={t('order.networkFee')}
        value={quote.gasSponsored ? t('order.sponsored') : f.usd(quote.networkFeeUsd)}
        tone={quote.gasSponsored ? 'gain' : 'default'}
      />
      <Row
        label={t('order.platformFee', { pct: feeRatePct(quote.feeRate) })}
        value={f.usd(quote.platformFeeUsd, { decimals: 2 })}
      />
      <Divider className="my-1" />
      <Row
        testID="quote-total"
        label={quote.side === 'buy' ? t('order.total') : t('order.youGet')}
        value={f.usd(quote.totalUsd)}
      />
      <Text variant="micro" tone="muted" className="mt-1">
        {refreshLabel}
      </Text>
    </View>
  );
}
