import { abs, gte, lte, pctChange } from '@hopium/core/money';

export function alertTriggered(condition: 'above' | 'below' | 'pct_change', value: string, basePrice: string, price: string): boolean {
  if (condition === 'above') return gte(price, value);
  if (condition === 'below') return lte(price, value);
  return gte(abs(pctChange(basePrice, price)), value);
}
