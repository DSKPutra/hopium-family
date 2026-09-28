import {
  CHAIN_META,
  CHAINS,
  gt,
  isValidAddress,
  isValidDecimal,
  withdrawSchema,
  type Chain,
} from '@hopium/core';
import {
  BottomSheet,
  Button,
  Card,
  Chip,
  IconButton,
  Input,
  RiskBanner,
  Screen,
  Text,
  haptics,
  useTheme,
  useToast,
} from '@hopium/ui';
import { useMutation, useQuery } from '@tanstack/react-query';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Clipboard from 'expo-clipboard';
import { router } from 'expo-router';
import { ArrowLeft, ClipboardPaste, ScanLine } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Platform, View } from 'react-native';

import { FeatureGate } from '@/components/FeatureGate';
import { Seo } from '@/components/Seo';
import { usePortfolio } from '@/hooks/queries';
import { useServices } from '@/hooks/useServices';
import { authenticate } from '@/lib/biometrics';
import { errorMessage } from '@/lib/errors';
import { useFormat } from '@/lib/format';
import { useSettings } from '@/stores/settings';

export default function Withdraw() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const toast = useToast();
  const f = useFormat();
  const { backend } = useServices();
  const portfolio = usePortfolio();
  const biometric = useSettings((s) => s.biometricForTrades);
  const [assetId, setAssetId] = useState('usdc');
  const [chain, setChain] = useState<Chain>('solana');
  const [address, setAddress] = useState('');
  const [amount, setAmount] = useState('');
  const [review, setReview] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [permission, requestPermission] = useCameraPermissions();
  const fee = useQuery({
    queryKey: ['withdrawFee', chain],
    queryFn: () => backend.getWithdrawFee(chain),
  });

  const holdings = portfolio.data?.holdings ?? [];
  const options = [
    { id: 'usdc', symbol: 'USDC', qty: portfolio.data?.cashUsd ?? '0' },
    ...holdings.map((h) => ({ id: h.asset.id, symbol: h.asset.symbol, qty: h.qty })),
  ];
  const selected = options.find((o) => o.id === assetId) ?? options[0];
  const parsed = withdrawSchema.safeParse({ assetId, chain, address, amount });
  const addressError =
    address && !isValidAddress(chain, address) ? t('validation.address.invalid') : null;
  const tooMuch = selected && isValidDecimal(amount) && gt(amount, selected.qty);

  const send = useMutation({
    mutationFn: async () => {
      if (biometric && !(await authenticate(t('order.biometricPrompt'))))
        throw new Error('cancelled');
      return backend.withdraw({ assetId, chain, address: address.trim(), amount });
    },
    onSuccess: () => {
      haptics.success();
      toast.show(t('wallet.withdrawSuccess'), 'success');
      setReview(false);
      router.replace('/wallet/history');
    },
    onError: (err) => {
      if (err instanceof Error && err.message === 'cancelled') return;
      toast.show(errorMessage(t, err), 'error');
    },
  });

  return (
    <Screen
      footer={
        <Button
          testID="withdraw-review"
          label={t('wallet.review')}
          size="lg"
          fullWidth
          disabled={!parsed.success || !!tooMuch}
          onPress={() => setReview(true)}
        />
      }
    >
      <Seo title={`${t('wallet.withdrawTitle')} · hopium.family`} path="/wallet/withdraw" />
      <View className="flex-row items-center gap-2 py-2">
        <IconButton
          accessibilityLabel={t('common.back')}
          icon={<ArrowLeft size={22} color={colors.text} />}
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/wallet'))}
        />
        <Text variant="h2">{t('wallet.withdrawTitle')}</Text>
      </View>
      <FeatureGate feature="withdraw">
        <View className="gap-4">
          <View className="gap-2">
            <Text variant="small" weight="semibold" tone="muted">
              {t('wallet.asset')}
            </Text>
            <View className="flex-row flex-wrap gap-2">
              {options.map((o) => (
                <Chip
                  key={o.id}
                  label={o.symbol}
                  selected={assetId === o.id}
                  onPress={() => setAssetId(o.id)}
                />
              ))}
            </View>
          </View>
          <View className="gap-2">
            <Text variant="small" weight="semibold" tone="muted">
              {t('wallet.network')}
            </Text>
            <View className="flex-row flex-wrap gap-2">
              {CHAINS.map((c) => (
                <Chip
                  key={c}
                  label={CHAIN_META[c].name}
                  selected={chain === c}
                  onPress={() => setChain(c)}
                />
              ))}
            </View>
          </View>
          <Input
            testID="withdraw-address"
            label={t('wallet.toAddress')}
            placeholder={t('wallet.addressPlaceholder')}
            value={address}
            onChangeText={setAddress}
            autoCapitalize="none"
            autoCorrect={false}
            error={addressError}
            right={
              <View className="flex-row">
                <IconButton
                  accessibilityLabel={t('wallet.paste')}
                  icon={<ClipboardPaste size={18} color={colors.textMuted} />}
                  onPress={async () => setAddress((await Clipboard.getStringAsync()).trim())}
                />
                {Platform.OS !== 'web' ? (
                  <IconButton
                    accessibilityLabel={t('wallet.scan')}
                    icon={<ScanLine size={18} color={colors.textMuted} />}
                    onPress={async () => {
                      if (!permission?.granted) await requestPermission();
                      setScanning(true);
                    }}
                  />
                ) : null}
              </View>
            }
          />
          <Input
            testID="withdraw-amount"
            label={t('wallet.amountLabel')}
            value={amount}
            onChangeText={(v) => setAmount(v.replace(',', '.').replace(/[^0-9.]/g, ''))}
            inputMode="decimal"
            keyboardType="decimal-pad"
            numeric
            helper={
              selected
                ? t('order.available', { amount: `${f.qty(selected.qty)} ${selected.symbol}` })
                : null
            }
            error={tooMuch ? t('order.insufficient') : null}
            right={
              selected ? (
                <Button
                  label={t('common.max')}
                  size="sm"
                  variant="ghost"
                  onPress={() => setAmount(selected.qty)}
                />
              ) : null
            }
          />
          <Card className="flex-row justify-between">
            <Text variant="small" tone="muted">
              {t('wallet.networkFee')}
            </Text>
            <Text variant="small" numeric>
              {fee.data ? f.usd(fee.data, { decimals: 2 }) : '—'}
            </Text>
          </Card>
          <RiskBanner tone="warning" message={t('wallet.withdrawWarning')} />
        </View>
      </FeatureGate>

      <BottomSheet
        visible={review}
        onClose={() => setReview(false)}
        title={t('wallet.reviewTitle')}
        closeLabel={t('common.close')}
      >
        <View className="gap-3">
          {[
            [t('wallet.asset'), selected?.symbol ?? ''],
            [t('wallet.network'), CHAIN_META[chain].name],
            [t('wallet.toAddress'), address],
            [t('wallet.amountLabel'), `${amount} ${selected?.symbol ?? ''}`],
            [t('wallet.networkFee'), fee.data ? f.usd(fee.data, { decimals: 2 }) : '—'],
          ].map(([k, v]) => (
            <View key={k} className="gap-0.5">
              <Text variant="small" tone="muted">
                {k}
              </Text>
              <Text numeric weight="medium" selectable>
                {v}
              </Text>
            </View>
          ))}
          <RiskBanner
            tone="danger"
            message={t('wallet.addressWarning', { chain: CHAIN_META[chain].name })}
          />
          <Button
            testID="withdraw-confirm"
            label={t('wallet.confirmWithdraw')}
            variant="danger"
            size="lg"
            loading={send.isPending}
            onPress={() => send.mutate()}
          />
        </View>
      </BottomSheet>

      <BottomSheet
        visible={scanning}
        onClose={() => setScanning(false)}
        title={t('wallet.scanTitle')}
        closeLabel={t('common.close')}
      >
        {permission?.granted ? (
          <View className="h-[320px] overflow-hidden rounded-lg">
            <CameraView
              style={{ flex: 1 }}
              barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
              onBarcodeScanned={({ data }) => {
                setAddress(data.replace(/^(solana:|ethereum:)/, '').split('?')[0] ?? data);
                setScanning(false);
              }}
            />
          </View>
        ) : (
          <View className="gap-3">
            <Text tone="muted">{t('wallet.cameraPermission')}</Text>
            <Button label={t('wallet.grantCamera')} onPress={() => void requestPermission()} />
          </View>
        )}
      </BottomSheet>
    </Screen>
  );
}
