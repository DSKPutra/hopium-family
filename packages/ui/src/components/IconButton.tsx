import type { ReactNode } from 'react';
import { Pressable, View, type PressableProps } from 'react-native';

import { cn, focusRing } from '../cn';
import { Text } from './Text';

export interface IconButtonProps extends Omit<PressableProps, 'children' | 'style'> {
  icon: ReactNode;
  accessibilityLabel: string;
  variant?: 'ghost' | 'surface' | 'primary';
  /** Unread/count badge. */
  badge?: number;
  className?: string;
}

export function IconButton({
  icon,
  accessibilityLabel,
  variant = 'ghost',
  badge,
  className,
  ...rest
}: IconButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      hitSlop={4}
      className={cn(
        'rounded-pill h-11 w-11 items-center justify-center active:opacity-70',
        variant === 'surface' && 'border-border bg-surface border',
        variant === 'primary' && 'bg-primary',
        focusRing,
        className,
      )}
      {...rest}
    >
      {icon}
      {badge ? (
        <View className="rounded-pill bg-loss absolute right-0.5 top-0.5 min-w-[18px] items-center px-1">
          <Text variant="micro" weight="semibold" style={{ color: '#FFFFFF' }}>
            {badge > 99 ? '99+' : String(badge)}
          </Text>
        </View>
      ) : null}
    </Pressable>
  );
}
