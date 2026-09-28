import { Pressable, ScrollView, View } from 'react-native';

import { cn, focusRing } from '../cn';
import { haptics } from '../haptics';
import { Text } from './Text';

export interface Segment<T extends string> {
  value: T;
  label: string;
}

export interface SegmentedControlProps<T extends string> {
  segments: Segment<T>[];
  value: T;
  onChange: (value: T) => void;
  variant?: 'pill' | 'underline';
  className?: string;
  accessibilityLabel?: string;
  scrollable?: boolean;
}

export function SegmentedControl<T extends string>({
  segments,
  value,
  onChange,
  variant = 'pill',
  className,
  accessibilityLabel,
  scrollable = false,
}: SegmentedControlProps<T>) {
  const items = segments.map((s) => {
    const selected = s.value === value;
    return (
      <Pressable
        key={s.value}
        testID={`segment-${s.value}`}
        accessibilityRole="tab"
        accessibilityState={{ selected }}
        accessibilityLabel={s.label}
        onPress={() => {
          if (!selected) {
            haptics.light();
            onChange(s.value);
          }
        }}
        className={cn(
          'min-h-[40px] items-center justify-center px-3',
          !scrollable && 'flex-1',
          variant === 'pill' && 'rounded-pill',
          variant === 'pill' && selected && 'bg-surface-2',
          variant === 'underline' && 'border-b-2',
          variant === 'underline' && (selected ? 'border-primary' : 'border-transparent'),
          focusRing,
        )}
      >
        <Text
          variant="small"
          weight="semibold"
          tone={selected ? 'default' : 'muted'}
          numberOfLines={1}
        >
          {s.label}
        </Text>
      </Pressable>
    );
  });
  const wrapper = cn(
    'flex-row',
    variant === 'pill'
      ? 'rounded-pill border border-border bg-surface p-1'
      : 'border-b border-border',
    className,
  );
  if (scrollable) {
    return (
      <View className={wrapper} accessibilityRole="tablist" accessibilityLabel={accessibilityLabel}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 4 }}
        >
          {items}
        </ScrollView>
      </View>
    );
  }
  return (
    <View className={wrapper} accessibilityRole="tablist" accessibilityLabel={accessibilityLabel}>
      {items}
    </View>
  );
}
