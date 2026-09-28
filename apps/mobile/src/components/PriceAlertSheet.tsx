import type { Asset, PriceAlertCondition } from '@hopium/core';
import {
  BottomSheet,
  Button,
  IconButton,
  Input,
  SegmentedControl,
  Text,
  useTheme,
  useToast,
} from '@hopium/ui';
import { useQueryClient } from '@tanstack/react-query';
import { Trash2 } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { usePriceAlerts } from '@/hooks/queries';
import { useServices } from '@/hooks/useServices';
import { errorMessage } from '@/lib/errors';
import { useFormat } from '@/lib/format';
import { queryKeys } from '@/lib/queryKeys';

export function PriceAlertSheet({
  visible,
  onClose,
  asset,
}: {
  visible: boolean;
  onClose: () => void;
  asset: Asset;
}) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const toast = useToast();
  const f = useFormat();
  const qc = useQueryClient();
  const { backend } = useServices();
  const alerts = usePriceAlerts();
  const [condition, setCondition] = useState<PriceAlertCondition>('above');
  const [value, setValue] = useState('');
  const mine = (alerts.data ?? []).filter((a) => a.assetId === asset.id);
  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      title={`${t('notifications.alerts.title')} · ${asset.symbol}`}
      closeLabel={t('common.close')}
    >
      <View className="gap-3">
        <SegmentedControl
          segments={[
            { value: 'above', label: t('notifications.alerts.above') },
            { value: 'below', label: t('notifications.alerts.below') },
            { value: 'pct_change', label: t('notifications.alerts.pct_change') },
          ]}
          value={condition}
          onChange={setCondition}
        />
        <Input
          label={t('notifications.alerts.value')}
          value={value}
          onChangeText={(v) => setValue(v.replace(',', '.').replace(/[^0-9.]/g, ''))}
          inputMode="decimal"
          keyboardType="decimal-pad"
          numeric
          placeholder={condition === 'pct_change' ? '10' : asset.price}
          helper={f.price(asset.price)}
        />
        <Button
          label={t('notifications.alerts.create')}
          disabled={!value}
          onPress={async () => {
            try {
              await backend.createPriceAlert({ assetId: asset.id, condition, value });
              await qc.invalidateQueries({ queryKey: queryKeys.priceAlerts });
              toast.show(t('notifications.alerts.created'), 'success');
              setValue('');
            } catch (err) {
              toast.show(errorMessage(t, err), 'error');
            }
          }}
        />
        {mine.length ? (
          mine.map((a) => (
            <View
              key={a.id}
              className="border-border flex-row items-center justify-between rounded-md border p-3"
            >
              <Text variant="small" numeric>
                {t(`notifications.alerts.${a.condition}`)}{' '}
                {a.condition === 'pct_change' ? `${a.value}%` : f.price(a.value)} ·{' '}
                {a.isActive
                  ? t('notifications.alerts.active')
                  : t('notifications.alerts.triggered')}
              </Text>
              <IconButton
                accessibilityLabel={t('notifications.alerts.delete')}
                icon={<Trash2 size={18} color={colors.loss} />}
                onPress={async () => {
                  await backend.deletePriceAlert(a.id);
                  await qc.invalidateQueries({ queryKey: queryKeys.priceAlerts });
                }}
              />
            </View>
          ))
        ) : (
          <Text variant="small" tone="muted">
            {t('notifications.alerts.empty')}
          </Text>
        )}
      </View>
    </BottomSheet>
  );
}
