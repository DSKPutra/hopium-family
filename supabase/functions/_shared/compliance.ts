import type { SupabaseClient } from '@supabase/supabase-js';
import { AppError } from '@hopium/core/errors';
import type { Feature } from '@hopium/core/types';

/** Enforces region_rules feature flags and KYC requirements. */
export async function assertFeature(
  admin: SupabaseClient,
  userId: string,
  feature: Feature,
): Promise<void> {
  const { data: profile } = await admin
    .from('profiles')
    .select('country_code, kyc_status')
    .eq('id', userId)
    .single();
  const { data: rule } = await admin
    .from('region_rules')
    .select('*')
    .eq('country_code', profile?.country_code ?? 'XX')
    .maybeSingle();
  const allowed =
    !rule ||
    (feature === 'stock_tokens'
      ? rule.allow_stock_tokens
      : feature === 'perps'
        ? rule.allow_perps
        : feature === 'copy_trade'
          ? rule.allow_copy_trade
          : true);
  if (!allowed)
    throw new AppError('region_restricted', 'This feature is not available in your region.', {
      feature,
    });
  const kycFor: string[] = rule?.requires_kyc_for ?? ['withdraw'];
  if (kycFor.includes(feature) && profile?.kyc_status !== 'approved') {
    throw new AppError('kyc_required', 'Identity verification is required for this feature.', {
      feature,
    });
  }
}
