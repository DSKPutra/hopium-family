import type { Tier } from '@hopium/core';
import { View } from 'react-native';

import { cn } from '../cn';
import { Text } from './Text';

const tierStyle: Record<Tier, { className: string; emoji: string }> = {
  rookie: { className: 'border-border bg-surface-2', emoji: '🌱' },
  believer: { className: 'border-primary/40 bg-primary/10', emoji: '✨' },
  degen: { className: 'border-secondary/50 bg-secondary/15', emoji: '🔥' },
  whale: { className: 'border-secondary bg-secondary/20', emoji: '🐋' },
  legend: { className: 'border-accent bg-accent/15', emoji: '👑' },
};

export function TierBadge({
  tier,
  label,
  compact = false,
}: {
  tier: Tier;
  label: string;
  compact?: boolean;
}) {
  const s = tierStyle[tier];
  return (
    <View
      accessible
      accessibilityLabel={label}
      className={cn(
        'rounded-pill flex-row items-center gap-1 self-start border px-2 py-0.5',
        s.className,
      )}
    >
      <Text variant="micro">{s.emoji}</Text>
      {compact ? null : (
        <Text variant="micro" weight="semibold">
          {label}
        </Text>
      )}
    </View>
  );
}
