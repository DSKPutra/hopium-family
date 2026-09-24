import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { isDemo } from '@/lib/env';

export default function Index() {
  const { t } = useTranslation();
  return (
    <SafeAreaView className="bg-bg flex-1">
      <View className="flex-1 items-center justify-center gap-3 px-4">
        <Text accessibilityRole="header" className="text-display text-text font-bold">
          {t('brand.name')}
        </Text>
        <Text className="text-body text-text-muted">{t('brand.tagline')}</Text>
        {isDemo ? (
          <View className="rounded-pill border-warning mt-4 border px-3 py-1">
            <Text className="text-micro text-warning font-semibold uppercase">
              {t('common.demoMode')}
            </Text>
          </View>
        ) : null}
      </View>
    </SafeAreaView>
  );
}
