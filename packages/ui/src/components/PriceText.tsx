import { cmp, direction, formatPct, type Decimal } from '@hopium/core';
import { useEffect, useRef } from 'react';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { useTheme } from '../theme';
import { motion, type TypeVariant } from '../tokens';
import { Text, type TextTone, type TextWeight } from './Text';

export interface PriceTextProps {
  /** Raw decimal used to detect up/down ticks. */
  value: Decimal;
  /** Formatted display string. */
  formatted: string;
  variant?: TypeVariant;
  weight?: TextWeight;
  tone?: TextTone;
  className?: string;
  testID?: string;
}

/** Price with a 400 ms green/red background flash on every tick. */
export function PriceText({
  value,
  formatted,
  variant = 'body',
  weight = 'medium',
  tone = 'default',
  className,
  testID,
}: PriceTextProps) {
  const { colors } = useTheme();
  const prev = useRef(value);
  const flash = useSharedValue(0);
  const dir = useSharedValue(0);

  useEffect(() => {
    if (prev.current !== value) {
      let d = 0;
      try {
        d = cmp(value, prev.current);
      } catch {
        d = 0;
      }
      prev.current = value;
      if (d !== 0) {
        dir.value = d;
        flash.value = withSequence(
          withTiming(1, { duration: 60 }),
          withTiming(0, { duration: motion.tickFlashMs }),
        );
      }
    }
  }, [value, dir, flash]);

  const gain = colors.gain;
  const loss = colors.loss;
  const style = useAnimatedStyle(() => ({
    backgroundColor:
      dir.value > 0
        ? `${gain}${Math.round(flash.value * 0x40)
            .toString(16)
            .padStart(2, '0')}`
        : `${loss}${Math.round(flash.value * 0x40)
            .toString(16)
            .padStart(2, '0')}`,
    borderRadius: 6,
  }));

  return (
    <Animated.View style={[{ alignSelf: 'flex-start', paddingHorizontal: 2 }, style]}>
      <Text
        testID={testID}
        variant={variant}
        weight={weight}
        tone={tone}
        numeric
        className={className}
      >
        {formatted}
      </Text>
    </Animated.View>
  );
}

export interface ChangeTextProps {
  pct: Decimal;
  variant?: TypeVariant;
  locale?: string;
  weight?: TextWeight;
}

/** 24h change with ▲/▼ and sign so direction never relies on color alone. */
export function ChangeText({ pct, variant = 'small', locale, weight = 'medium' }: ChangeTextProps) {
  const d = direction(pct);
  return (
    <Text
      variant={variant}
      numeric
      weight={weight}
      tone={d > 0 ? 'gain' : d < 0 ? 'loss' : 'muted'}
    >
      {formatPct(pct, { arrow: true, locale })}
    </Text>
  );
}
