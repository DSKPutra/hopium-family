import type { Candle } from '@hopium/core';

export interface PriceLine {
  price: string;
  color: string;
  label: string;
}

export interface PriceChartProps {
  candles: Candle[];
  color: string;
  height?: number;
  lines?: PriceLine[];
  accessibilityLabel: string;
  formatPrice: (value: string) => string;
  locale: string;
}
