import { Delete } from 'lucide-react-native';
import { Pressable, View } from 'react-native';

import { cn, focusRing } from '../cn';
import { haptics } from '../haptics';
import { useTheme } from '../theme';
import { Text } from './Text';

export interface NumericKeypadProps {
  value: string;
  onChange: (value: string) => void;
  maxDecimals?: number;
  deleteLabel: string;
  decimalSeparator?: string;
}

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', 'del'] as const;

/** Applies a keypad press to a decimal string (exported for tests). */
export function applyKey(value: string, key: string, maxDecimals = 8): string {
  if (key === 'del') return value.length <= 1 ? '' : value.slice(0, -1);
  if (key === '.') return value.includes('.') ? value : value === '' ? '0.' : `${value}.`;
  const [, decimals] = value.split('.');
  if (decimals !== undefined && decimals.length >= maxDecimals) return value;
  if (value === '0') return key;
  if (value.replace('.', '').length >= 14) return value;
  return value + key;
}

export function NumericKeypad({
  value,
  onChange,
  maxDecimals = 8,
  deleteLabel,
  decimalSeparator = '.',
}: NumericKeypadProps) {
  const { colors } = useTheme();
  return (
    <View className="flex-row flex-wrap">
      {KEYS.map((key) => (
        <Pressable
          key={key}
          testID={`key-${key}`}
          accessibilityRole="button"
          accessibilityLabel={key === 'del' ? deleteLabel : key === '.' ? decimalSeparator : key}
          onPress={() => {
            haptics.light();
            onChange(applyKey(value, key, maxDecimals));
          }}
          className={cn(
            'active:bg-surface-2 h-14 w-1/3 items-center justify-center rounded-md',
            focusRing,
          )}
        >
          {key === 'del' ? (
            <Delete size={22} color={colors.text} />
          ) : (
            <Text variant="h2" numeric weight="medium">
              {key === '.' ? decimalSeparator : key}
            </Text>
          )}
        </Pressable>
      ))}
    </View>
  );
}
