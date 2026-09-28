import { Button, IconButton, Text, useTheme, useToast } from '@hopium/ui';
import { router, useLocalSearchParams } from 'expo-router';
import { ArrowLeft } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useServices } from '@/hooks/useServices';
import { isDemo } from '@/lib/env';
import { errorMessage } from '@/lib/errors';

const LENGTH = 6;

export default function VerifyOtp() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const toast = useToast();
  const { backend } = useServices();
  const { email = '' } = useLocalSearchParams<{ email: string }>();
  const [digits, setDigits] = useState<string[]>(Array(LENGTH).fill(''));
  const [busy, setBusy] = useState(false);
  const [cooldown, setCooldown] = useState(30);
  const refs = useRef<(TextInput | null)[]>([]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  const code = digits.join('');

  const verify = async (value = code) => {
    if (value.length !== LENGTH) return;
    setBusy(true);
    try {
      await backend.verifyOtp(email, value);
    } catch (err) {
      toast.show(errorMessage(t, err), 'error');
      setBusy(false);
    }
  };

  const onChange = (index: number, text: string) => {
    const clean = text.replace(/\D/g, '');
    if (clean.length > 1) {
      // Paste support: spread across boxes.
      const next = clean.slice(0, LENGTH).split('');
      const filled = [...next, ...Array(LENGTH).fill('')].slice(0, LENGTH);
      setDigits(filled);
      refs.current[Math.min(next.length, LENGTH - 1)]?.focus();
      if (next.length === LENGTH) void verify(next.join(''));
      return;
    }
    const next = [...digits];
    next[index] = clean;
    setDigits(next);
    if (clean && index < LENGTH - 1) refs.current[index + 1]?.focus();
    if (next.join('').length === LENGTH) void verify(next.join(''));
  };

  return (
    <SafeAreaView className="bg-bg flex-1">
      <View className="w-full max-w-[520px] flex-1 self-center px-4">
        <IconButton
          accessibilityLabel={t('common.back')}
          icon={<ArrowLeft size={22} color={colors.text} />}
          onPress={() => router.back()}
        />
        <View className="mt-6 gap-4">
          <Text variant="h1">{t('auth.otp.title')}</Text>
          <Text tone="muted">{t('auth.otp.body', { email })}</Text>
          {isDemo ? (
            <Text variant="small" tone="warning">
              {t('auth.otp.demoHint')}
            </Text>
          ) : null}
          <View className="mt-2 flex-row justify-between gap-2">
            {digits.map((d, i) => (
              <TextInput
                key={i}
                testID={`otp-${i}`}
                ref={(r) => {
                  refs.current[i] = r;
                }}
                value={d}
                onChangeText={(v) => onChange(i, v)}
                onKeyPress={({ nativeEvent }) => {
                  if (nativeEvent.key === 'Backspace' && !digits[i] && i > 0)
                    refs.current[i - 1]?.focus();
                }}
                keyboardType="number-pad"
                inputMode="numeric"
                textContentType="oneTimeCode"
                autoComplete={i === 0 ? 'one-time-code' : 'off'}
                maxLength={i === 0 ? LENGTH : 1}
                autoFocus={i === 0}
                accessibilityLabel={t('auth.otp.digit', { index: i + 1 })}
                selectionColor={colors.primary}
                className="border-border bg-surface text-text web:outline-none focus:border-primary h-14 flex-1 rounded-md border text-center"
                style={{ fontFamily: 'SpaceGrotesk_700Bold', fontSize: 24, maxWidth: 56 }}
              />
            ))}
          </View>
          <Button
            testID="verify-otp"
            label={t('auth.otp.verify')}
            size="lg"
            fullWidth
            loading={busy}
            disabled={code.length !== LENGTH}
            onPress={() => void verify()}
          />
          <Button
            label={
              cooldown > 0 ? t('auth.otp.resendIn', { seconds: cooldown }) : t('auth.otp.resend')
            }
            variant="ghost"
            disabled={cooldown > 0}
            onPress={async () => {
              await backend.startEmailSignIn(email);
              setCooldown(30);
              toast.show(t('auth.otp.resent'), 'success');
            }}
          />
        </View>
      </View>
    </SafeAreaView>
  );
}
