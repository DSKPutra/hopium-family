import type { Fiat, OnrampQuote, PaymentMethod } from '@hopium/core';
import { gt, isValidDecimal } from '@hopium/core';
import {
  AmountInput,
  Button,
  Card,
  Chip,
  IconButton,
  RiskBanner,
  Screen,
  SegmentedControl,
  Skeleton,
  Text,
  haptics,
  useTheme,
  useToast,
} from '@hopium/ui';
import { useMutation, useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { ArrowLeft, CheckCircle2, CreditCard } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Platform, Pressable, View } from 'react-native';

import { Seo } from '@/components/Seo';
import { useServices } from '@/hooks/useServices';
import { isDemo } from '@/lib/env';
import { errorMessage } from '@/lib/errors';
import { useFormat } from '@/lib/format';

function defaultMethod(): PaymentMethod {
  if (Platform.OS === 'ios') return 'apple_pay';
  if (Platform.OS === 'android') return 'google_pay';
  if (typeof navigator !== 'undefined') {
    const ua = navigator.userAgent;
    if (/Safari/.test(ua) && !/Chrome/.test(ua)) return 'apple_pay';
    if (/Chrome/.test(ua)) return 'google_pay';
  }
  return 'card';
}

export default function Deposit() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const toast = useToast();
  const f = useFormat();
  const { backend } = useServices();
  const [fiat, setFiat] = useState<Fiat>('USD');
  const [amount, setAmount] = useState('100');
  const [method, setMethod] = useState<PaymentMethod>(defaultMethod());
  const [done, setDone] = useState<string | null>(null);
  const valid = isValidDecimal(amount) && gt(amount, 0);

  const quote = useQuery({
    queryKey: ['onramp', fiat, amount],
    queryFn: () => backend.getOnrampQuote({ fiat, fiatAmount: amount }),
    enabled: valid,
    staleTime: 30_000,
  });
  const pay = useMutation({
    mutationFn: (q: OnrampQuote) => backend.deposit(q, method),
    onSuccess: (res) => {
      if (res.status === 'completed' || res.status === 'pending') {
        haptics.success();
        setDone(res.cryptoAmount);
      }
    },
    onError: (err) => toast.show(errorMessage(t, err), 'error'),
  });

  const methods: { value: PaymentMethod; label: string; show: boolean }[] = [
    { value: 'apple_pay', label: t('wallet.applePay'), show: Platform.OS !== 'android' },
    { value: 'google_pay', label: t('wallet.googlePay'), show: Platform.OS !== 'ios' },
    { value: 'card', label: t('wallet.card'), show: true },
  ];

  if (done) {
    return (
      <Screen>
        <View className="items-center gap-4 py-16" testID="deposit-success">
          <CheckCircle2 size={64} color={colors.gain} />
          <Text variant="h1" align="center">
            {t('wallet.depositSuccess')}
          </Text>
          <Text tone="muted" align="center">
            {t('wallet.depositSuccessBody', { amount: f.qty(done, 2) })}
          </Text>
          <Button label={t('common.done')} onPress={() => router.replace('/wallet')} />
        </View>
      </Screen>
    );
  }

  return (
    <Screen
      footer={
        <Button
          testID="deposit-pay"
          label={pay.isPending ? t('wallet.processing') : t('wallet.continueToPay')}
          size="lg"
          fullWidth
          disabled={!quote.data || !gt(quote.data.cryptoAmount, 0)}
          loading={pay.isPending}
          onPress={() => quote.data && pay.mutate(quote.data)}
        />
      }
    >
      <Seo title={`${t('wallet.depositTitle')} · hopium.family`} path="/wallet/deposit" />
      <View className="flex-row items-center gap-2 py-2">
        <IconButton
          accessibilityLabel={t('common.back')}
          icon={<ArrowLeft size={22} color={colors.text} />}
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/wallet'))}
        />
        <Text variant="h2">{t('wallet.depositTitle')}</Text>
      </View>
      {isDemo ? <RiskBanner tone="info" message={t('wallet.demoProvider')} /> : null}
      <SegmentedControl
        className="mt-4"
        segments={[
          { value: 'USD', label: 'USD' },
          { value: 'IDR', label: 'IDR' },
        ]}
        value={fiat}
        onChange={(v) => {
          setFiat(v);
          setAmount(v === 'IDR' ? '1500000' : '100');
        }}
        accessibilityLabel={t('wallet.fiat')}
      />
      <AmountInput
        testID="deposit-amount"
        value={amount}
        onChange={setAmount}
        unitLabel={fiat === 'USD' ? '$' : 'Rp'}
        deleteLabel={t('common.deleteKey')}
        accessibilityLabel={t('wallet.amountLabel')}
        maxDecimals={fiat === 'USD' ? 2 : 0}
        keypad={false}
      />
      <View className="flex-row flex-wrap justify-center gap-2">
        {(fiat === 'USD' ? ['50', '100', '250', '500'] : ['500000', '1500000', '5000000']).map(
          (v) => (
            <Chip
              key={v}
              label={fiat === 'USD' ? `$${v}` : `Rp${Number(v).toLocaleString(f.locale)}`}
              selected={amount === v}
              onPress={() => setAmount(v)}
            />
          ),
        )}
      </View>
      <Text variant="small" weight="semibold" tone="muted" className="mt-5">
        {t('wallet.payWith')}
      </Text>
      <View className="mt-2 gap-2">
        {methods
          .filter((m) => m.show)
          .map((m) => (
            <Pressable
              key={m.value}
              accessibilityRole="radio"
              accessibilityState={{ checked: method === m.value }}
              onPress={() => setMethod(m.value)}
              className={`min-h-[52px] flex-row items-center gap-3 rounded-md border px-4 ${method === m.value ? 'border-primary bg-primary/10' : 'border-border bg-surface'}`}
            >
              <CreditCard
                size={20}
                color={method === m.value ? colors.primary : colors.textMuted}
              />
              <Text weight="medium">{m.label}</Text>
            </Pressable>
          ))}
      </View>
      <Card className="mt-4 gap-2">
        {quote.isFetching && !quote.data ? (
          <Skeleton height={60} />
        ) : quote.data ? (
          <>
            <Text weight="semibold" testID="deposit-quote">
              {t('wallet.quote', { amount: f.qty(quote.data.cryptoAmount, 2) })}
            </Text>
            <View className="flex-row justify-between">
              <Text variant="small" tone="muted">
                {t('wallet.providerFee')}
              </Text>
              <Text variant="small" numeric>
                {fiat === 'USD'
                  ? f.usd(quote.data.feeFiat)
                  : `Rp${Number(quote.data.feeFiat).toLocaleString(f.locale)}`}
              </Text>
            </View>
            {fiat === 'IDR' ? (
              <View className="flex-row justify-between">
                <Text variant="small" tone="muted">
                  {t('wallet.rate')}
                </Text>
                <Text variant="small" numeric>
                  1 USDC ≈ Rp{Number(quote.data.rate).toLocaleString(f.locale)}
                </Text>
              </View>
            ) : null}
          </>
        ) : quote.error ? (
          <Text tone="loss">{errorMessage(t, quote.error)}</Text>
        ) : null}
      </Card>
      <Button
        label={t('wallet.depositCrypto')}
        variant="ghost"
        className="mt-2"
        onPress={() => router.push('/wallet/receive')}
      />
    </Screen>
  );
}
