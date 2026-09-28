import { LinearGradient } from 'expo-linear-gradient';
import type { ReactNode } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';

import { hopeGradient } from '../tokens';

export function GradientView({
  children,
  style,
  opacity = 1,
}: {
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
  opacity?: number;
}) {
  const [a, b] = hopeGradient.colors;
  const alpha = Math.round(opacity * 255)
    .toString(16)
    .padStart(2, '0');
  return (
    <LinearGradient
      colors={[`${a}${alpha}`, `${b}${alpha}`]}
      start={hopeGradient.start}
      end={hopeGradient.end}
      style={style}
    >
      {children}
    </LinearGradient>
  );
}
