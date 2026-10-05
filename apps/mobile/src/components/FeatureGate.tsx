import type { Feature } from '@hopium/core';
import { Button, EmptyState, Skeleton, useTheme } from '@hopium/ui';
import { router } from 'expo-router';
import { Globe2, ShieldCheck } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { useKycStatus, useRegionRule } from '@/hooks/queries';

export type FeatureAccess = 'loading' | 'allowed' | 'region_blocked' | 'kyc_required';

/** Region rule + KYC status for a feature, for screens that adapt chrome around the gate. */
export function useFeatureAccess(feature: Feature): FeatureAccess {
  const region = useRegionRule();
  const kyc = useKycStatus();
  if (region.isLoading || kyc.isLoading) return 'loading';
  const rule = region.data;
  const allowed =
    !rule ||
    (feature === 'stock_tokens'
      ? rule.allowStockTokens
      : feature === 'perps'
        ? rule.allowPerps
        : feature === 'copy_trade'
          ? rule.allowCopyTrade
          : true);
  if (!allowed) return 'region_blocked';
  if (rule?.requiresKycFor.includes(feature) && kyc.data !== 'approved') return 'kyc_required';
  return 'allowed';
}

/**
 * Region feature flags + KYC gate: shows an explanatory screen instead of
 * crashing or silently failing.
 */
export function FeatureGate({ feature, children }: { feature: Feature; children: ReactNode }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const access = useFeatureAccess(feature);
  if (access === 'loading') return <Skeleton height={200} />;
  if (access === 'region_blocked') {
    return (
      <EmptyState
        icon={<Globe2 size={36} color={colors.warning} />}
        title={t('region.blockedTitle')}
        body={t(`region.${feature}`)}
      />
    );
  }
  if (access === 'kyc_required') {
    return (
      <View>
        <EmptyState
          icon={<ShieldCheck size={36} color={colors.secondary} />}
          title={t('kyc.gateTitle')}
          body={t('kyc.gateBody')}
        />
        <Button
          label={t('settings.kycStart')}
          onPress={() => router.push('/settings/kyc')}
          className="self-center"
        />
      </View>
    );
  }
  return <>{children}</>;
}
