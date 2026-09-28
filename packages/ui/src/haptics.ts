import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

/** Haptic feedback; a no-op on web. */
export const haptics = {
  light(): void {
    if (Platform.OS !== 'web')
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
  },
  success(): void {
    if (Platform.OS !== 'web')
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
        () => undefined,
      );
  },
  warning(): void {
    if (Platform.OS !== 'web')
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(
        () => undefined,
      );
  },
  error(): void {
    if (Platform.OS !== 'web')
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => undefined);
  },
};
