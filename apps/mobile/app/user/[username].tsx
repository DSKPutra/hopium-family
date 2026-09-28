import { IconButton, useTheme } from '@hopium/ui';
import { router, useLocalSearchParams } from 'expo-router';
import { ArrowLeft } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { ProfileView } from '@/components/ProfileView';
import { useMe } from '@/hooks/queries';

export default function UserProfile() {
  const { username = '' } = useLocalSearchParams<{ username: string }>();
  const { t } = useTranslation();
  const { colors } = useTheme();
  const me = useMe();
  return (
    <View className="bg-bg flex-1">
      <ProfileView username={username} own={me.data?.username === username} />
      <View className="absolute left-2 top-12">
        <IconButton
          accessibilityLabel={t('common.back')}
          variant="surface"
          icon={<ArrowLeft size={22} color={colors.text} />}
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
        />
      </View>
    </View>
  );
}
