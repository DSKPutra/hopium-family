import { isAdult } from '@hopium/core';
import { Button, Chip, EmptyState, Input, Text, useTheme, useToast } from '@hopium/ui';
import { getLocales } from 'expo-localization';
import { router } from 'expo-router';
import { ShieldX } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { OnboardingFrame } from '@/components/OnboardingFrame';
import { useMe } from '@/hooks/queries';
import { useServices } from '@/hooks/useServices';
import { COUNTRIES, countryName } from '@/lib/countries';
import { errorMessage } from '@/lib/errors';

export default function RegionAgeStep() {
  const { t, i18n } = useTranslation();
  const { colors } = useTheme();
  const toast = useToast();
  const { backend } = useServices();
  const me = useMe();
  const localeCountry = getLocales()[0]?.regionCode ?? 'ID';
  const [country, setCountry] = useState(
    me.data?.countryCode ?? (COUNTRIES.includes(localeCountry) ? localeCountry : 'ID'),
  );
  const [query, setQuery] = useState('');
  const [year, setYear] = useState(me.data?.birthYear ? String(me.data.birthYear) : '');
  const [underage, setUnderage] = useState(false);
  const [busy, setBusy] = useState(false);
  const yearNum = Number(year);
  const validYear = /^\d{4}$/.test(year) && yearNum >= 1900 && yearNum <= new Date().getFullYear();

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return COUNTRIES.filter(
      (c) =>
        !q ||
        c.toLowerCase().includes(q) ||
        countryName(c, i18n.language).toLowerCase().includes(q),
    ).slice(0, q ? 30 : 12);
  }, [query, i18n.language]);

  if (underage) {
    return (
      <SafeAreaView className="bg-bg flex-1 items-center justify-center px-6">
        <EmptyState
          icon={<ShieldX size={36} color={colors.loss} />}
          title={t('onboarding.region.underageTitle')}
          body={t('onboarding.region.underageBody')}
        />
        <Button
          label={t('onboarding.region.fixYear')}
          variant="secondary"
          onPress={() => setUnderage(false)}
        />
      </SafeAreaView>
    );
  }

  return (
    <OnboardingFrame
      step={4}
      title={t('onboarding.region.title')}
      body={t('onboarding.region.body')}
      cta={t('common.continue')}
      nextDisabled={!validYear || !country}
      loading={busy}
      onNext={async () => {
        if (!isAdult(yearNum)) {
          setUnderage(true);
          return;
        }
        setBusy(true);
        try {
          await backend.updateProfile({ countryCode: country, birthYear: yearNum });
          router.push('/onboarding/risk-disclosure');
        } catch (err) {
          toast.show(errorMessage(t, err), 'error');
        } finally {
          setBusy(false);
        }
      }}
    >
      <Text variant="small" weight="medium" tone="muted">
        {t('onboarding.region.country')}:{' '}
        <Text variant="small" weight="semibold">
          {countryName(country, i18n.language)}
        </Text>
      </Text>
      <Input
        label={t('onboarding.region.searchCountry')}
        value={query}
        onChangeText={setQuery}
        autoCorrect={false}
      />
      <View className="flex-row flex-wrap gap-2">
        {filtered.map((c) => (
          <Chip
            key={c}
            label={countryName(c, i18n.language)}
            selected={c === country}
            onPress={() => setCountry(c)}
          />
        ))}
      </View>
      <Input
        testID="birth-year-input"
        label={t('onboarding.region.birthYear')}
        placeholder={t('onboarding.region.birthYearPlaceholder')}
        value={year}
        onChangeText={(v) => setYear(v.replace(/\D/g, '').slice(0, 4))}
        keyboardType="number-pad"
        inputMode="numeric"
        numeric
        error={year.length === 4 && !validYear ? t('validation.birthYear.invalid') : null}
      />
    </OnboardingFrame>
  );
}
