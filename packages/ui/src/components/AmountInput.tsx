import { ArrowUpDown } from 'lucide-react-native';
import { Platform, Pressable, TextInput, View } from 'react-native';

import { cn, focusRing } from '../cn';
import { useTheme } from '../theme';
import { fontFamily } from '../tokens';
import { NumericKeypad } from './NumericKeypad';
import { Text } from './Text';

export interface AmountInputProps {
  value: string;
  onChange: (value: string) => void;
  /** e.g. "$" or "HOPE" */
  unitLabel: string;
  unitPosition?: 'prefix' | 'suffix';
  secondary?: string;
  onToggleUnit?: () => void;
  toggleLabel?: string;
  deleteLabel: string;
  accessibilityLabel: string;
  maxDecimals?: number;
  /** Render the on-screen keypad (mobile). */
  keypad?: boolean;
  error?: boolean;
  testID?: string;
}

const sanitize = (raw: string, maxDecimals: number): string => {
  const cleaned = raw.replace(',', '.').replace(/[^0-9.]/g, '');
  const [int = '', ...rest] = cleaned.split('.');
  if (!rest.length) return int.replace(/^0+(?=\d)/, '');
  return `${int.replace(/^0+(?=\d)/, '') || '0'}.${rest.join('').slice(0, maxDecimals)}`;
};

/** Large amount entry: text input on web/desktop, numeric keypad on mobile. */
export function AmountInput({
  value,
  onChange,
  unitLabel,
  unitPosition = 'prefix',
  secondary,
  onToggleUnit,
  toggleLabel,
  deleteLabel,
  accessibilityLabel,
  maxDecimals = 8,
  keypad = Platform.OS !== 'web',
  error,
  testID,
}: AmountInputProps) {
  const { colors } = useTheme();
  const display = value === '' ? '0' : value;
  const big = {
    fontFamily: fontFamily.heading,
    fontSize: 40,
    lineHeight: 48,
    fontVariant: ['tabular-nums' as const],
  };
  return (
    <View className="gap-3">
      <View className="items-center gap-1 py-2">
        <View className="flex-row items-center justify-center gap-1">
          {unitPosition === 'prefix' ? (
            <Text variant="display" numeric tone={value ? 'default' : 'muted'}>
              {unitLabel}
            </Text>
          ) : null}
          {keypad ? (
            <Text
              testID={testID}
              variant="display"
              numeric
              tone={value ? (error ? 'loss' : 'default') : 'muted'}
              accessibilityLabel={`${accessibilityLabel}: ${display}`}
            >
              {display}
            </Text>
          ) : (
            <TextInput
              testID={testID}
              value={value}
              onChangeText={(t) => onChange(sanitize(t, maxDecimals))}
              placeholder="0"
              placeholderTextColor={colors.textMuted}
              inputMode="decimal"
              keyboardType="decimal-pad"
              accessibilityLabel={accessibilityLabel}
              className="web:outline-none text-center"
              style={[
                big,
                {
                  color: error ? colors.loss : colors.text,
                  width: Math.min(280, Math.max(1, (value || '0').length) * 25 + 12),
                },
              ]}
            />
          )}
          {unitPosition === 'suffix' ? (
            <Text variant="h2" numeric tone="muted">
              {unitLabel}
            </Text>
          ) : null}
        </View>
        {secondary || onToggleUnit ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={toggleLabel}
            disabled={!onToggleUnit}
            onPress={onToggleUnit}
            className={cn(
              'rounded-pill min-h-[36px] flex-row items-center gap-1.5 px-3',
              onToggleUnit && 'bg-surface-2',
              focusRing,
            )}
          >
            {secondary ? (
              <Text variant="small" tone="muted" numeric>
                {secondary}
              </Text>
            ) : null}
            {onToggleUnit ? <ArrowUpDown size={14} color={colors.textMuted} /> : null}
          </Pressable>
        ) : null}
      </View>
      {keypad ? (
        <NumericKeypad
          value={value}
          onChange={onChange}
          maxDecimals={maxDecimals}
          deleteLabel={deleteLabel}
        />
      ) : null}
    </View>
  );
}
