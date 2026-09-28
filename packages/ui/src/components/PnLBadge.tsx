import { direction, formatPct, type Decimal } from '@hopium/core';
import { View } from 'react-native';

import { cn } from '../cn';
import { Text } from './Text';

export interface PnLBadgeProps {
  pct: Decimal;
  /** Optional formatted money amount shown before the percentage. */
  amount?: string;
  locale?: string;
  size?: 'sm' | 'md';
}

export function PnLBadge({ pct, amount, locale, size = 'sm' }: PnLBadgeProps) {
  const d = direction(pct);
  return (
    <View
      className={cn(
        'rounded-pill flex-row items-center gap-1 self-start px-2 py-0.5',
        d > 0 ? 'bg-gain/15' : d < 0 ? 'bg-loss/15' : 'bg-surface-2',
      )}
    >
      <Text
        variant={size === 'sm' ? 'micro' : 'small'}
        numeric
        weight="semibold"
        tone={d > 0 ? 'gain' : d < 0 ? 'loss' : 'muted'}
      >
        {amount ? `${amount} · ` : ''}
        {formatPct(pct, { arrow: true, locale })}
      </Text>
    </View>
  );
}
