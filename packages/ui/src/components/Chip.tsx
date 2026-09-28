import type { ReactNode } from 'react';
import { Pressable } from 'react-native';

import { cn, focusRing } from '../cn';
import { Text } from './Text';

export interface ChipProps {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  icon?: ReactNode;
  className?: string;
  testID?: string;
}

export function Chip({ label, selected = false, onPress, icon, className, testID }: ChipProps) {
  return (
    <Pressable
      testID={testID}
      accessibilityRole={onPress ? 'button' : 'text'}
      accessibilityState={{ selected }}
      onPress={onPress}
      disabled={!onPress}
      className={cn(
        'rounded-pill min-h-[36px] flex-row items-center gap-1.5 border px-3.5 py-2',
        selected ? 'border-primary bg-primary/15' : 'border-border bg-surface',
        onPress && 'active:opacity-70',
        focusRing,
        className,
      )}
      hitSlop={4}
    >
      {icon}
      <Text variant="small" weight="medium" tone={selected ? 'primary' : 'default'}>
        {label}
      </Text>
    </Pressable>
  );
}
