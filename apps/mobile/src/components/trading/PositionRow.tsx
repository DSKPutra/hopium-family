import { isNearLiquidation, validateTpSl, type PerpPosition } from '@hopium/core';
import { Button, Card, Input, PnLBadge, RiskBanner, Text, haptics, useToast } from '@hopium/ui';
import { useMutation } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';

import { useServices } from '@/hooks/useServices';
import { errorMessage } from '@/lib/errors';
import { useFormat } from '@/lib/format';

function Cell({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: 'gain' | 'loss' | 'warning' | 'default';
}) {
  return (
    <View className="min-w-[30%] flex-1 gap-0.5">
      <Text variant="micro" tone="muted">
        {label}
      </Text>
      <Text variant="small" numeric weight="medium" tone={tone ?? 'default'}>
        {value}
      </Text>
    </View>
  );
}

export function PositionRow({
  position,
  showMarketLink = false,
}: {
  position: PerpPosition;
  showMarketLink?: boolean;
}) {
  const { t } = useTranslation();
  const f = useFormat();
  const toast = useToast();
  const { backend } = useServices();
  const [editing, setEditing] = useState(false);
  const [tp, setTp] = useState(position.tp ?? '');
  const [sl, setSl] = useState(position.sl ?? '');
  const near = isNearLiquidation(position.side, position.markPrice, position.liqPrice);
  const up = !position.unrealizedPnl.startsWith('-');
  const errors = validateTpSl({
    side: position.side,
    entry: position.entryPrice,
    liqPrice: position.liqPrice,
    tp: tp || undefined,
    sl: sl || undefined,
  });

  const close = useMutation({
    mutationFn: (pct: number) => backend.closePerp(position.id, pct),
    onSuccess: () => {
      haptics.success();
      toast.show(t('perps.closed'), 'success');
    },
    onError: (err) => toast.show(errorMessage(t, err), 'error'),
  });
  const save = useMutation({
    mutationFn: () => backend.setTpSl(position.id, tp || undefined, sl || undefined),
    onSuccess: () => {
      setEditing(false);
      toast.show(t('common.saved'), 'success');
    },
    onError: (err) => toast.show(errorMessage(t, err), 'error'),
  });

  return (
    <Card className="gap-3" testID={`position-${position.symbol}`}>
      <Pressable
        disabled={!showMarketLink}
        accessibilityRole={showMarketLink ? 'link' : undefined}
        onPress={() =>
          router.push({ pathname: '/perps/[market]', params: { market: position.marketId } })
        }
        className="flex-row items-center gap-2"
      >
        <View
          className={
            position.side === 'long'
              ? 'rounded-pill bg-gain/15 px-2 py-0.5'
              : 'rounded-pill bg-loss/15 px-2 py-0.5'
          }
        >
          <Text variant="micro" weight="semibold" tone={position.side === 'long' ? 'gain' : 'loss'}>
            {position.side === 'long' ? `▲ ${t('perps.long')}` : `▼ ${t('perps.short')}`}{' '}
            {position.leverage}×
          </Text>
        </View>
        <Text weight="semibold">{position.symbol}</Text>
        <View className="flex-1" />
        <PnLBadge
          pct={position.roePct}
          amount={f.money(position.unrealizedPnl, { signed: true })}
          locale={f.locale}
          size="md"
        />
      </Pressable>
      {near ? (
        <RiskBanner
          testID="liq-risk-banner"
          tone="danger"
          message={t('perps.nearLiquidation', { market: position.symbol })}
        />
      ) : null}
      <View className="flex-row flex-wrap gap-y-2">
        <Cell label={t('perps.size')} value={f.qty(position.size)} />
        <Cell label={t('perps.entry')} value={f.price(position.entryPrice)} />
        <Cell label={t('perps.mark')} value={f.price(position.markPrice)} />
        <Cell label={t('perps.liqPriceShort')} value={f.price(position.liqPrice)} tone="warning" />
        <Cell
          label={t('perps.pnl')}
          value={f.money(position.unrealizedPnl, { signed: true })}
          tone={up ? 'gain' : 'loss'}
        />
        <Cell
          label={t('perps.roe')}
          value={f.pct(position.roePct, { arrow: true })}
          tone={up ? 'gain' : 'loss'}
        />
        <Cell label={t('perps.margin').replace(' (USDC)', '')} value={f.usd(position.margin)} />
        <Cell
          label="TP / SL"
          value={`${position.tp ? f.price(position.tp) : '—'} / ${position.sl ? f.price(position.sl) : '—'}`}
        />
      </View>
      {editing ? (
        <View className="gap-2">
          <View className="flex-row gap-3">
            <Input
              className="flex-1"
              label={t('perps.tp')}
              value={tp}
              onChangeText={setTp}
              inputMode="decimal"
              numeric
              error={errors.includes('invalid_tp') ? t('errors.invalid_tp') : null}
            />
            <Input
              className="flex-1"
              label={t('perps.sl')}
              value={sl}
              onChangeText={setSl}
              inputMode="decimal"
              numeric
              error={
                errors.includes('invalid_sl')
                  ? t('errors.invalid_sl')
                  : errors.includes('sl_beyond_liquidation')
                    ? t('errors.sl_beyond_liquidation')
                    : null
              }
            />
          </View>
          <Button
            label={t('perps.saveTpSl')}
            size="sm"
            disabled={errors.length > 0}
            loading={save.isPending}
            onPress={() => save.mutate()}
          />
        </View>
      ) : null}
      <View className="flex-row flex-wrap gap-2">
        <Button
          label={t('perps.editTpSl')}
          size="sm"
          variant="outline"
          onPress={() => setEditing((v) => !v)}
        />
        {[25, 50, 75, 100].map((pct) => (
          <Button
            key={pct}
            testID={`close-${pct}`}
            label={t('perps.closePct', { pct })}
            size="sm"
            variant={pct === 100 ? 'danger' : 'secondary'}
            loading={close.isPending && close.variables === pct}
            onPress={() => close.mutate(pct)}
          />
        ))}
      </View>
    </Card>
  );
}
