import { emailSchema } from '@hopium/core';
import { Button, IconButton, Input, Text, useTheme, useToast } from '@hopium/ui';
import { router } from 'expo-router';
import { ArrowLeft } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { KeyboardAvoidingView, Platform, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Seo } from '@/components/Seo';
import { useServices } from '@/hooks/useServices';
import { errorMessage, validationMessage } from '@/lib/errors';
import { useUi } from '@/stores/ui';

export default function SignIn() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const toast = useToast();
  const { backend } = useServices();
  const setPendingEmail = useUi((s) => s.setPendingEmail);
  const [email, setEmail] = useState('');
  const [touched, setTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const parsed = emailSchema.safeParse(email);
  const error =
    touched && !parsed.success ? validationMessage(t, parsed.error.issues[0]?.message) : null;

  const submit = async () => {
    setTouched(true);
    if (!parsed.success) return;
    setBusy(true);
    try {
      await backend.startEmailSignIn(parsed.data);
      setPendingEmail(parsed.data);
      router.push('/verify-otp');
    } catch (err) {
      toast.show(errorMessage(t, err), 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView className="bg-bg flex-1">
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        className="w-full max-w-[520px] flex-1 self-center px-4"
      >
        <IconButton
          accessibilityLabel={t('common.back')}
          icon={<ArrowLeft size={22} color={colors.text} />}
          onPress={() => router.back()}
        />
        <View className="mt-6 flex-1 gap-4">
          <Seo title={`${t('auth.signIn.title')} · hopium.family`} path="/sign-in" />
          <Text variant="h1">{t('auth.signIn.title')}</Text>
          <Text tone="muted">{t('auth.signIn.body')}</Text>
          <Input
            testID="email-input"
            label={t('auth.signIn.emailLabel')}
            placeholder={t('auth.signIn.emailPlaceholder')}
            value={email}
            onChangeText={setEmail}
            onBlur={() => setTouched(true)}
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            inputMode="email"
            textContentType="emailAddress"
            returnKeyType="send"
            onSubmitEditing={() => void submit()}
            error={error}
            autoFocus
          />
        </View>
        <Button
          testID="send-code"
          label={t('auth.signIn.sendCode')}
          size="lg"
          fullWidth
          loading={busy}
          disabled={!email}
          onPress={() => void submit()}
          className="mb-4"
        />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
