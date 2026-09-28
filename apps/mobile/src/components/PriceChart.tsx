import { useMemo, useState } from 'react';
import { View, type LayoutChangeEvent } from 'react-native';
import { LineChart } from 'react-native-wagmi-charts';

import type { PriceChartProps } from './PriceChart.types';

export type { PriceChartProps, PriceLine } from './PriceChart.types';

/** Native chart: react-native-wagmi-charts line with crosshair and price lines. */
export function PriceChart({
  candles,
  color,
  height = 220,
  lines = [],
  accessibilityLabel,
}: PriceChartProps) {
  const [width, setWidth] = useState(0);
  // Chart points are rendering-only values.
  const data = useMemo(
    () => candles.map((c) => ({ timestamp: c.time, value: Number(c.close) })),
    [candles],
  );
  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={accessibilityLabel}
      onLayout={(e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width)}
      style={{ height }}
    >
      {width > 0 && data.length > 1 ? (
        <LineChart.Provider data={data}>
          <LineChart height={height - 24} width={width}>
            <LineChart.Path color={color} width={2}>
              <LineChart.Gradient color={color} />
              {lines.map((l) => (
                <LineChart.HorizontalLine
                  key={l.label}
                  at={{ value: Number(l.price) }}
                  color={l.color}
                />
              ))}
            </LineChart.Path>
            <LineChart.CursorCrosshair color={color}>
              <LineChart.Tooltip />
            </LineChart.CursorCrosshair>
          </LineChart>
          <LineChart.DatetimeText style={{ color: '#8A86A3', fontSize: 12, textAlign: 'center' }} />
        </LineChart.Provider>
      ) : null}
    </View>
  );
}
