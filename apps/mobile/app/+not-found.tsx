import { Link, Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';

export default function NotFound() {
  const { t } = useTranslation();
  return (
    <>
      <Stack.Screen options={{ title: t('notFound.title') }} />
      <View className="bg-bg flex-1 items-center justify-center gap-3 px-4">
        <Text accessibilityRole="header" className="text-h2 text-text font-bold">
          {t('notFound.title')}
        </Text>
        <Text className="text-body text-text-muted">{t('notFound.body')}</Text>
        <Link href="/" className="text-body text-primary mt-2 min-h-[44px] py-3 font-semibold">
          {t('common.goHome')}
        </Link>
      </View>
    </>
  );
}
