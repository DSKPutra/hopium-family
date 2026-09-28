import { useTheme } from '@hopium/ui';
import {
  AreaSeries,
  createChart,
  LineStyle,
  type IChartApi,
  type ISeriesApi,
  type UTCTimestamp,
} from 'lightweight-charts';
import { useEffect, useRef } from 'react';
import { View } from 'react-native';

import type { PriceChartProps } from './PriceChart.types';

export type { PriceChartProps, PriceLine } from './PriceChart.types';

/** Web chart: TradingView lightweight-charts area series with crosshair. */
export function PriceChart({
  candles,
  color,
  height = 220,
  lines = [],
  accessibilityLabel,
  formatPrice,
  locale,
}: PriceChartProps) {
  const ref = useRef<View>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<'Area'> | null>(null);
  const { colors } = useTheme();

  useEffect(() => {
    const el = ref.current as unknown as HTMLElement | null;
    if (!el) return;
    const chart = createChart(el, {
      height,
      width: el.clientWidth,
      layout: {
        background: { color: 'transparent' },
        textColor: colors.textMuted,
        fontFamily: 'Inter_400Regular, system-ui, sans-serif',
        attributionLogo: false,
      },
      grid: { vertLines: { visible: false }, horzLines: { color: `${colors.border}66` } },
      rightPriceScale: { borderVisible: false },
      timeScale: { borderVisible: false, timeVisible: true, secondsVisible: false },
      crosshair: {
        vertLine: { color: colors.textMuted, labelBackgroundColor: colors.surface2 },
        horzLine: { color: colors.textMuted, labelBackgroundColor: colors.surface2 },
      },
      localization: { locale, priceFormatter: (p: number) => formatPrice(String(p)) },
      handleScroll: false,
      handleScale: false,
    });
    const series = chart.addSeries(AreaSeries, {
      lineColor: color,
      topColor: `${color}55`,
      bottomColor: `${color}00`,
      lineWidth: 2,
      priceLineVisible: false,
    });
    chartRef.current = chart;
    seriesRef.current = series;
    const ro = new ResizeObserver(() => chart.applyOptions({ width: el.clientWidth }));
    ro.observe(el);
    return () => {
      ro.disconnect();
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
    };
  }, [height, color, colors.textMuted, colors.border, colors.surface2, locale, formatPrice]);

  useEffect(() => {
    const series = seriesRef.current;
    if (!series) return;
    // Chart points are rendering-only values.
    const seen = new Set<number>();
    const data = candles
      .map((c) => ({ time: Math.floor(c.time / 1000) as UTCTimestamp, value: Number(c.close) }))
      .filter((p) => (seen.has(p.time) ? false : (seen.add(p.time), true)));
    series.setData(data);
    const created = lines.map((l) =>
      series.createPriceLine({
        price: Number(l.price),
        color: l.color,
        lineStyle: LineStyle.Dashed,
        lineWidth: 1,
        axisLabelVisible: true,
        title: l.label,
      }),
    );
    chartRef.current?.timeScale().fitContent();
    return () => {
      for (const pl of created) series.removePriceLine(pl);
    };
  }, [candles, lines]);

  return (
    <View
      ref={ref}
      accessible
      accessibilityRole="image"
      accessibilityLabel={accessibilityLabel}
      style={{ height, width: '100%' }}
    />
  );
}
