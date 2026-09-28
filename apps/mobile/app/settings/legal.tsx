import { Card, Screen, Text } from '@hopium/ui';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { SettingsGroup, SettingsRow } from '@/components/SettingsRow';
import { SubHeader } from '@/components/SubHeader';

export default function Legal() {
  const { t } = useTranslation();
  return (
    <Screen>
      <SubHeader title={t('settings.legal')} />
      <SettingsGroup>
        <SettingsRow
          label={t('settings.terms')}
          onPress={() => router.push({ pathname: '/legal/[doc]', params: { doc: 'terms' } })}
        />
        <SettingsRow
          label={t('settings.privacyPolicy')}
          onPress={() => router.push({ pathname: '/legal/[doc]', params: { doc: 'privacy' } })}
        />
        <SettingsRow
          label={t('settings.risk')}
          onPress={() => router.push({ pathname: '/legal/[doc]', params: { doc: 'risk' } })}
        />
      </SettingsGroup>
      <Card className="mt-5 gap-2">
        <Text weight="semibold">{t('settings.licenses')}</Text>
        <Text variant="small" tone="muted">
          {t('settings.licensesBody')}
        </Text>
      </Card>
      <Card className="mt-4 gap-3">
        <Text weight="semibold">{t('settings.faq')}</Text>
        {(['1', '2', '3'] as const).map((n) => (
          <View key={n} className="gap-1">
            <Text variant="small" weight="semibold">
              {t(`faq.q${n}`)}
            </Text>
            <Text variant="small" tone="muted">
              {t(`faq.a${n}`)}
            </Text>
          </View>
        ))}
      </Card>
    </Screen>
  );
}
