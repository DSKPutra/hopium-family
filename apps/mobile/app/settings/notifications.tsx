import type { NotificationSettings } from '@hopium/core';
import { Button, Card, Screen, SkeletonList, Switch } from '@hopium/ui';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';

import { SubHeader } from '@/components/SubHeader';
import { useNotificationSettings } from '@/hooks/queries';
import { useServices } from '@/hooks/useServices';
import { requestAndRegister } from '@/lib/notifications';
import { queryKeys } from '@/lib/queryKeys';

const ROWS: { key: keyof NotificationSettings; label: string }[] = [
  { key: 'followedTrades', label: 'settings.notifFollowedTrades' },
  { key: 'priceAlerts', label: 'settings.notifPriceAlerts' },
  { key: 'liquidationRisk', label: 'settings.notifLiquidation' },
  { key: 'thesisUpdates', label: 'settings.notifTheses' },
  { key: 'social', label: 'settings.notifSocial' },
  { key: 'marketing', label: 'settings.notifMarketing' },
];

export default function NotificationSettingsScreen() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const { backend } = useServices();
  const q = useNotificationSettings();
  return (
    <Screen>
      <SubHeader title={t('settings.notifications')} />
      {q.data ? (
        <Card className="gap-0">
          {ROWS.map((r) => (
            <Switch
              key={r.key}
              label={t(r.label as never)}
              value={q.data[r.key]}
              onValueChange={async (v) => {
                qc.setQueryData(queryKeys.notificationSettings, { ...q.data, [r.key]: v });
                await backend.updateNotificationSettings({ [r.key]: v });
              }}
            />
          ))}
        </Card>
      ) : (
        <SkeletonList count={6} />
      )}
      <Button
        label={t('notifications.primerAllow')}
        variant="outline"
        className="mt-4"
        onPress={() => void requestAndRegister()}
      />
    </Screen>
  );
}
