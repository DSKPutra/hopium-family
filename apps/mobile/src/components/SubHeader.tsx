import { IconButton, Text, useTheme } from '@hopium/ui';
import { router, type Href } from 'expo-router';
import { ArrowLeft } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { Seo } from './Seo';

export function SubHeader({ title, fallback = '/settings' }: { title: string; fallback?: Href }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  return (
    <View className="flex-row items-center gap-2 py-2">
      <Seo title={`${title} · hopium.family`} />
      <IconButton
        accessibilityLabel={t('common.back')}
        icon={<ArrowLeft size={22} color={colors.text} />}
        onPress={() => (router.canGoBack() ? router.back() : router.replace(fallback))}
      />
      <Text variant="h2">{title}</Text>
    </View>
  );
}
