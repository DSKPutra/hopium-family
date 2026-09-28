import {
  DEFAULT_LEVERAGE,
  LEVERAGE_TICKS,
  add,
  gt,
  isHighLeverage,
  isValidDecimal,
  previewPerp,
  priceFromPct,
  validateTpSl,
  type PerpMarket,
  type PerpSide,
} from '@hopium/core';
import {
  Button,
  Checkbox,
  Input,
  RiskBanner,
  SegmentedControl,
  Slider,
  Text,
  haptics,
  useToast,
} from '@hopium/ui';
import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { usePortfolio } from '@/hooks/queries';
import { useServices } from '@/hooks/useServices';
import { errorMessage } from '@/lib/errors';
import { useFormat } from '@/lib/format';

function StatRow({
  label,
  value,
  emphasis,
  testID,
}: {
  label: string;
  value: string;
  emphasis?: boolean;
  testID?: string;
}) {
  return (
    <View className="flex-row items-center justify-between">
      <Text variant="small" tone="muted">
        {label}
      </Text>
      <Text
        testID={testID}
        variant={emphasis ? 'body' : 'small'}
        numeric
        weight={emphasis ? 'bold' : 'medium'}
        tone={emphasis ? 'warning' : 'default'}
      >
        {value}
      </Text>
    </View>
  );
}

export function PerpOrderPanel({
  market,
  initialSide = 'long',
}: {
  market: PerpMarket;
  initialSide?: PerpSide;
}) {
  const { t } = useTranslation();
  const f = useFormat();
  const toast = useToast();
  const { backend } = useServices();
  const portfolio = usePortfolio();
  const [side, setSide] = useState<PerpSide>(initialSide);
  const [margin, setMargin] = useState('100');
  const [leverage, setLeverage] = useState(Math.min(DEFAULT_LEVERAGE, market.maxLeverage));
  const [tpMode, setTpMode] = useState<'price' | 'pct'>('price');
  const [tp, setTp] = useState('');
  const [sl, setSl] = useState('');
  const [ack, setAck] = useState(false);

  const validMargin = isValidDecimal(margin) && gt(margin, 0);
  const preview = validMargin
    ? previewPerp({
        side,
        marginUsd: margin,
        leverage,
        price: market.markPrice,
        mmr: market.maintenanceMarginRate,
        feeRate: market.takerFeeRate,
      })
    : null;
  const toPrice = (v: string, kind: 'tp' | 'sl') =>
    !v || !isValidDecimal(v)
      ? undefined
      : tpMode === 'price'
        ? v
        : priceFromPct(side, market.markPrice, v, kind);
  const tpPrice = toPrice(tp, 'tp');
  const slPrice = toPrice(sl, 'sl');
  const tpslErrors = preview
    ? validateTpSl({
        side,
        entry: market.markPrice,
        liqPrice: preview.liqPrice,
        tp: tpPrice,
        sl: slPrice,
      })
    : [];
  const high = isHighLeverage(leverage);
  const cash = portfolio.data?.cashUsd ?? '0';
  const insufficient = preview ? gt(add(margin, preview.fee), cash) : false;

  const open = useMutation({
    mutationFn: () =>
      backend.openPerp({
        marketId: market.id,
        side,
        marginUsd: margin,
        leverage,
        tp: tpPrice,
        sl: slPrice,
        acknowledgedHighLeverage: ack,
      }),
    onSuccess: () => {
      haptics.success();
      toast.show(t('perps.opened'), 'success');
      setTp('');
      setSl('');
    },
    onError: (err) => {
      haptics.error();
      toast.show(errorMessage(t, err), 'error');
    },
  });

  const disabled = !preview || tpslErrors.length > 0 || (high && !ack) || insufficient;

  return (
    <View className="gap-4" testID="perp-panel">
      <SegmentedControl
        segments={[
          { value: 'long', label: t('perps.long') },
          { value: 'short', label: t('perps.short') },
        ]}
        value={side}
        onChange={setSide}
      />
      <Input
        testID="perp-margin"
        label={t('perps.margin')}
        value={margin}
        onChangeText={(v) => setMargin(v.replace(',', '.').replace(/[^0-9.]/g, ''))}
        inputMode="decimal"
        keyboardType="decimal-pad"
        numeric
        helper={t('order.available', { amount: f.usd(cash) })}
        error={insufficient ? t('order.insufficient') : null}
      />
      <View className="gap-2">
        <View className="flex-row items-center justify-between">
          <Text variant="small" weight="medium" tone="muted">
            {t('perps.leverage')}
          </Text>
          <Text variant="h3" numeric tone={high ? 'loss' : 'default'} testID="perp-leverage-value">
            {t('perps.leverageValue', { value: leverage })}
          </Text>
        </View>
        <Slider
          value={leverage}
          min={1}
          max={market.maxLeverage}
          onChange={(v) => {
            setLeverage(v);
            if (!isHighLeverage(v)) setAck(false);
          }}
          ticks={LEVERAGE_TICKS.filter((x) => x <= market.maxLeverage)}
          formatTick={(v) => `${v}×`}
          accessibilityLabel={t('perps.leverage')}
          decrementLabel={t('common.decrease')}
          incrementLabel={t('common.increase')}
          dangerAbove={10}
        />
      </View>

      {high ? (
        <View className="gap-2" testID="high-leverage-warning">
          <RiskBanner
            tone="danger"
            title={t('perps.highLeverageTitle')}
            message={t('perps.highLeverage')}
          />
          <Checkbox
            testID="high-leverage-ack"
            label={t('perps.highLeverageAck')}
            checked={ack}
            onChange={setAck}
            tone="danger"
          />
        </View>
      ) : null}

      <View className="border-border bg-surface-2 gap-2 rounded-md border p-3">
        <StatRow
          testID="perp-liq"
          label={t('perps.liqPrice')}
          value={preview ? f.price(preview.liqPrice) : '—'}
          emphasis
        />
        <StatRow
          label={t('perps.size')}
          value={preview ? `${f.qty(preview.size)} ${market.symbol.replace('-PERP', '')}` : '—'}
        />
        <StatRow label={t('perps.notional')} value={preview ? f.usd(preview.notional) : '—'} />
        <StatRow
          label={t('perps.fee')}
          value={preview ? f.usd(preview.fee, { decimals: 4 }) : '—'}
        />
      </View>

      <View className="gap-2">
        <View className="flex-row items-center justify-between">
          <Text variant="small" weight="semibold">
            {t('perps.tp')} / {t('perps.sl')}
          </Text>
          <SegmentedControl
            className="w-[140px]"
            segments={[
              { value: 'price', label: t('perps.modePrice') },
              { value: 'pct', label: t('perps.modePct') },
            ]}
            value={tpMode}
            onChange={(v) => {
              setTpMode(v);
              setTp('');
              setSl('');
            }}
          />
        </View>
        <View className="flex-row gap-3">
          <Input
            testID="perp-tp"
            className="flex-1"
            label={t('perps.tp')}
            value={tp}
            onChangeText={(v) => setTp(v.replace(',', '.').replace(/[^0-9.]/g, ''))}
            placeholder={
              tpMode === 'price' ? t('perps.pricePlaceholder') : t('perps.pctPlaceholder')
            }
            inputMode="decimal"
            keyboardType="decimal-pad"
            numeric
            error={tpslErrors.includes('invalid_tp') ? t('errors.invalid_tp') : null}
            helper={tpMode === 'pct' && tpPrice ? f.price(tpPrice) : null}
          />
          <Input
            testID="perp-sl"
            className="flex-1"
            label={t('perps.sl')}
            value={sl}
            onChangeText={(v) => setSl(v.replace(',', '.').replace(/[^0-9.]/g, ''))}
            placeholder={
              tpMode === 'price' ? t('perps.pricePlaceholder') : t('perps.pctPlaceholder')
            }
            inputMode="decimal"
            keyboardType="decimal-pad"
            numeric
            error={
              tpslErrors.includes('invalid_sl')
                ? t('errors.invalid_sl')
                : tpslErrors.includes('sl_beyond_liquidation')
                  ? t('errors.sl_beyond_liquidation')
                  : null
            }
            helper={tpMode === 'pct' && slPrice ? f.price(slPrice) : null}
          />
        </View>
      </View>

      <Button
        testID="perp-open"
        label={side === 'long' ? t('perps.openLong') : t('perps.openShort')}
        variant={side === 'long' ? 'gain' : 'danger'}
        size="lg"
        fullWidth
        disabled={disabled}
        loading={open.isPending}
        onPress={() => open.mutate()}
      />
    </View>
  );
}
