import { Check } from 'lucide-react-native';
import { Pressable, View } from 'react-native';

import { cn, focusRing } from '../cn';
import { useTheme } from '../theme';
import { Text } from './Text';

export interface CheckboxProps {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  tone?: 'default' | 'danger';
  className?: string;
  testID?: string;
}

export function Checkbox({
  label,
  checked,
  onChange,
  disabled,
  tone = 'default',
  className,
  testID,
}: CheckboxProps) {
  const { colors } = useTheme();
  return (
    <Pressable
      testID={testID}
      accessibilityRole="checkbox"
      accessibilityState={{ checked, disabled }}
      accessibilityLabel={label}
      disabled={disabled}
      onPress={() => onChange(!checked)}
      className={cn(
        'min-h-[44px] flex-row items-center gap-3 py-2',
        disabled && 'opacity-50',
        focusRing,
        className,
      )}
    >
      <View
        className={cn(
          'h-6 w-6 items-center justify-center rounded-sm border-2',
          checked
            ? tone === 'danger'
              ? 'border-loss bg-loss'
              : 'border-primary bg-primary'
            : 'border-border',
        )}
      >
        {checked ? (
          <Check
            size={16}
            color={tone === 'danger' ? '#FFFFFF' : colors.onPrimary}
            strokeWidth={3}
          />
        ) : null}
      </View>
      <Text className="flex-1">{label}</Text>
    </Pressable>
  );
}
