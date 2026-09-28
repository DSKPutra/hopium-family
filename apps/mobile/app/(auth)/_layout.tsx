import { useTheme } from '@hopium/ui';
import { Stack } from 'expo-router';

import { useSession } from '@/hooks/queries';

export default function AuthLayout() {
  const { colors } = useTheme();
  const session = useSession();
  const signedIn = !!session.data;
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }}>
      <Stack.Protected guard={!signedIn}>
        <Stack.Screen name="welcome" />
        <Stack.Screen name="sign-in" />
        <Stack.Screen name="verify-otp" />
      </Stack.Protected>
      <Stack.Protected guard={signedIn}>
        <Stack.Screen name="onboarding" />
      </Stack.Protected>
    </Stack>
  );
}
