import { Button, Input, RiskBanner, Screen, Text, useToast } from '@hopium/ui';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { SubHeader } from '@/components/SubHeader';
import { useServices } from '@/hooks/useServices';
import { errorMessage } from '@/lib/errors';
import { useSettings } from '@/stores/settings';

export default function DeleteAccount() {
  const { t } = useTranslation();
  const toast = useToast();
  const qc = useQueryClient();
  const { backend } = useServices();
  const reset = useSettings((s) => s.reset);
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  return (
    <Screen>
      <SubHeader title={t('settings.deleteTitle')} />
      <View className="gap-4">
        <RiskBanner tone="danger" message={t('settings.deleteBody')} />
        <Input
          testID="delete-confirm-input"
          label={t('settings.deleteType')}
          value={confirm}
          onChangeText={setConfirm}
          autoCapitalize="none"
          autoCorrect={false}
        />
        <Button
          testID="delete-confirm"
          label={t('settings.deleteConfirm')}
          variant="danger"
          size="lg"
          disabled={confirm.trim().toLowerCase() !== 'delete'}
          loading={busy}
          onPress={async () => {
            setBusy(true);
            try {
              await backend.deleteAccount(confirm);
              reset();
              qc.clear();
              toast.show(t('settings.deleted'), 'info');
            } catch (err) {
              toast.show(errorMessage(t, err), 'error');
              setBusy(false);
            }
          }}
        />
        <Text variant="small" tone="muted">
          {t('settings.supportEmail')}
        </Text>
      </View>
    </Screen>
  );
}
