import { Button, LogoMark, Text } from '@hopium/ui';
import { useCallback, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { AppState, Platform, View } from 'react-native';

import { authenticate } from '@/lib/biometrics';
import { useSettings } from '@/stores/settings';
import { useUi } from '@/stores/ui';

const AUTO_LOCK_MS = 5 * 60_000;

/** Biometric lock on open and after 5 minutes in the background (native). */
export function AppLock() {
  const { t } = useTranslation();
  const enabled = useSettings((s) => s.biometricOnOpen) && Platform.OS !== 'web';
  const locked = useUi((s) => s.locked);
  const setLocked = useUi((s) => s.setLocked);
  const backgroundedAt = useRef<number | null>(null);

  const unlock = useCallback(async () => {
    if (await authenticate(t('lock.prompt'))) setLocked(false);
  }, [setLocked, t]);

  useEffect(() => {
    if (enabled) {
      setLocked(true);
      void unlock();
    }
    // Lock once on launch only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return;
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'background') backgroundedAt.current = Date.now();
      if (
        state === 'active' &&
        backgroundedAt.current &&
        Date.now() - backgroundedAt.current > AUTO_LOCK_MS
      ) {
        setLocked(true);
        void unlock();
      }
    });
    return () => sub.remove();
  }, [enabled, setLocked, unlock]);

  if (!enabled || !locked) return null;
  return (
    <View className="bg-bg absolute inset-0 z-50 items-center justify-center gap-4">
      <LogoMark size={72} />
      <Text variant="h2">{t('lock.title')}</Text>
      <Button label={t('lock.unlock')} onPress={() => void unlock()} />
    </View>
  );
}
