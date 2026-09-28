import { INTERESTS, type Interest } from '@hopium/core';
import { Chip, useToast } from '@hopium/ui';
import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { OnboardingFrame } from '@/components/OnboardingFrame';
import { useMe } from '@/hooks/queries';
import { useServices } from '@/hooks/useServices';
import { errorMessage } from '@/lib/errors';

const EMOJI: Record<Interest, string> = {
  memecoins: '🐸',
  blue_chip: '💎',
  stock_tokens: '📈',
  perps: '⚡',
  ai_tokens: '🤖',
  defi: '🏦',
};

export default function InterestsStep() {
  const { t } = useTranslation();
  const toast = useToast();
  const { backend } = useServices();
  const me = useMe();
  const [selected, setSelected] = useState<Interest[]>(me.data?.interests ?? []);
  const [busy, setBusy] = useState(false);
  const toggle = (i: Interest) =>
    setSelected((s) => (s.includes(i) ? s.filter((x) => x !== i) : [...s, i]));
  return (
    <OnboardingFrame
      step={3}
      title={t('onboarding.interests.title')}
      body={t('onboarding.interests.body')}
      cta={t('common.continue')}
      nextDisabled={selected.length === 0}
      loading={busy}
      onNext={async () => {
        setBusy(true);
        try {
          await backend.updateProfile({ interests: selected });
          router.push('/onboarding/region-age');
        } catch (err) {
          toast.show(errorMessage(t, err), 'error');
        } finally {
          setBusy(false);
        }
      }}
    >
      <View className="flex-row flex-wrap gap-2">
        {INTERESTS.map((i) => (
          <Chip
            key={i}
            testID={`interest-${i}`}
            label={`${EMOJI[i]}  ${t(`onboarding.interests.${i}`)}`}
            selected={selected.includes(i)}
            onPress={() => toggle(i)}
          />
        ))}
      </View>
    </OnboardingFrame>
  );
}
