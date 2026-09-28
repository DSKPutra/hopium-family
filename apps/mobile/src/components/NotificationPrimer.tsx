import { BottomSheet, Button, Text, useTheme } from '@hopium/ui';
import { BellRing } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { getPermission, requestAndRegister } from '@/lib/notifications';
import { useSettings } from '@/stores/settings';

/** Explains why before triggering the OS permission prompt (first launch). */
export function NotificationPrimer() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const seen = useSettings((s) => s.notificationPrimerSeen);
  const set = useSettings((s) => s.set);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (seen) return;
    let cancelled = false;
    void getPermission().then((p) => {
      if (!cancelled && p === 'undetermined')
        setTimeout(() => !cancelled && setVisible(true), 2500);
      else if (p !== 'undetermined') set({ notificationPrimerSeen: true });
    });
    return () => {
      cancelled = true;
    };
  }, [seen, set]);

  const close = () => {
    set({ notificationPrimerSeen: true });
    setVisible(false);
  };

  return (
    <BottomSheet
      visible={visible}
      onClose={close}
      closeLabel={t('common.close')}
      testID="notification-primer"
    >
      <View className="items-center gap-3 pb-2">
        <View className="rounded-pill bg-primary/15 h-16 w-16 items-center justify-center">
          <BellRing size={30} color={colors.primary} />
        </View>
        <Text variant="h2" align="center">
          {t('notifications.primerTitle')}
        </Text>
        <Text tone="muted" align="center">
          {t('notifications.primerBody')}
        </Text>
        <Button
          label={t('notifications.primerAllow')}
          fullWidth
          onPress={async () => {
            await requestAndRegister();
            close();
          }}
        />
        <Button label={t('notifications.primerLater')} variant="ghost" fullWidth onPress={close} />
      </View>
    </BottomSheet>
  );
}
