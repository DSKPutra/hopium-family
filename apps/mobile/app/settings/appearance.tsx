import type { ThemePreference } from '@hopium/core';
import { Card, Screen, SegmentedControl, Text } from '@hopium/ui';
import { useTranslation } from 'react-i18next';

import { SubHeader } from '@/components/SubHeader';
import { useServices } from '@/hooks/useServices';
import { useSettings } from '@/stores/settings';

export default function Appearance() {
  const { t } = useTranslation();
  const { backend } = useServices();
  const theme = useSettings((s) => s.theme);
  const currency = useSettings((s) => s.displayCurrency);
  const set = useSettings((s) => s.set);
  return (
    <Screen>
      <SubHeader title={t('settings.appearance')} />
      <Card className="gap-3">
        <SegmentedControl<ThemePreference>
          segments={[
            { value: 'dark', label: t('settings.themeDark') },
            { value: 'light', label: t('settings.themeLight') },
            { value: 'system', label: t('settings.themeSystem') },
          ]}
          value={theme}
          onChange={(v) => {
            set({ theme: v });
            void backend.updateProfile({ theme: v }).catch(() => undefined);
          }}
        />
        <Text variant="small" weight="semibold" tone="muted" className="mt-2">
          {t('settings.currency')}
        </Text>
        <SegmentedControl
          segments={[
            { value: 'USD', label: 'USD $' },
            { value: 'IDR', label: 'IDR Rp' },
          ]}
          value={currency}
          onChange={(v) => set({ displayCurrency: v })}
        />
      </Card>
    </Screen>
  );
}
