import { usernameSchema } from '@hopium/core';
import { Input, Text, useTheme, useToast } from '@hopium/ui';
import { router } from 'expo-router';
import { AtSign, CheckCircle2, XCircle } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator } from 'react-native';

import { OnboardingFrame } from '@/components/OnboardingFrame';
import { useMe } from '@/hooks/queries';
import { useServices } from '@/hooks/useServices';
import { errorMessage, validationMessage } from '@/lib/errors';

export default function UsernameStep() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const toast = useToast();
  const { backend } = useServices();
  const me = useMe();
  const [value, setValue] = useState(me.data?.username ?? '');
  const [result, setResult] = useState<{ username: string; available: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  const parsed = usernameSchema.safeParse(value);

  const candidate = parsed.success ? parsed.data : null;
  const status: 'idle' | 'checking' | 'available' | 'taken' = !candidate
    ? 'idle'
    : result?.username !== candidate
      ? 'checking'
      : result.available
        ? 'available'
        : 'taken';

  // Live availability check, debounced 300 ms.
  useEffect(() => {
    if (!candidate) return;
    let cancelled = false;
    const timer = setTimeout(async () => {
      const res = await backend.checkUsername(candidate);
      if (!cancelled) setResult({ username: candidate, available: res.available });
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [candidate, backend]);

  const error =
    value && !parsed.success
      ? validationMessage(t, parsed.error.issues[0]?.message)
      : status === 'taken'
        ? t('onboarding.username.taken', { username: parsed.data })
        : null;

  return (
    <OnboardingFrame
      step={1}
      canGoBack={false}
      title={t('onboarding.username.title')}
      body={t('onboarding.username.body')}
      cta={t('common.continue')}
      nextDisabled={status !== 'available'}
      loading={busy}
      onNext={async () => {
        if (!parsed.success) return;
        setBusy(true);
        try {
          await backend.updateProfile({
            username: parsed.data,
            displayName: me.data?.displayName || parsed.data,
          });
          router.push('/onboarding/profile');
        } catch (err) {
          toast.show(errorMessage(t, err), 'error');
        } finally {
          setBusy(false);
        }
      }}
    >
      <Input
        testID="username-input"
        label={t('onboarding.username.label')}
        value={value}
        onChangeText={(v) => setValue(v.toLowerCase().replace(/\s/g, ''))}
        autoCapitalize="none"
        autoCorrect={false}
        autoFocus
        maxLength={20}
        left={<AtSign size={18} color={colors.textMuted} />}
        right={
          status === 'checking' ? (
            <ActivityIndicator size="small" color={colors.textMuted} />
          ) : status === 'available' ? (
            <CheckCircle2 size={20} color={colors.gain} />
          ) : status === 'taken' ? (
            <XCircle size={20} color={colors.loss} />
          ) : null
        }
        error={error}
        helper={
          status === 'available'
            ? t('onboarding.username.available', { username: parsed.data })
            : t('onboarding.username.rules')
        }
      />
      {status === 'checking' ? (
        <Text variant="small" tone="muted">
          {t('onboarding.username.checking')}
        </Text>
      ) : null}
    </OnboardingFrame>
  );
}
