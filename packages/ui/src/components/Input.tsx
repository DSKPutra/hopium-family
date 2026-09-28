import { forwardRef, useState, type ReactNode } from 'react';
import { TextInput, View, type TextInputProps } from 'react-native';

import { cn } from '../cn';
import { useTheme } from '../theme';
import { fontFamily } from '../tokens';
import { Text } from './Text';

export interface InputProps extends TextInputProps {
  label?: string;
  error?: string | null;
  helper?: string | null;
  left?: ReactNode;
  right?: ReactNode;
  className?: string;
  numeric?: boolean;
}

export const Input = forwardRef<TextInput, InputProps>(function Input(
  { label, error, helper, left, right, className, numeric, onFocus, onBlur, style, ...rest },
  ref,
) {
  const { colors } = useTheme();
  const [focused, setFocused] = useState(false);
  return (
    <View className={cn('gap-1.5', className)}>
      {label ? (
        <Text
          variant="small"
          weight="medium"
          tone="muted"
          nativeID={rest.nativeID ? `${rest.nativeID}-label` : undefined}
        >
          {label}
        </Text>
      ) : null}
      <View
        className={cn(
          'bg-surface min-h-[48px] flex-row items-center gap-2 rounded-md border px-3',
          error ? 'border-loss' : focused ? 'border-primary' : 'border-border',
        )}
      >
        {left}
        <TextInput
          ref={ref}
          accessibilityLabel={rest.accessibilityLabel ?? label}
          placeholderTextColor={colors.textMuted}
          selectionColor={colors.primary}
          onFocus={(e) => {
            setFocused(true);
            onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            onBlur?.(e);
          }}
          className="text-text web:outline-none flex-1 py-3"
          style={[
            {
              fontFamily: numeric ? fontFamily.headingMedium : fontFamily.body,
              fontSize: 15,
              ...(numeric ? { fontVariant: ['tabular-nums'] } : null),
            },
            style,
          ]}
          {...rest}
        />
        {right}
      </View>
      {error ? (
        <Text
          variant="small"
          tone="loss"
          accessibilityLiveRegion="polite"
          accessibilityRole="alert"
        >
          {error}
        </Text>
      ) : helper ? (
        <Text variant="small" tone="muted">
          {helper}
        </Text>
      ) : null}
    </View>
  );
});
