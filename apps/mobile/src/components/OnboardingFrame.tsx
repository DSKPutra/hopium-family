import { Button, IconButton, Text, useTheme } from '@hopium/ui';
import { router } from 'expo-router';
import { ArrowLeft } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export const ONBOARDING_STEPS = 6;

interface Props {
  step: number;
  title: string;
  body?: string;
  children: ReactNode;
  cta: string;
  onNext: () => void;
  nextDisabled?: boolean;
  loading?: boolean;
  onScroll?: (e: NativeSyntheticEvent<NativeScrollEvent>) => void;
  canGoBack?: boolean;
  ctaTestID?: string;
}

export function OnboardingFrame({
  step,
  title,
  body,
  children,
  cta,
  onNext,
  nextDisabled,
  loading,
  onScroll,
  canGoBack = true,
  ctaTestID,
}: Props) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  return (
    <SafeAreaView className="bg-bg flex-1">
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        className="w-full max-w-[560px] flex-1 self-center"
      >
        <View className="flex-row items-center gap-2 px-4 py-2">
          {canGoBack ? (
            <IconButton
              accessibilityLabel={t('common.back')}
              icon={<ArrowLeft size={22} color={colors.text} />}
              onPress={() => router.back()}
            />
          ) : (
            <View className="h-11 w-11" />
          )}
          <View
            className="flex-1 flex-row gap-1"
            accessible
            accessibilityRole="progressbar"
            accessibilityLabel={t('onboarding.step', { current: step, total: ONBOARDING_STEPS })}
            accessibilityValue={{ min: 0, max: ONBOARDING_STEPS, now: step }}
          >
            {Array.from({ length: ONBOARDING_STEPS }, (_, i) => (
              <View
                key={i}
                className={
                  i < step
                    ? 'rounded-pill bg-primary h-1.5 flex-1'
                    : 'rounded-pill bg-surface-2 h-1.5 flex-1'
                }
              />
            ))}
          </View>
          <Text variant="small" tone="muted" numeric className="w-11 text-right">
            {step}/{ONBOARDING_STEPS}
          </Text>
        </View>
        <ScrollView
          className="flex-1"
          contentContainerClassName="gap-4 px-4 pb-6 pt-4"
          keyboardShouldPersistTaps="handled"
          onScroll={onScroll}
          scrollEventThrottle={32}
        >
          <Text variant="h1">{title}</Text>
          {body ? <Text tone="muted">{body}</Text> : null}
          {children}
        </ScrollView>
        <View className="border-border border-t px-4 pb-4 pt-3">
          <Button
            testID={ctaTestID ?? 'onboarding-next'}
            label={cta}
            size="lg"
            fullWidth
            disabled={nextDisabled}
            loading={loading}
            onPress={onNext}
          />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
