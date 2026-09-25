import { AppError } from '../errors';
import { round } from '../money';
import {
  assertLeverage,
  assertTpSl,
  initialMargin,
  isHighLeverage,
  isLiquidatable,
  isNearLiquidation,
  liquidationPrice,
  notional,
  perpUnrealizedPnl,
  previewPerp,
  priceFromPct,
  roePct,
  sizeFromMargin,
  validateTpSl,
} from './perps';

describe('perp sizing', () => {
  it('computes notional, margin and size', () => {
    expect(notional('2', '100')).toBe('200');
    expect(initialMargin('200', 4)).toBe('50');
    expect(sizeFromMargin('100', 3, '50')).toBe('6');
    expect(() => sizeFromMargin('100', 3, '0')).toThrow(AppError);
  });

  it('enforces leverage bounds', () => {
    expect(() => assertLeverage(0, 20)).toThrow('Leverage must be between');
    expect(() => assertLeverage(21, 20)).toThrow(AppError);
    expect(() => assertLeverage(Number.NaN, 20)).toThrow(AppError);
    expect(() => assertLeverage(1, 20)).not.toThrow();
    expect(() => assertLeverage(20, 20)).not.toThrow();
    expect(isHighLeverage(10)).toBe(false);
    expect(isHighLeverage(11)).toBe(true);
  });
});

describe('estimated liquidation price', () => {
  it('long: entry × (1 − 1/lev + mmr)', () => {
    expect(liquidationPrice('long', '100', 10, '0.005')).toBe('90.5');
    expect(liquidationPrice('long', '100', 1, '0.005')).toBe('0.5');
  });
  it('short: entry × (1 + 1/lev − mmr)', () => {
    expect(liquidationPrice('short', '100', 10, '0.005')).toBe('109.5');
    expect(liquidationPrice('short', '100', 2, '0.01')).toBe('149');
  });
  it('clamps to zero', () => {
    expect(liquidationPrice('long', '100', 1, '0')).toBe('0');
  });
});

describe('PnL & ROE', () => {
  it('long and short unrealized PnL', () => {
    expect(perpUnrealizedPnl('long', '100', '110', '2')).toBe('20');
    expect(perpUnrealizedPnl('short', '100', '110', '2')).toBe('-20');
    expect(perpUnrealizedPnl('short', '100', '90', '2')).toBe('20');
  });
  it('roe = pnl / margin × 100', () => {
    expect(roePct('20', '50')).toBe('40');
    expect(roePct('-25', '50')).toBe('-50');
    expect(roePct('1', '0')).toBe('0');
  });
});

describe('liquidation checks', () => {
  it('detects liquidation', () => {
    expect(isLiquidatable('long', '90', '90.5')).toBe(true);
    expect(isLiquidatable('long', '91', '90.5')).toBe(false);
    expect(isLiquidatable('short', '110', '109.5')).toBe(true);
  });
  it('warns within 10% of liquidation', () => {
    expect(isNearLiquidation('long', '100', '91')).toBe(true);
    expect(isNearLiquidation('long', '100', '80')).toBe(false);
    expect(isNearLiquidation('short', '100', '109')).toBe(true);
    expect(isNearLiquidation('short', '100', '130')).toBe(false);
    expect(isNearLiquidation('long', '90', '91')).toBe(true);
    expect(isNearLiquidation('long', '0', '1')).toBe(false);
  });
});

describe('TP/SL validation', () => {
  const long = { side: 'long' as const, entry: '100', liqPrice: '90' };
  const short = { side: 'short' as const, entry: '100', liqPrice: '110' };

  it('accepts valid long and short TP/SL', () => {
    expect(validateTpSl({ ...long, tp: '120', sl: '95' })).toEqual([]);
    expect(validateTpSl({ ...short, tp: '80', sl: '105' })).toEqual([]);
    expect(validateTpSl({ ...long })).toEqual([]);
  });
  it('rejects TP on the wrong side', () => {
    expect(validateTpSl({ ...long, tp: '99' })).toEqual(['invalid_tp']);
    expect(validateTpSl({ ...short, tp: '101' })).toEqual(['invalid_tp']);
  });
  it('rejects SL on the wrong side', () => {
    expect(validateTpSl({ ...long, sl: '101' })).toEqual(['invalid_sl']);
    expect(validateTpSl({ ...short, sl: '99' })).toEqual(['invalid_sl']);
  });
  it('blocks SL beyond the liquidation price', () => {
    expect(validateTpSl({ ...long, sl: '89' })).toEqual(['sl_beyond_liquidation']);
    expect(validateTpSl({ ...short, sl: '111' })).toEqual(['sl_beyond_liquidation']);
    expect(() => assertTpSl({ ...long, sl: '85' })).toThrow(AppError);
    expect(() => assertTpSl({ ...long, sl: '95' })).not.toThrow();
  });
  it('converts % moves into prices', () => {
    expect(priceFromPct('long', '100', '10', 'tp')).toBe('110');
    expect(priceFromPct('long', '100', '5', 'sl')).toBe('95');
    expect(priceFromPct('short', '100', '10', 'tp')).toBe('90');
    expect(priceFromPct('short', '100', '5', 'sl')).toBe('105');
  });
});

describe('previewPerp', () => {
  it('previews a 3× long', () => {
    const p = previewPerp({
      side: 'long',
      marginUsd: '100',
      leverage: 3,
      price: '50',
      mmr: '0.005',
      feeRate: '0.00035',
    });
    expect({ ...p, liqPrice: round(p.liqPrice, 4) }).toEqual({
      size: '6',
      notional: '300',
      margin: '100',
      liqPrice: '33.5833',
      fee: '0.105',
    });
  });
});
