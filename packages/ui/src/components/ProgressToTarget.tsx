import { View } from 'react-native';

import { useTheme } from '../theme';
import { Text } from './Text';

export interface ProgressToTargetProps {
  /** −1 (at invalidation) … 0 (entry) … 1 (at target). */
  progress: number;
  leftLabel: string;
  rightLabel: string;
  accessibilityLabel: string;
}

/** Live bar from entry toward target (green) or invalidation (red). */
export function ProgressToTarget({
  progress,
  leftLabel,
  rightLabel,
  accessibilityLabel,
}: ProgressToTargetProps) {
  const { colors } = useTheme();
  const p = Math.max(-1, Math.min(1, progress));
  return (
    <View
      className="gap-1.5"
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={accessibilityLabel}
      accessibilityValue={{ min: -100, max: 100, now: Math.round(p * 100) }}
    >
      <View className="rounded-pill bg-surface-2 h-2 flex-row overflow-hidden">
        <View className="flex-1 flex-row justify-end">
          {p < 0 ? (
            <View
              style={{ width: `${-p * 100}%`, backgroundColor: colors.loss }}
              className="rounded-l-pill h-2"
            />
          ) : null}
        </View>
        <View className="bg-text-muted w-0.5" />
        <View className="flex-1 flex-row">
          {p > 0 ? (
            <View
              style={{ width: `${p * 100}%`, backgroundColor: colors.gain }}
              className="rounded-r-pill h-2"
            />
          ) : null}
        </View>
      </View>
      <View className="flex-row justify-between">
        <Text variant="micro" tone="muted" numeric>
          {leftLabel}
        </Text>
        <Text variant="micro" tone="muted" numeric>
          {rightLabel}
        </Text>
      </View>
    </View>
  );
}
