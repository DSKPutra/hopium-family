import { CHAIN_META, CHAINS, type Chain } from '@hopium/core';
import {
  Chip,
  CopyableText,
  IconButton,
  QRCode,
  RiskBanner,
  Screen,
  Skeleton,
  Text,
  useTheme,
} from '@hopium/ui';
import { router } from 'expo-router';
import { ArrowLeft } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { Seo } from '@/components/Seo';
import { useAddresses } from '@/hooks/queries';

export default function Receive() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const [chain, setChain] = useState<Chain>('solana');
  const addresses = useAddresses();
  const address = addresses.data?.[chain];
  const name = CHAIN_META[chain].name;
  return (
    <Screen>
      <Seo title={`${t('wallet.receiveTitle')} · hopium.family`} path="/wallet/receive" />
      <View className="flex-row items-center gap-2 py-2">
        <IconButton
          accessibilityLabel={t('common.back')}
          icon={<ArrowLeft size={22} color={colors.text} />}
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/wallet'))}
        />
        <Text variant="h2">{t('wallet.receiveTitle')}</Text>
      </View>
      <Text variant="small" weight="semibold" tone="muted" className="mt-2">
        {t('wallet.network')}
      </Text>
      <View className="mt-2 flex-row flex-wrap gap-2">
        {CHAINS.map((c) => (
          <Chip
            key={c}
            testID={`chain-${c}`}
            label={CHAIN_META[c].name}
            selected={chain === c}
            onPress={() => setChain(c)}
          />
        ))}
      </View>
      <View className="mt-6 items-center gap-4">
        {address ? (
          <QRCode value={address} size={200} label={t('wallet.qrLabel')} />
        ) : (
          <Skeleton width={232} height={232} />
        )}
        <Text weight="semibold">{t('wallet.yourAddress', { chain: name })}</Text>
        {address ? (
          <CopyableText
            value={address}
            copyLabel={t('common.copyToClipboard')}
            copiedLabel={t('common.copied')}
            className="w-full"
          />
        ) : null}
        <RiskBanner
          tone="danger"
          message={t('wallet.addressWarning', { chain: name })}
          className="w-full"
        />
      </View>
    </Screen>
  );
}
