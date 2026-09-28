import { memo, useMemo } from 'react';
import { View } from 'react-native';
import Svg, { Defs, LinearGradient, Path, Stop } from 'react-native-svg';

export interface SparklineProps {
  /** Values for rendering only (pixels, not money math). */
  values: number[];
  width?: number;
  height?: number;
  color: string;
  fill?: boolean;
  strokeWidth?: number;
}

export function sparkPath(values: number[], width: number, height: number): string {
  if (values.length < 2) return '';
  const minV = Math.min(...values);
  const maxV = Math.max(...values);
  const span = maxV - minV || 1;
  return values
    .map((v, i) => {
      const x = (i / (values.length - 1)) * width;
      const y = height - ((v - minV) / span) * (height - 2) - 1;
      return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');
}

export const Sparkline = memo(function Sparkline({
  values,
  width = 72,
  height = 28,
  color,
  fill = false,
  strokeWidth = 1.75,
}: SparklineProps) {
  const d = useMemo(() => sparkPath(values, width, height), [values, width, height]);
  const id = useMemo(() => `spark-${color.replace(/[^a-z0-9]/gi, '')}`, [color]);
  if (!d) return null;
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{ width, height }}
    >
      <Svg width={width} height={height}>
        {fill ? (
          <>
            <Defs>
              <LinearGradient id={id} x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor={color} stopOpacity={0.3} />
                <Stop offset="1" stopColor={color} stopOpacity={0} />
              </LinearGradient>
            </Defs>
            <Path d={`${d} L${width},${height} L0,${height} Z`} fill={`url(#${id})`} />
          </>
        ) : null}
        <Path
          d={d}
          stroke={color}
          strokeWidth={strokeWidth}
          fill="none"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      </Svg>
    </View>
  );
});
