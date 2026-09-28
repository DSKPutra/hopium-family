import { SLIPPAGE_PRESETS_BPS, slippageLevel } from '@hopium/core';
import { Chip, Input, RiskBanner, Text } from '@hopium/ui';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

export function SlippageSettings({
  value,
  onChange,
}: {
  value: number;
  onChange: (bps: number) => void;
}) {
  const { t } = useTranslation();
  const isPreset = (SLIPPAGE_PRESETS_BPS as readonly number[]).includes(value);
  const [custom, setCustom] = useState(isPreset ? '' : String(value / 100));
  const level = slippageLevel(value);
  return (
    <View className="border-border bg-surface-2 gap-3 rounded-md border p-3">
      <Text variant="small" weight="semibold">
        {t('order.slippageTitle')}
      </Text>
      <Text variant="small" tone="muted">
        {t('order.slippageBody')}
      </Text>
      <View className="flex-row flex-wrap gap-2">
        {SLIPPAGE_PRESETS_BPS.map((bps) => (
          <Chip
            key={bps}
            label={`${bps / 100}%`}
            selected={value === bps}
            onPress={() => {
              setCustom('');
              onChange(bps);
            }}
          />
        ))}
      </View>
      <Input
        label={t('order.slippageCustom')}
        value={custom}
        inputMode="decimal"
        keyboardType="decimal-pad"
        numeric
        placeholder="1.5"
        onChangeText={(v) => {
          const clean = v.replace(',', '.').replace(/[^0-9.]/g, '');
          setCustom(clean);
          const bps = Math.round(Number(clean) * 100);
          if (clean && Number.isFinite(bps)) onChange(bps);
        }}
        error={custom && level === 'invalid' ? t('order.slippageInvalid') : null}
      />
      {level === 'warning' ? (
        <RiskBanner tone="warning" message={t('order.slippageWarning')} />
      ) : null}
    </View>
  );
}
