import * as LocalAuthentication from 'expo-local-authentication';
import { Platform } from 'react-native';

export async function biometricsAvailable(): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  const [hardware, enrolled] = await Promise.all([
    LocalAuthentication.hasHardwareAsync(),
    LocalAuthentication.isEnrolledAsync(),
  ]);
  return hardware && enrolled;
}

/** Resolves true when authenticated, or when biometrics aren't available on this platform. */
export async function authenticate(prompt: string): Promise<boolean> {
  if (!(await biometricsAvailable())) return true;
  const res = await LocalAuthentication.authenticateAsync({
    promptMessage: prompt,
    disableDeviceFallback: false,
  });
  return res.success;
}
