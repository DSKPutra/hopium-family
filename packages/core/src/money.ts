/**
 * The only module allowed to do arithmetic on money. Every balance, price,
 * size, fee and PnL value crosses boundaries as a decimal string and is
 * computed with decimal.js — never with JavaScript floating point.
 */
import { Decimal as DecimalJs } from 'decimal.js';

import type { Decimal } from './types';

const D = DecimalJs.clone({
  precision: 60,
  rounding: DecimalJs.ROUND_HALF_UP,
  toExpNeg: -40,
  toExpPos: 60,
});
type DInstance = InstanceType<typeof D>;

export type DecimalInput = Decimal | number | DInstance;

export function dec(value: DecimalInput): DInstance {
  if (value instanceof D) return value;
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new Error(`Non-finite number: ${value}`);
    return new D(value.toString());
  }
  const trimmed = value.trim();
  if (trimmed === '') return new D(0);
  return new D(trimmed);
}

/** Canonical decimal string without exponent notation or trailing zeros. */
export function str(value: DecimalInput): Decimal {
  const d = dec(value);
  if (d.isZero()) return '0';
  return d.toFixed();
}

export const isValidDecimal = (value: string): boolean => {
  if (!/^-?(\d+\.?\d*|\.\d+)$/.test(value.trim())) return false;
  try {
    dec(value);
    return true;
  } catch {
    return false;
  }
};

export const add = (a: DecimalInput, b: DecimalInput): Decimal => str(dec(a).plus(dec(b)));
export const sub = (a: DecimalInput, b: DecimalInput): Decimal => str(dec(a).minus(dec(b)));
export const mul = (a: DecimalInput, b: DecimalInput): Decimal => str(dec(a).times(dec(b)));
export function div(a: DecimalInput, b: DecimalInput): Decimal {
  const divisor = dec(b);
  if (divisor.isZero()) throw new Error('Division by zero');
  return str(dec(a).dividedBy(divisor));
}
export const neg = (a: DecimalInput): Decimal => str(dec(a).negated());
export const abs = (a: DecimalInput): Decimal => str(dec(a).abs());

export const cmp = (a: DecimalInput, b: DecimalInput): -1 | 0 | 1 =>
  dec(a).comparedTo(dec(b)) as -1 | 0 | 1;
export const eq = (a: DecimalInput, b: DecimalInput): boolean => dec(a).equals(dec(b));
export const gt = (a: DecimalInput, b: DecimalInput): boolean => dec(a).greaterThan(dec(b));
export const gte = (a: DecimalInput, b: DecimalInput): boolean =>
  dec(a).greaterThanOrEqualTo(dec(b));
export const lt = (a: DecimalInput, b: DecimalInput): boolean => dec(a).lessThan(dec(b));
export const lte = (a: DecimalInput, b: DecimalInput): boolean => dec(a).lessThanOrEqualTo(dec(b));
export const isZero = (a: DecimalInput): boolean => dec(a).isZero();
export const isNeg = (a: DecimalInput): boolean => dec(a).isNegative() && !dec(a).isZero();
export const isPos = (a: DecimalInput): boolean => dec(a).isPositive() && !dec(a).isZero();

export const min = (...values: DecimalInput[]): Decimal => str(D.min(...values.map(dec)));
export const max = (...values: DecimalInput[]): Decimal => str(D.max(...values.map(dec)));
export const sum = (values: DecimalInput[]): Decimal =>
  str(values.reduce<DInstance>((acc, v) => acc.plus(dec(v)), new D(0)));

export type RoundingMode = 'half-up' | 'down' | 'up';
const roundingModes: Record<RoundingMode, DecimalJs.Rounding> = {
  'half-up': DecimalJs.ROUND_HALF_UP,
  down: DecimalJs.ROUND_DOWN,
  up: DecimalJs.ROUND_UP,
};

export const round = (a: DecimalInput, dp: number, mode: RoundingMode = 'half-up'): Decimal =>
  str(dec(a).toDecimalPlaces(dp, roundingModes[mode]));

/** Fixed-dp string, keeping trailing zeros (for display/receipts). */
export const toFixed = (a: DecimalInput, dp: number, mode: RoundingMode = 'half-up'): string =>
  dec(a).toFixed(dp, roundingModes[mode]);

/** (to − from) / from × 100. Returns '0' when `from` is zero. */
export function pctChange(from: DecimalInput, to: DecimalInput): Decimal {
  if (isZero(from)) return '0';
  return str(dec(to).minus(dec(from)).dividedBy(dec(from)).times(100));
}

/** part / whole × 100, '0' when whole is zero. */
export function pctOf(part: DecimalInput, whole: DecimalInput): Decimal {
  if (isZero(whole)) return '0';
  return str(dec(part).dividedBy(dec(whole)).times(100));
}

/**
 * Converts to a JS number for pixel-level rendering only (charts, sparklines,
 * progress bars). Never feed the result back into money math.
 */
export const toChartNumber = (a: DecimalInput): number => dec(a).toNumber();

/** Basis points → fraction string, e.g. 100 → '0.01'. */
export const bpsToFraction = (bps: number): Decimal => div(bps, 10_000);

/** Significant decimals needed to show a price meaningfully (memecoins ≈ 1e-8). */
export function priceDecimals(price: DecimalInput): number {
  const p = dec(price).abs();
  if (p.isZero()) return 2;
  if (p.greaterThanOrEqualTo(10)) return 2;
  if (p.greaterThanOrEqualTo(1)) return 4;
  // e.g. 0.000012345 → leading zeros 4 → show 4 + 4 significant digits
  const leadingZeros = Math.max(0, -Math.floor(Math.log10(p.toNumber())) - 1);
  return Math.min(12, leadingZeros + 4);
}

export type DisplayCurrency = 'USD' | 'IDR';

export interface FormatMoneyOptions {
  locale?: string;
  currency?: DisplayCurrency;
  /** USD → display currency rate (e.g. 16250 for IDR). */
  fxRate?: DecimalInput;
  /** Force a number of fraction digits. */
  decimals?: number;
  /** Adapt decimals for tiny prices. */
  adaptive?: boolean;
  compact?: boolean;
  signed?: boolean;
}

function formatWithIntl(
  value: DInstance,
  locale: string,
  options: Intl.NumberFormatOptions,
): string {
  // Round with decimal.js first; the rounded value has few enough significant
  // digits that Number conversion is exact for display.
  const dp = options.maximumFractionDigits ?? 2;
  const rounded = value.toDecimalPlaces(dp, DecimalJs.ROUND_HALF_UP);
  return new Intl.NumberFormat(locale, options).format(rounded.toNumber());
}

export function formatMoney(value: DecimalInput, opts: FormatMoneyOptions = {}): string {
  const {
    locale = 'en-US',
    currency = 'USD',
    fxRate = '1',
    compact = false,
    signed = false,
  } = opts;
  const converted = dec(value).times(currency === 'USD' ? 1 : dec(fxRate));
  let decimals = opts.decimals;
  if (decimals === undefined) {
    if (currency === 'IDR') decimals = 0;
    else if (opts.adaptive) decimals = priceDecimals(converted);
    else decimals = 2;
  }
  const minimumFractionDigits = currency === 'IDR' ? 0 : Math.min(decimals, 2);
  const formatted = formatWithIntl(converted.abs(), locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: compact ? 0 : minimumFractionDigits,
    maximumFractionDigits: compact ? 2 : decimals,
    notation: compact ? 'compact' : 'standard',
  });
  if (converted.isNegative() && !converted.isZero()) return `−${formatted}`;
  if (signed && !converted.isZero()) return `+${formatted}`;
  return formatted;
}

export interface FormatPctOptions {
  locale?: string;
  decimals?: number;
  /** Prefix ▲ / ▼ so direction never relies on color alone. */
  arrow?: boolean;
  signed?: boolean;
}

/** '12.345' → '+12.35%' (or '▲ +12.35%'). Negative uses a true minus sign. */
export function formatPct(value: DecimalInput, opts: FormatPctOptions = {}): string {
  const { locale = 'en-US', decimals = 2, arrow = false, signed = true } = opts;
  const d = dec(value);
  const rounded = d.toDecimalPlaces(decimals, DecimalJs.ROUND_HALF_UP);
  const body = formatWithIntl(rounded.abs(), locale, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
  const direction = rounded.isZero() ? 0 : rounded.isNegative() ? -1 : 1;
  const sign = direction < 0 ? '−' : direction > 0 && signed ? '+' : '';
  const glyph = arrow ? (direction < 0 ? '▼ ' : direction > 0 ? '▲ ' : '• ') : '';
  return `${glyph}${sign}${body}%`;
}

export function formatQty(
  value: DecimalInput,
  opts: { locale?: string; maxDecimals?: number } = {},
): string {
  const { locale = 'en-US', maxDecimals } = opts;
  const d = dec(value);
  const decimals =
    maxDecimals ??
    (d.abs().greaterThanOrEqualTo(1000) ? 2 : d.abs().greaterThanOrEqualTo(1) ? 4 : 8);
  const s = formatWithIntl(d.abs(), locale, {
    maximumFractionDigits: decimals,
    minimumFractionDigits: 0,
  });
  return d.isNegative() && !d.isZero() ? `−${s}` : s;
}

export function formatCompact(value: DecimalInput, opts: { locale?: string } = {}): string {
  return formatWithIntl(dec(value), opts.locale ?? 'en-US', {
    notation: 'compact',
    maximumFractionDigits: 2,
  });
}

/** Direction of a signed value: 1 up, −1 down, 0 flat. */
export const direction = (value: DecimalInput): -1 | 0 | 1 => {
  const d = dec(value);
  return d.isZero() ? 0 : d.isNegative() ? -1 : 1;
};
