import { router } from 'expo-router';

import { logger } from './logger';
import { backend } from './services';

export type PermissionState = 'granted' | 'denied' | 'undetermined';

export async function getPermission(): Promise<PermissionState> {
  if (typeof Notification === 'undefined') return 'denied';
  return Notification.permission === 'default'
    ? 'undetermined'
    : (Notification.permission as PermissionState);
}

/** Web Push: asks permission (after the primer) and registers the service worker. */
export async function requestAndRegister(): Promise<PermissionState> {
  try {
    if (typeof Notification === 'undefined') return 'denied';
    const res = await Notification.requestPermission();
    if (res === 'granted' && 'serviceWorker' in navigator) {
      await navigator.serviceWorker.register('/sw.js').catch(() => undefined);
      await backend().registerPushToken(`web:${navigator.userAgent.slice(0, 64)}`, 'web');
    }
    return res === 'default' ? 'undetermined' : (res as PermissionState);
  } catch (err) {
    logger.warn('Web push registration failed', err);
    return 'denied';
  }
}

export async function presentLocalNotification(
  title: string,
  body: string,
  href?: string,
): Promise<void> {
  try {
    if ((await getPermission()) !== 'granted') return;
    const n = new Notification(title, { body, icon: '/favicon.png' });
    n.onclick = () => {
      window.focus();
      if (href) router.push(href as never);
    };
  } catch (err) {
    logger.warn('Web notification failed', err);
  }
}

export function addNotificationResponseListener(): () => void {
  return () => undefined;
}
