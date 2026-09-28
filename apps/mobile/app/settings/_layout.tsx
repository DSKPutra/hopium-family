import { useTheme } from '@hopium/ui';
import { Stack } from 'expo-router';

export default function SettingsLayout() {
  const { colors } = useTheme();
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }} />
  );
}
