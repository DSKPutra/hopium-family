import { LinearGradient } from 'expo-linear-gradient';
import type { ReactNode } from 'react';
import { ActivityIndicator, Pressable, View, type PressableProps } from 'react-native';

import { cn, focusRing } from '../cn';
import { useTheme } from '../theme';
import { hopeGradient } from '../tokens';
import { Text } from './Text';

export type ButtonVariant =
  'primary' | 'secondary' | 'ghost' | 'danger' | 'gradient' | 'gain' | 'outline';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends Omit<PressableProps, 'children' | 'style'> {
  label: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  icon?: ReactNode;
  iconRight?: ReactNode;
  fullWidth?: boolean;
  className?: string;
  testID?: string;
}

const container: Record<ButtonVariant, string> = {
  primary: 'bg-primary',
  gain: 'bg-gain',
  secondary: 'bg-surface-2 border border-border',
  outline: 'border border-border bg-transparent',
  ghost: 'bg-transparent',
  danger: 'border border-loss bg-transparent',
  gradient: 'overflow-hidden',
};

const textTone = {
  primary: 'onPrimary',
  gain: 'onPrimary',
  secondary: 'default',
  outline: 'default',
  ghost: 'primary',
  danger: 'loss',
  gradient: 'onPrimary',
} as const;

const heights: Record<ButtonSize, string> = {
  sm: 'min-h-[44px] px-4',
  md: 'min-h-[48px] px-5',
  lg: 'min-h-[56px] px-6',
};

export function Button({
  label,
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled,
  icon,
  iconRight,
  fullWidth = false,
  className,
  accessibilityLabel,
  ...rest
}: ButtonProps) {
  const { colors } = useTheme();
  const isDisabled = disabled || loading;
  const spinnerColor =
    variant === 'danger'
      ? colors.loss
      : variant === 'ghost'
        ? colors.primary
        : textTone[variant] === 'onPrimary'
          ? colors.onPrimary
          : colors.text;
  const content = (
    <View className="flex-row items-center justify-center gap-2">
      {loading ? <ActivityIndicator size="small" color={spinnerColor} /> : icon}
      <Text
        variant={size === 'sm' ? 'small' : 'body'}
        weight="semibold"
        tone={textTone[variant]}
        numberOfLines={1}
      >
        {label}
      </Text>
      {!loading && iconRight}
    </View>
  );
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: !!isDisabled, busy: loading }}
      disabled={isDisabled}
      className={cn(
        'rounded-pill items-center justify-center',
        heights[size],
        container[variant],
        fullWidth && 'w-full self-stretch',
        isDisabled && 'opacity-50',
        'active:opacity-80',
        focusRing,
        className,
      )}
      {...rest}
    >
      {variant === 'gradient' ? (
        <LinearGradient
          colors={[...hopeGradient.colors]}
          start={hopeGradient.start}
          end={hopeGradient.end}
          style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
        />
      ) : null}
      {content}
    </Pressable>
  );
}
