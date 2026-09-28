import {
  AssetLogo,
  Avatar,
  AvatarStack,
  Button,
  Card,
  ChangeText,
  Checkbox,
  Chip,
  DemoModePill,
  EmptyState,
  ErrorState,
  LogoLockup,
  PnLBadge,
  Podium,
  PriceText,
  ProgressToTarget,
  QRCode,
  RiskBanner,
  Screen,
  SegmentedControl,
  Skeleton,
  Slider,
  Sparkline,
  Switch,
  Text,
  TierBadge,
  useConfetti,
  useTheme,
  useToast,
} from '@hopium/ui';
import { Redirect } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { SubHeader } from '@/components/SubHeader';

/** Hidden component gallery — development builds only. */
export default function ComponentGallery() {
  const { t } = useTranslation();
  const { colors, preference, setPreference } = useTheme();
  const toast = useToast();
  const confetti = useConfetti();
  const [seg, setSeg] = useState<'a' | 'b'>('a');
  const [lev, setLev] = useState(3);
  const [on, setOn] = useState(true);
  if (!__DEV__) return <Redirect href="/" />;
  return (
    <Screen>
      <SubHeader title={t('dev.title')} fallback="/" />
      <View className="gap-4">
        <LogoLockup />
        <View className="flex-row flex-wrap gap-2">
          {(['display', 'h1', 'h2', 'h3', 'body', 'small', 'micro'] as const).map((v) => (
            <Text key={v} variant={v}>
              {v}
            </Text>
          ))}
        </View>
        <View className="flex-row flex-wrap gap-2">
          {(
            ['primary', 'secondary', 'outline', 'ghost', 'danger', 'gradient', 'gain'] as const
          ).map((v) => (
            <Button key={v} label={v} variant={v} size="sm" onPress={() => toast.show(v, 'info')} />
          ))}
          <Button label="loading" loading size="sm" />
          <Button label="confetti" size="sm" onPress={confetti.fire} />
          <Button
            label={preference}
            size="sm"
            variant="outline"
            onPress={() => setPreference(preference === 'dark' ? 'light' : 'dark')}
          />
        </View>
        <Card className="gap-3">
          <SegmentedControl
            segments={[
              { value: 'a', label: 'a' },
              { value: 'b', label: 'b' },
            ]}
            value={seg}
            onChange={setSeg}
          />
          <View className="flex-row flex-wrap gap-2">
            <Chip label="chip" />
            <Chip label="selected" selected onPress={() => undefined} />
            <DemoModePill label={t('common.demoMode')} />
            <TierBadge tier="legend" label={t('tiers.legend')} />
            <TierBadge tier="whale" label={t('tiers.whale')} />
          </View>
          <Slider
            value={lev}
            min={1}
            max={20}
            onChange={setLev}
            ticks={[1, 3, 5, 10, 20]}
            formatTick={(v) => `${v}×`}
            accessibilityLabel="leverage"
            decrementLabel="-"
            incrementLabel="+"
            dangerAbove={10}
          />
          <Switch label="switch" value={on} onValueChange={setOn} />
          <Checkbox label="checkbox" checked={on} onChange={setOn} />
        </Card>
        <Card className="gap-3">
          <View className="flex-row items-center gap-3">
            <AssetLogo symbol="HOPE" />
            <AssetLogo symbol="AAPLx" shape="squircle" />
            <Avatar id="a" name="satoshi sis" />
            <AvatarStack
              people={[
                { id: '1', name: 'a b' },
                { id: '2', name: 'c d' },
                { id: '3', name: 'e f' },
              ]}
              ringColor={colors.surface}
            />
          </View>
          <PriceText value="1.23" formatted="$1.23" variant="h2" />
          <View className="flex-row gap-3">
            <ChangeText pct="4.2" />
            <ChangeText pct="-2.1" />
            <PnLBadge pct="12.5" amount="+$42.00" />
          </View>
          <Sparkline
            values={[1, 3, 2, 5, 4, 6, 5, 8]}
            color={colors.gain}
            width={200}
            height={40}
            fill
          />
          <ProgressToTarget
            progress={0.4}
            leftLabel="$0.9"
            rightLabel="$1.5"
            accessibilityLabel="progress"
          />
          <Skeleton height={20} />
        </Card>
        <RiskBanner tone="warning" message={t('perps.riskBanner')} />
        <RiskBanner tone="danger" message={t('perps.highLeverage')} />
        <Podium
          entries={[1, 2, 3].map((r) => ({
            id: String(r),
            name: `trader ${r}`,
            username: `trader${r}`,
            value: `+${40 - r * 10}%`,
            rank: r,
          }))}
          onPress={() => undefined}
          rankLabel={(r) => `#${r}`}
        />
        <QRCode value="hopium.family" size={120} label="qr" />
        <EmptyState
          title={t('home.emptyFollowingTitle')}
          actionLabel={t('home.discoverTraders')}
          onAction={() => undefined}
        />
        <ErrorState
          title={t('errors.title')}
          message={t('errors.generic')}
          retryLabel={t('common.retry')}
          onRetry={() => undefined}
        />
      </View>
    </Screen>
  );
}
