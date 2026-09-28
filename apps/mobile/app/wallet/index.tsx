import {
  Card,
  EmptyState,
  IconButton,
  PnLBadge,
  Screen,
  SkeletonList,
  Text,
  useTheme,
  AssetLogo,
} from '@hopium/ui';
import { router, type Href } from 'expo-router';
import {
  ArrowDownToLine,
  ArrowLeft,
  ArrowUpFromLine,
  Eye,
  EyeOff,
  History,
  QrCode,
} from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

import { Seo } from '@/components/Seo';
import { usePortfolio } from '@/hooks/queries';
import { useFormat } from '@/lib/format';
import { useSettings } from '@/stores/settings';

function Donut({
  parts,
  size = 132,
}: {
  parts: { value: number; color: string }[];
  size?: number;
}) {
  const r = size / 2 - 10;
  const c = 2 * Math.PI * r;
  const total = parts.reduce((a, p) => a + p.value, 0) || 1;
  const offsets = parts.map((_, i) =>
    parts.slice(0, i).reduce((a, p) => a + (p.value / total) * c, 0),
  );
  return (
    <View
      accessibilityElementsHidden
      style={{ width: size, height: size, transform: [{ rotate: '-90deg' }] }}
    >
      <Svg width={size} height={size}>
        {parts.map((p, i) => {
          const len = (p.value / total) * c;
          return (
            <Circle
              key={i}
              cx={size / 2}
              cy={size / 2}
              r={r}
              stroke={p.color}
              strokeWidth={14}
              fill="none"
              strokeDasharray={`${len} ${c - len}`}
              strokeDashoffset={-(offsets[i] ?? 0)}
            />
          );
        })}
      </Svg>
    </View>
  );
}

function Action({
  label,
  icon,
  href,
  testID,
}: {
  label: string;
  icon: React.ReactNode;
  href: Href;
  testID: string;
}) {
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={() => router.push(href)}
      className="border-border bg-surface min-h-[72px] flex-1 items-center justify-center gap-1.5 rounded-lg border active:opacity-70"
    >
      {icon}
      <Text variant="small" weight="semibold">
        {label}
      </Text>
    </Pressable>
  );
}

export default function Wallet() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const f = useFormat();
  const hide = useSettings((s) => s.hideBalances);
  const set = useSettings((s) => s.set);
  const q = usePortfolio();
  const p = q.data;
  // Chart geometry only (not money math).
  const parts = p
    ? [
        { key: 'crypto', value: Number(p.cryptoUsd), color: colors.primary },
        { key: 'stockTokens', value: Number(p.stockTokensUsd), color: colors.secondary },
        { key: 'perpsMargin', value: Number(p.perpsMarginUsd), color: colors.accent },
        { key: 'cash', value: Number(p.cashUsd), color: colors.textMuted },
      ]
    : [];
  const amounts: Record<string, string> = p
    ? {
        crypto: p.cryptoUsd,
        stockTokens: p.stockTokensUsd,
        perpsMargin: p.perpsMarginUsd,
        cash: p.cashUsd,
      }
    : {};
  return (
    <Screen onRefresh={() => void q.refetch()} refreshing={q.isRefetching}>
      <Seo title={`${t('wallet.title')} · hopium.family`} path="/wallet" />
      <View className="flex-row items-center gap-2 py-2">
        <IconButton
          accessibilityLabel={t('common.back')}
          icon={<ArrowLeft size={22} color={colors.text} />}
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
        />
        <Text variant="h2">{t('wallet.title')}</Text>
      </View>
      {q.isLoading || !p ? (
        <SkeletonList count={4} variant="card" />
      ) : (
        <View className="gap-4">
          <Card className="gap-4">
            <View className="flex-row items-center justify-between">
              <Text variant="small" tone="muted">
                {t('wallet.total')}
              </Text>
              <IconButton
                testID="toggle-hide"
                accessibilityLabel={hide ? t('wallet.show') : t('wallet.hide')}
                icon={
                  hide ? (
                    <EyeOff size={20} color={colors.textMuted} />
                  ) : (
                    <Eye size={20} color={colors.textMuted} />
                  )
                }
                onPress={() => set({ hideBalances: !hide })}
              />
            </View>
            <Text testID="wallet-total" variant="display" numeric>
              {hide ? f.hidden : f.money(p.totalUsd)}
            </Text>
            <View
              className="flex-row items-center gap-4"
              accessibilityLabel={t('wallet.breakdown')}
            >
              <Donut parts={parts} />
              <View className="flex-1 gap-2">
                {parts.map((part) => (
                  <View key={part.key} className="flex-row items-center gap-2">
                    <View
                      style={{ backgroundColor: part.color }}
                      className="rounded-pill h-2.5 w-2.5"
                    />
                    <Text variant="small" className="flex-1">
                      {t(`wallet.${part.key}` as never)}
                    </Text>
                    <Text variant="small" numeric weight="medium">
                      {hide ? f.hidden : f.money(amounts[part.key] ?? '0')}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          </Card>
          <View className="flex-row gap-3">
            <Action
              testID="wallet-deposit"
              label={t('wallet.deposit')}
              icon={<ArrowDownToLine size={22} color={colors.primary} />}
              href="/wallet/deposit"
            />
            <Action
              testID="wallet-withdraw"
              label={t('wallet.withdraw')}
              icon={<ArrowUpFromLine size={22} color={colors.text} />}
              href="/wallet/withdraw"
            />
            <Action
              testID="wallet-receive"
              label={t('wallet.receive')}
              icon={<QrCode size={22} color={colors.text} />}
              href="/wallet/receive"
            />
            <Action
              testID="wallet-history"
              label={t('wallet.history')}
              icon={<History size={22} color={colors.text} />}
              href="/wallet/history"
            />
          </View>
          <Text variant="h3" className="mt-2">
            {t('wallet.holdings')}
          </Text>
          {p.holdings.length ? (
            <Card padded={false} className="px-4">
              {p.holdings.map((h) => (
                <Pressable
                  key={h.asset.id}
                  accessibilityRole="button"
                  onPress={() =>
                    router.push({ pathname: '/asset/[symbol]', params: { symbol: h.asset.symbol } })
                  }
                  className="min-h-[64px] flex-row items-center gap-3 py-2"
                >
                  <AssetLogo
                    symbol={h.asset.symbol}
                    size={36}
                    shape={h.asset.class === 'stock_token' ? 'squircle' : 'circle'}
                  />
                  <View className="flex-1">
                    <Text weight="semibold">{h.asset.symbol}</Text>
                    <Text variant="small" tone="muted" numeric>
                      {hide ? f.hidden : `${f.qty(h.qty)} ${h.asset.symbol}`}
                    </Text>
                  </View>
                  <View className="items-end gap-0.5">
                    <Text numeric weight="semibold">
                      {hide ? f.hidden : f.money(h.valueUsd)}
                    </Text>
                    <PnLBadge pct={h.unrealizedPnlPct} locale={f.locale} />
                  </View>
                </Pressable>
              ))}
            </Card>
          ) : (
            <EmptyState title={t('wallet.noHoldings')} />
          )}
        </View>
      )}
    </Screen>
  );
}
