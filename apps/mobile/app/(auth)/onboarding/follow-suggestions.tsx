import { Button, SkeletonList, useConfetti, useToast } from '@hopium/ui';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { OnboardingFrame } from '@/components/OnboardingFrame';
import { TraderCard } from '@/components/TraderCard';
import { useFollowSuggestions } from '@/hooks/queries';
import { useServices } from '@/hooks/useServices';
import { errorMessage } from '@/lib/errors';
import { queryKeys } from '@/lib/queryKeys';

export default function FollowStep() {
  const { t } = useTranslation();
  const toast = useToast();
  const confetti = useConfetti();
  const qc = useQueryClient();
  const { backend } = useServices();
  const suggestions = useFollowSuggestions(10);
  const [busy, setBusy] = useState(false);
  const [followingTop, setFollowingTop] = useState(false);

  const followTop5 = async () => {
    setFollowingTop(true);
    try {
      for (const u of (suggestions.data ?? []).slice(0, 5))
        if (!u.isFollowing) await backend.follow(u.profile.id);
      await qc.invalidateQueries({ queryKey: queryKeys.suggestions });
    } finally {
      setFollowingTop(false);
    }
  };

  return (
    <OnboardingFrame
      step={6}
      title={t('onboarding.follow.title')}
      body={t('onboarding.follow.body')}
      cta={t('onboarding.follow.finish')}
      ctaTestID="onboarding-finish"
      loading={busy}
      onNext={async () => {
        setBusy(true);
        try {
          await backend.completeOnboarding();
          confetti.fire();
          toast.show(t('onboarding.follow.welcome'), 'success');
          await qc.invalidateQueries({ queryKey: queryKeys.me });
        } catch (err) {
          toast.show(errorMessage(t, err), 'error');
          setBusy(false);
        }
      }}
    >
      <Button
        testID="follow-top5"
        label={t('onboarding.follow.followTop5')}
        variant="gradient"
        loading={followingTop}
        onPress={() => void followTop5()}
      />
      {suggestions.isLoading ? (
        <SkeletonList count={5} variant="card" />
      ) : (
        <View className="gap-3">
          {(suggestions.data ?? []).map((u) => (
            <TraderCard key={u.profile.id} user={u} />
          ))}
        </View>
      )}
    </OnboardingFrame>
  );
}
