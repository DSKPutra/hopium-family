import {
  favorablePct,
  resolveThesis,
  thesisProgress,
  timeframeEnd,
  validateThesisPrices,
} from './thesis';

describe('thesis validation', () => {
  it('validates long ordering', () => {
    expect(validateThesisPrices('long', '100', '120', '90')).toEqual([]);
    expect(validateThesisPrices('long', '100', '99', '90')).toEqual(['target_wrong_side']);
    expect(validateThesisPrices('long', '100', '120', '101')).toEqual(['invalidation_wrong_side']);
  });
  it('validates short ordering', () => {
    expect(validateThesisPrices('short', '100', '80', '110')).toEqual([]);
    expect(validateThesisPrices('short', '100', '101', '110')).toEqual(['target_wrong_side']);
    expect(validateThesisPrices('short', '100', '80', '99')).toEqual(['invalidation_wrong_side']);
  });
  it('computes timeframe ends', () => {
    expect(timeframeEnd('24h', 0)).toBe(new Date(86_400_000).toISOString());
    expect(timeframeEnd('1m', 0)).toBe(new Date(30 * 86_400_000).toISOString());
  });
});

describe('thesis progress', () => {
  it('moves toward target (positive) and invalidation (negative)', () => {
    expect(thesisProgress('long', '100', '120', '90', '110')).toBeCloseTo(0.5);
    expect(thesisProgress('long', '100', '120', '90', '95')).toBeCloseTo(-0.5);
    expect(thesisProgress('long', '100', '120', '90', '200')).toBe(1);
    expect(thesisProgress('long', '100', '120', '90', '50')).toBe(-1);
    expect(thesisProgress('short', '100', '80', '110', '90')).toBeCloseTo(0.5);
    expect(thesisProgress('short', '100', '80', '110', '105')).toBeCloseTo(-0.5);
    expect(thesisProgress('long', '100', '100', '90', '110')).toBe(0);
    expect(thesisProgress('long', '100', '120', '100', '95')).toBe(0);
  });
  it('computes favorable excursion', () => {
    expect(favorablePct('long', '100', '110')).toBe('10');
    expect(favorablePct('short', '100', '110')).toBe('-10');
  });
});

describe('thesis resolution', () => {
  const base = {
    direction: 'long' as const,
    entryPrice: '100',
    targetPrice: '120',
    invalidationPrice: '90',
    timeframeEnd: new Date(10_000).toISOString(),
    status: 'active' as const,
    maxFavorablePct: '0',
  };
  it('marks hit, invalidated, expired or active', () => {
    expect(resolveThesis(base, '121', 0).status).toBe('hit');
    expect(resolveThesis(base, '89', 0).status).toBe('invalidated');
    expect(resolveThesis(base, '105', 20_000).status).toBe('expired');
    const active = resolveThesis(base, '105', 0);
    expect(active).toEqual({ status: 'active', maxFavorablePct: '5' });
  });
  it('resolves shorts and keeps resolved theses frozen', () => {
    const short = {
      ...base,
      direction: 'short' as const,
      targetPrice: '80',
      invalidationPrice: '110',
    };
    expect(resolveThesis(short, '79', 0).status).toBe('hit');
    expect(resolveThesis(short, '111', 0).status).toBe('invalidated');
    expect(resolveThesis({ ...base, status: 'hit', maxFavorablePct: '20' }, '50', 0)).toEqual({
      status: 'hit',
      maxFavorablePct: '20',
    });
  });
});
