import { Minus, Plus } from 'lucide-react-native';
import { useCallback, useState } from 'react';
import { Pressable, View, type LayoutChangeEvent } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-reanimated';

import { cn, focusRing } from '../cn';
import { haptics } from '../haptics';
import { useTheme } from '../theme';
import { IconButton } from './IconButton';
import { Text } from './Text';

export interface SliderProps {
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (value: number) => void;
  ticks?: number[];
  formatTick?: (value: number) => string;
  accessibilityLabel: string;
  decrementLabel: string;
  incrementLabel: string;
  /** Highlight the track in the loss color above this value. */
  dangerAbove?: number;
}

/**
 * Cross-platform slider (gesture-handler) with tappable ticks and +/-
 * buttons, so it is fully keyboard operable on web.
 */
export function Slider({
  value,
  min,
  max,
  step = 1,
  onChange,
  ticks = [],
  formatTick = (v) => String(v),
  accessibilityLabel,
  decrementLabel,
  incrementLabel,
  dangerAbove,
}: SliderProps) {
  const { colors } = useTheme();
  const [width, setWidth] = useState(0);
  const clamp = useCallback(
    (v: number) => Math.min(max, Math.max(min, Math.round(v / step) * step)),
    [max, min, step],
  );
  const set = useCallback(
    (v: number) => {
      const next = clamp(v);
      if (next !== value) {
        haptics.light();
        onChange(next);
      }
    },
    [clamp, onChange, value],
  );
  const fromX = useCallback(
    (x: number) =>
      width > 0 ? min + (Math.max(0, Math.min(width, x)) / width) * (max - min) : value,
    [max, min, value, width],
  );

  const pan = Gesture.Pan()
    .minDistance(0)
    .onBegin((e) => {
      runOnJS(set)(fromX(e.x));
    })
    .onUpdate((e) => {
      runOnJS(set)(fromX(e.x));
    });

  const pct = max > min ? (value - min) / (max - min) : 0;
  const danger = dangerAbove !== undefined && value > dangerAbove;
  const accent = danger ? colors.loss : colors.primary;

  return (
    <View className="gap-3">
      <View className="flex-row items-center gap-2">
        <IconButton
          accessibilityLabel={decrementLabel}
          icon={<Minus size={18} color={colors.text} />}
          variant="surface"
          onPress={() => set(value - step)}
        />
        <GestureDetector gesture={pan}>
          <View
            className="h-11 flex-1 justify-center"
            onLayout={(e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width)}
            accessible
            accessibilityRole="adjustable"
            accessibilityLabel={accessibilityLabel}
            accessibilityValue={{ min, max, now: value, text: formatTick(value) }}
            accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
            onAccessibilityAction={(e) =>
              set(e.nativeEvent.actionName === 'increment' ? value + step : value - step)
            }
          >
            <View className="rounded-pill bg-surface-2 h-1.5 w-full">
              <View
                style={{ width: `${pct * 100}%`, backgroundColor: accent }}
                className="rounded-pill h-1.5"
              />
            </View>
            <View
              pointerEvents="none"
              style={{ left: `${pct * 100}%`, marginLeft: -12, borderColor: accent }}
              className="rounded-pill bg-surface absolute h-6 w-6 border-4"
            />
          </View>
        </GestureDetector>
        <IconButton
          accessibilityLabel={incrementLabel}
          icon={<Plus size={18} color={colors.text} />}
          variant="surface"
          onPress={() => set(value + step)}
        />
      </View>
      {ticks.length ? (
        <View className="flex-row justify-between gap-1">
          {ticks.map((t) => (
            <Pressable
              key={t}
              testID={`tick-${t}`}
              accessibilityRole="button"
              accessibilityLabel={formatTick(t)}
              accessibilityState={{ selected: value === t }}
              onPress={() => set(t)}
              className={cn(
                'rounded-pill min-h-[36px] flex-1 items-center justify-center',
                value === t ? 'bg-surface-2' : '',
                focusRing,
              )}
            >
              <Text
                variant="small"
                numeric
                weight="medium"
                tone={value === t ? (t > (dangerAbove ?? Infinity) ? 'loss' : 'default') : 'muted'}
              >
                {formatTick(t)}
              </Text>
            </Pressable>
          ))}
        </View>
      ) : null}
    </View>
  );
}
