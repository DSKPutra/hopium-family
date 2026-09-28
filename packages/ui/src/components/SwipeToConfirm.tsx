import { ChevronsRight } from 'lucide-react-native';
import { useState } from 'react';
import { Platform, View, type LayoutChangeEvent } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';

import { cn } from '../cn';
import { haptics } from '../haptics';
import { useTheme } from '../theme';
import { motion } from '../tokens';
import { Button } from './Button';
import { Text } from './Text';

export interface SwipeToConfirmProps {
  label: string;
  onConfirm: () => void;
  disabled?: boolean;
  loading?: boolean;
  tone?: 'gain' | 'loss';
  testID?: string;
}

const THUMB = 52;

/** "Swipe to buy" slider on native; a regular button on web. */
export function SwipeToConfirm({
  label,
  onConfirm,
  disabled,
  loading,
  tone = 'gain',
  testID,
}: SwipeToConfirmProps) {
  const { colors } = useTheme();
  const [width, setWidth] = useState(0);
  const x = useSharedValue(0);
  const max = Math.max(0, width - THUMB - 8);

  const pan = Gesture.Pan()
    .enabled(!disabled && !loading)
    .onUpdate((e) => {
      x.value = Math.max(0, Math.min(max, e.translationX));
    })
    .onEnd(() => {
      if (x.value > max * 0.85) {
        x.value = withSpring(max, motion.spring);
        runOnJS(haptics.success)();
        runOnJS(onConfirm)();
      } else {
        x.value = withSpring(0, motion.spring);
      }
    });

  const thumbStyle = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }));
  const fillStyle = useAnimatedStyle(() => ({ width: x.value + THUMB + 4 }));

  if (Platform.OS === 'web') {
    return (
      <Button
        testID={testID}
        label={label}
        onPress={onConfirm}
        disabled={disabled}
        loading={loading}
        variant={tone === 'gain' ? 'gain' : 'danger'}
        size="lg"
        fullWidth
      />
    );
  }

  const bg = tone === 'gain' ? colors.gain : colors.loss;
  return (
    <View
      testID={testID}
      accessible
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled, busy: !!loading }}
      accessibilityActions={[{ name: 'activate' }]}
      onAccessibilityAction={() => !disabled && onConfirm()}
      onLayout={(e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width)}
      className={cn(
        'rounded-pill border-border bg-surface-2 h-[60px] justify-center overflow-hidden border',
        disabled && 'opacity-50',
      )}
    >
      <Animated.View
        style={[
          {
            position: 'absolute',
            left: 0,
            top: 0,
            bottom: 0,
            backgroundColor: `${bg}33`,
            borderRadius: 999,
          },
          fillStyle,
        ]}
      />
      <Text weight="semibold" align="center">
        {label}
      </Text>
      <GestureDetector gesture={pan}>
        <Animated.View
          style={[
            {
              position: 'absolute',
              left: 4,
              width: THUMB,
              height: THUMB,
              borderRadius: THUMB / 2,
              backgroundColor: bg,
              alignItems: 'center',
              justifyContent: 'center',
            },
            thumbStyle,
          ]}
        >
          <ChevronsRight size={26} color={colors.onPrimary} />
        </Animated.View>
      </GestureDetector>
    </View>
  );
}
