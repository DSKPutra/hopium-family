import type { Language } from '@hopium/core';
import { Card, Screen, Text, useTheme } from '@hopium/ui';
import { Check } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Pressable } from 'react-native';

import { SubHeader } from '@/components/SubHeader';
import { useServices } from '@/hooks/useServices';
import { useSettings } from '@/stores/settings';

export default function LanguageScreen() {
  const { t, i18n } = useTranslation();
  const { colors } = useTheme();
  const { backend } = useServices();
  const set = useSettings((s) => s.set);
  const options: { value: Language; label: string }[] = [
    { value: 'en', label: t('settings.english') },
    { value: 'id', label: t('settings.indonesian') },
  ];
  return (
    <Screen>
      <SubHeader title={t('settings.language')} />
      <Card padded={false} className="px-4">
        {options.map((o) => {
          const active = i18n.language === o.value;
          return (
            <Pressable
              key={o.value}
              testID={`language-${o.value}`}
              accessibilityRole="radio"
              accessibilityState={{ checked: active }}
              onPress={() => {
                set({ language: o.value });
                void i18n.changeLanguage(o.value);
                void backend.updateProfile({ language: o.value }).catch(() => undefined);
              }}
              className="min-h-[56px] flex-row items-center justify-between py-3"
            >
              <Text weight={active ? 'semibold' : 'medium'}>{o.label}</Text>
              {active ? <Check size={20} color={colors.primary} /> : null}
            </Pressable>
          );
        })}
      </Card>
    </Screen>
  );
}
