import { Switch as RNSwitch, View } from 'react-native';

import { cn } from '../cn';
import { useTheme } from '../theme';
import { Text } from './Text';

export interface SwitchProps {
  label: string;
  description?: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
  disabled?: boolean;
  className?: string;
  testID?: string;
}

export function Switch({
  label,
  description,
  value,
  onValueChange,
  disabled,
  className,
  testID,
}: SwitchProps) {
  const { colors } = useTheme();
  return (
    <View className={cn('min-h-[52px] flex-row items-center gap-3 py-2', className)}>
      <View className="flex-1 gap-0.5">
        <Text weight="medium">{label}</Text>
        {description ? (
          <Text variant="small" tone="muted">
            {description}
          </Text>
        ) : null}
      </View>
      <RNSwitch
        testID={testID}
        accessibilityLabel={label}
        accessibilityRole="switch"
        accessibilityState={{ checked: value, disabled }}
        value={value}
        onValueChange={onValueChange}
        disabled={disabled}
        trackColor={{ false: colors.border, true: colors.primary }}
        thumbColor={value ? colors.onPrimary : colors.textMuted}
        {...({ activeThumbColor: colors.onPrimary } as object)}
      />
    </View>
  );
}
