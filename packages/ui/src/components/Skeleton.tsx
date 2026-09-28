import { useEffect } from 'react';
import { View, type DimensionValue } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { cn } from '../cn';

export interface SkeletonProps {
  width?: DimensionValue;
  height?: number;
  radius?: number;
  className?: string;
}

export function Skeleton({ width = '100%', height = 14, radius = 8, className }: SkeletonProps) {
  const opacity = useSharedValue(0.45);
  useEffect(() => {
    opacity.value = withRepeat(withTiming(0.9, { duration: 800 }), -1, true);
  }, [opacity]);
  const style = useAnimatedStyle(() => ({ opacity: opacity.value }));
  return (
    <Animated.View
      className={cn('bg-surface-2', className)}
      style={[{ width, height, borderRadius: radius }, style]}
    />
  );
}

/** Row skeleton that matches list items (avatar + two lines + trailing value). */
export function SkeletonRow() {
  return (
    <View className="flex-row items-center gap-3 py-3">
      <Skeleton width={40} height={40} radius={20} />
      <View className="flex-1 gap-2">
        <Skeleton width="45%" />
        <Skeleton width="30%" height={12} />
      </View>
      <Skeleton width={64} />
    </View>
  );
}

export function SkeletonCard({ lines = 3 }: { lines?: number }) {
  return (
    <View className="border-border bg-surface gap-3 rounded-lg border p-4">
      <View className="flex-row items-center gap-3">
        <Skeleton width={40} height={40} radius={20} />
        <View className="flex-1 gap-2">
          <Skeleton width="40%" />
          <Skeleton width="25%" height={12} />
        </View>
      </View>
      {Array.from({ length: lines }, (_, i) => (
        <Skeleton key={i} width={i === lines - 1 ? '60%' : '100%'} />
      ))}
    </View>
  );
}

export function SkeletonList({
  count = 6,
  variant = 'row',
}: {
  count?: number;
  variant?: 'row' | 'card';
}) {
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel="loading"
      className={variant === 'card' ? 'gap-3' : ''}
    >
      {Array.from({ length: count }, (_, i) =>
        variant === 'card' ? <SkeletonCard key={i} /> : <SkeletonRow key={i} />,
      )}
    </View>
  );
}
