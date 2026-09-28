import { Button, Card, RiskBanner, Screen, Text, useTheme, useToast } from '@hopium/ui';
import { ShieldCheck } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { SubHeader } from '@/components/SubHeader';
import { useKycStatus } from '@/hooks/queries';
import { useServices } from '@/hooks/useServices';
import { isDemo } from '@/lib/env';
import { errorMessage } from '@/lib/errors';

export default function Kyc() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const toast = useToast();
  const { backend } = useServices();
  const status = useKycStatus();
  const s = status.data ?? 'none';
  return (
    <Screen>
      <SubHeader title={t('settings.kyc')} />
      <Card className="items-center gap-3">
        <ShieldCheck
          size={44}
          color={s === 'approved' ? colors.gain : s === 'rejected' ? colors.loss : colors.secondary}
        />
        <Text variant="h3" testID="kyc-status">
          {t(`settings.kycStatus.${s}`)}
        </Text>
        <Text tone="muted" align="center">
          {t('settings.kycBody')}
        </Text>
        {s === 'none' || s === 'rejected' ? (
          <View className="w-full">
            <Button
              testID="kyc-start"
              label={t('settings.kycStart')}
              onPress={async () => {
                try {
                  await backend.startKyc();
                  void status.refetch();
                } catch (err) {
                  toast.show(errorMessage(t, err), 'error');
                }
              }}
            />
          </View>
        ) : null}
      </Card>
      {isDemo ? <RiskBanner tone="info" message={t('settings.kycDemo')} className="mt-4" /> : null}
    </Screen>
  );
}
