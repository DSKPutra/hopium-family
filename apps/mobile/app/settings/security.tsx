import { Button, Card, Screen, Switch, Text, useToast } from '@hopium/ui';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Platform, View } from 'react-native';

import { SubHeader } from '@/components/SubHeader';
import { useServices } from '@/hooks/useServices';
import { authenticate, biometricsAvailable } from '@/lib/biometrics';
import { isDemo } from '@/lib/env';
import { errorMessage } from '@/lib/errors';
import { useSettings } from '@/stores/settings';

export default function Security() {
  const { t } = useTranslation();
  const toast = useToast();
  const { backend } = useServices();
  const settings = useSettings();
  const [available, setAvailable] = useState(false);
  useEffect(() => {
    void biometricsAvailable().then(setAvailable);
  }, []);
  const hint =
    Platform.OS === 'web'
      ? t('common.notAvailableWeb')
      : !available
        ? t('settings.biometricUnavailable')
        : undefined;
  return (
    <Screen>
      <SubHeader title={t('settings.security')} />
      <Card className="gap-0">
        <Switch
          label={t('settings.biometricOpen')}
          description={hint ?? t('settings.biometricOpenHint')}
          value={settings.biometricOnOpen}
          disabled={!available}
          onValueChange={async (v) => {
            if (v && !(await authenticate(t('lock.prompt')))) return;
            settings.set({ biometricOnOpen: v });
          }}
        />
        <Switch
          label={t('settings.biometricTrades')}
          description={hint}
          value={settings.biometricForTrades}
          disabled={!available}
          onValueChange={(v) => settings.set({ biometricForTrades: v })}
        />
      </Card>
      <Card className="mt-4 gap-1">
        <Text variant="small" weight="semibold" tone="muted">
          {t('settings.activeSessions')}
        </Text>
        <Text>{t('settings.thisDevice')}</Text>
      </Card>
      <Card className="mt-4 gap-2">
        <Text weight="semibold">{t('settings.exportWallet')}</Text>
        <Text variant="small" tone="muted">
          {t('settings.exportWalletHint')}
        </Text>
        <View>
          <Button
            label={t('settings.exportWallet')}
            variant="outline"
            onPress={async () => {
              try {
                await backend.exportWallet();
                if (isDemo) toast.show(t('wallet.exportUnavailable'), 'info');
              } catch (err) {
                toast.show(errorMessage(t, err), 'error');
              }
            }}
          />
        </View>
      </Card>
    </Screen>
  );
}
