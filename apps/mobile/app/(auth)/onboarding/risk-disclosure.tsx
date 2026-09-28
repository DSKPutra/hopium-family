import { Checkbox, Text, useToast } from '@hopium/ui';
import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { OnboardingFrame } from '@/components/OnboardingFrame';
import { useServices } from '@/hooks/useServices';
import { errorMessage } from '@/lib/errors';

const SECTIONS = ['p1', 'p2', 'p3', 'p4', 'p5', 'p6'] as const;

export default function RiskStep() {
  const { t } = useTranslation();
  const toast = useToast();
  const { backend } = useServices();
  const [reachedEnd, setReachedEnd] = useState(false);
  const [checked, setChecked] = useState(false);
  const [busy, setBusy] = useState(false);
  return (
    <OnboardingFrame
      step={5}
      title={t('onboarding.risk.title')}
      body={t('onboarding.risk.body')}
      cta={t('common.continue')}
      ctaTestID="risk-continue"
      nextDisabled={!reachedEnd || !checked}
      loading={busy}
      onScroll={(e) => {
        const { layoutMeasurement, contentOffset, contentSize } = e.nativeEvent;
        if (layoutMeasurement.height + contentOffset.y >= contentSize.height - 40)
          setReachedEnd(true);
      }}
      onNext={async () => {
        setBusy(true);
        try {
          await backend.updateProfile({ riskAccepted: true });
          router.push('/onboarding/follow-suggestions');
        } catch (err) {
          toast.show(errorMessage(t, err), 'error');
        } finally {
          setBusy(false);
        }
      }}
    >
      {SECTIONS.map((s) => (
        <View key={s} className="border-border bg-surface gap-1 rounded-md border p-4">
          <Text weight="semibold">{t(`onboarding.risk.${s}Title`)}</Text>
          <Text tone="muted">{t(`onboarding.risk.${s}`)}</Text>
        </View>
      ))}
      <Text
        variant="small"
        tone="primary"
        onPress={() => router.push({ pathname: '/legal/[doc]', params: { doc: 'risk' } })}
      >
        {t('onboarding.risk.readFull')}
      </Text>
      <View onLayout={() => undefined}>
        {!reachedEnd ? (
          <Text variant="small" tone="muted">
            {t('onboarding.risk.scrollHint')}
          </Text>
        ) : null}
        <Checkbox
          testID="risk-checkbox"
          label={t('onboarding.risk.checkbox')}
          checked={checked}
          onChange={(v) => {
            setChecked(v);
            setReachedEnd(true);
          }}
          disabled={!reachedEnd}
        />
      </View>
    </OnboardingFrame>
  );
}
