import {
  abs,
  add,
  bpsToFraction,
  cmp,
  dec,
  direction,
  div,
  eq,
  formatCompact,
  formatMoney,
  formatPct,
  formatQty,
  gt,
  gte,
  isNeg,
  isPos,
  isValidDecimal,
  isZero,
  lt,
  lte,
  max,
  min,
  mul,
  neg,
  pctChange,
  pctOf,
  priceDecimals,
  round,
  str,
  sub,
  sum,
  toChartNumber,
  toFixed,
} from './money';

describe('money arithmetic', () => {
  it('avoids floating point errors', () => {
    expect(add('0.1', '0.2')).toBe('0.3');
    expect(mul('1.1', '1.1')).toBe('1.21');
    expect(sub('0.3', '0.1')).toBe('0.2');
  });

  it('handles 1e-18 precision', () => {
    expect(add('0.000000000000000001', '0.000000000000000001')).toBe('0.000000000000000002');
    expect(mul('0.000000000000000001', '1000000000000000000')).toBe('1');
  });

  it('handles huge numbers without exponent notation', () => {
    const big = '123456789012345678901234567890.123456789012345678';
    expect(add(big, '0.000000000000000001')).toBe(
      '123456789012345678901234567890.123456789012345679',
    );
    expect(str(mul('1000000000000000000000', '1000000000000000000000'))).toBe('1' + '0'.repeat(42));
  });

  it('divides and guards against zero', () => {
    expect(div('10', '4')).toBe('2.5');
    expect(() => div('1', '0')).toThrow('Division by zero');
  });

  it('supports comparisons and predicates', () => {
    expect(cmp('1', '2')).toBe(-1);
    expect(eq('1.0', '1')).toBe(true);
    expect(gt('2', '1') && gte('1', '1') && lt('1', '2') && lte('2', '2')).toBe(true);
    expect(isZero('0.000')).toBe(true);
    expect(isNeg('-0.01') && !isNeg('0') && !isNeg('-0')).toBe(true);
    expect(isPos('0.01') && !isPos('0')).toBe(true);
    expect(neg('5')).toBe('-5');
    expect(abs('-5.5')).toBe('5.5');
    expect(min('3', '1', '2')).toBe('1');
    expect(max('3', '1', '2')).toBe('3');
    expect(sum(['1', '2', '3.5'])).toBe('6.5');
    expect(sum([])).toBe('0');
  });

  it('parses inputs defensively', () => {
    expect(str(dec(''))).toBe('0');
    expect(str(dec(1.5))).toBe('1.5');
    expect(str(dec(dec('2')))).toBe('2');
    expect(() => dec(Number.NaN)).toThrow();
    expect(isValidDecimal('12.5')).toBe(true);
    expect(isValidDecimal('.5')).toBe(true);
    expect(isValidDecimal('1e5')).toBe(false);
    expect(isValidDecimal('abc')).toBe(false);
  });

  it('rounds with explicit modes', () => {
    expect(round('1.005', 2)).toBe('1.01');
    expect(round('1.009', 2, 'down')).toBe('1');
    expect(round('1.001', 2, 'up')).toBe('1.01');
    expect(toFixed('1.5', 3)).toBe('1.500');
    expect(toFixed('1.9999', 2, 'down')).toBe('1.99');
  });

  it('computes percentages', () => {
    expect(pctChange('100', '110')).toBe('10');
    expect(pctChange('100', '90')).toBe('-10');
    expect(pctChange('0', '5')).toBe('0');
    expect(pctOf('25', '200')).toBe('12.5');
    expect(pctOf('1', '0')).toBe('0');
    expect(bpsToFraction(100)).toBe('0.01');
    expect(toChartNumber('1.25')).toBe(1.25);
    expect(direction('-1')).toBe(-1);
    expect(direction('0')).toBe(0);
    expect(direction('3')).toBe(1);
  });
});

describe('formatting', () => {
  it('formats USD with a real minus sign', () => {
    expect(formatMoney('1234.5')).toBe('$1,234.50');
    expect(formatMoney('-12.3')).toBe('−$12.30');
    expect(formatMoney('12.3', { signed: true })).toBe('+$12.30');
    expect(formatMoney('0', { signed: true })).toBe('$0.00');
  });

  it('formats IDR with fx rate and no decimals', () => {
    const out = formatMoney('10', { currency: 'IDR', fxRate: '16250', locale: 'id-ID' });
    expect(out.replace(/\s/g, ' ')).toMatch(/Rp\s?162\.500/);
  });

  it('adapts decimals for tiny memecoin prices', () => {
    expect(priceDecimals('0.0000123')).toBe(8);
    expect(priceDecimals('0')).toBe(2);
    expect(priceDecimals('5.5')).toBe(4);
    expect(priceDecimals('65000')).toBe(2);
    expect(formatMoney('0.0000123456', { adaptive: true })).toBe('$0.00001235');
  });

  it('formats compact money and numbers', () => {
    expect(formatMoney('1250000', { compact: true })).toBe('$1.25M');
    expect(formatCompact('4500')).toBe('4.5K');
    expect(formatMoney('12.3456', { decimals: 3 })).toBe('$12.346');
  });

  it('formats percentages with sign and arrows', () => {
    expect(formatPct('12.345')).toBe('+12.35%');
    expect(formatPct('-3.2', { arrow: true })).toBe('▼ −3.20%');
    expect(formatPct('3.2', { arrow: true })).toBe('▲ +3.20%');
    expect(formatPct('0', { arrow: true })).toBe('• 0.00%');
    expect(formatPct('5', { signed: false, decimals: 0 })).toBe('5%');
  });

  it('formats quantities', () => {
    expect(formatQty('1234.56789')).toBe('1,234.57');
    expect(formatQty('1.23456789')).toBe('1.2346');
    expect(formatQty('0.000012345678')).toBe('0.00001235');
    expect(formatQty('-2', { maxDecimals: 2 })).toBe('−2');
  });
});
