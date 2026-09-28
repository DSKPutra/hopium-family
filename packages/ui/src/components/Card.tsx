import type { ReactNode } from 'react';
import { Pressable, View, type ViewProps } from 'react-native';

import { cn, focusRing } from '../cn';

export interface CardProps extends ViewProps {
  children: ReactNode;
  className?: string;
  padded?: boolean;
  onPress?: () => void;
  accessibilityLabel?: string;
}

export function Card({
  children,
  className,
  padded = true,
  onPress,
  accessibilityLabel,
  ...rest
}: CardProps) {
  const classes = cn('rounded-lg border border-border bg-surface', padded && 'p-4', className);
  if (onPress) {
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        onPress={onPress}
        className={cn(classes, 'active:opacity-80', focusRing)}
      >
        {children}
      </Pressable>
    );
  }
  return (
    <View className={classes} {...rest}>
      {children}
    </View>
  );
}

export function Divider({ className }: { className?: string }) {
  return <View className={cn('bg-border h-px w-full', className)} />;
}
