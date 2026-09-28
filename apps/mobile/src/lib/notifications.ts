import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import { Platform } from 'react-native';

import { logger } from './logger';
import { backend } from './services';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: true,
  }),
});

export type PermissionState = 'granted' | 'denied' | 'undetermined';

export async function getPermission(): Promise<PermissionState> {
  if (Platform.OS === 'web') {
    if (typeof Notification === 'undefined') return 'denied';
    return Notification.permission === 'default'
      ? 'undetermined'
      : (Notification.permission as PermissionState);
  }
  const { status } = await Notifications.getPermissionsAsync();
  return status as PermissionState;
}

/**
 * Asks the OS for notification permission (only after our primer screen) and
 * registers the push token with the backend.
 */
export async function requestAndRegister(): Promise<PermissionState> {
  try {
    if (Platform.OS === 'web') {
      if (typeof Notification === 'undefined') return 'denied';
      const res = await Notification.requestPermission();
      if (res === 'granted' && 'serviceWorker' in navigator) {
        await navigator.serviceWorker.register('/sw.js').catch(() => undefined);
        await backend().registerPushToken(`web:${navigator.userAgent.slice(0, 64)}`, 'web');
      }
      return res === 'default' ? 'undetermined' : (res as PermissionState);
    }
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'default',
        importance: Notifications.AndroidImportance.HIGH,
      });
    }
    const { status } = await Notifications.requestPermissionsAsync();
    if (status !== 'granted') return status as PermissionState;
    const projectId = (Constants.expoConfig?.extra?.eas as { projectId?: string } | undefined)
      ?.projectId;
    if (Device.isDevice && projectId) {
      const token = await Notifications.getExpoPushTokenAsync({ projectId });
      await backend().registerPushToken(token.data, Platform.OS === 'ios' ? 'ios' : 'android');
    }
    return 'granted';
  } catch (err) {
    logger.warn('Push registration failed', err);
    return 'denied';
  }
}

/** Shows an OS-level notification for realtime alerts (demo mode / foreground). */
export async function presentLocalNotification(
  title: string,
  body: string,
  href?: string,
): Promise<void> {
  try {
    if ((await getPermission()) !== 'granted') return;
    if (Platform.OS === 'web') {
      const n = new Notification(title, { body, icon: '/favicon.png' });
      n.onclick = () => {
        window.focus();
        if (href) router.push(href as never);
      };
      return;
    }
    await Notifications.scheduleNotificationAsync({
      content: { title, body, data: { href } },
      trigger: null,
    });
  } catch (err) {
    logger.warn('Local notification failed', err);
  }
}

/** Deep-link when the user taps a notification. */
export function addNotificationResponseListener(): () => void {
  if (Platform.OS === 'web') return () => undefined;
  const sub = Notifications.addNotificationResponseReceivedListener((res) => {
    const href = res.notification.request.content.data?.href;
    if (typeof href === 'string') router.push(href as never);
  });
  return () => sub.remove();
}
