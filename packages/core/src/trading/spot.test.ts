import { AppError } from '../errors';
import { fee, feeRatePct, perpFeeRate, spotFeeRate } from './fees';
import {
  assertMinOrder,
  assertWithinSlippage,
  averageEntry,
  estimatePriceImpactPct,
  exceedsSlippage,
  fifoSell,
  meetsMinOrder,
  sizeBucket,
  slippageLevel,
  unrealizedPnl,
  unrealizedPnlPct,
  weightedAverage,
} from './spot';

describe('fees', () => {
  it('computes notional × rate', () => {
    expect(fee('100', '0.0075')).toBe('0.75');
    expect(fee('0', '0.0075')).toBe('0');
    expect(fee('1000', '0.00035')).toBe('0.35');
  });
  it('selects rates by class', () => {
    expect(spotFeeRate('crypto')).toBe('0.0075');
    expect(spotFeeRate('stock_token')).toBe('0.0075');
    expect(perpFeeRate('taker')).toBe('0.00035');
    expect(perpFeeRate('maker')).toBe('0.0001');
    expect(feeRatePct('0.0075')).toBe('0.75');
  });
});

describe('minimum order', () => {
  it('enforces $1 crypto and $2 stock tokens', () => {
    expect(meetsMinOrder('1', 'crypto')).toBe(true);
    expect(meetsMinOrder('0.99', 'crypto')).toBe(false);
    expect(meetsMinOrder('1.99', 'stock_token')).toBe(false);
    expect(() => assertMinOrder('1.5', 'stock_token')).toThrow(AppError);
    expect(() => assertMinOrder('2', 'stock_token')).not.toThrow();
  });
});

describe('slippage', () => {
  it('classifies slippage settings', () => {
    expect(slippageLevel(100)).toBe('ok');
    expect(slippageLevel(500)).toBe('ok');
    expect(slippageLevel(501)).toBe('warning');
    expect(slippageLevel(2000)).toBe('warning');
    expect(slippageLevel(2001)).toBe('invalid');
    expect(slippageLevel(0)).toBe('invalid');
    expect(slippageLevel(1.5)).toBe('invalid');
  });
  it('rejects quotes with impact above slippage', () => {
    expect(exceedsSlippage('1.01', 100)).toBe(true);
    expect(exceedsSlippage('1', 100)).toBe(false);
    expect(() => assertWithinSlippage('0.6', 50)).toThrow('Price moved');
    expect(() => assertWithinSlippage('0.4', 50)).not.toThrow();
  });
  it('estimates price impact from liquidity', () => {
    expect(estimatePriceImpactPct('100', '9900')).toBe('1');
    expect(estimatePriceImpactPct('100', '0')).toBe('0');
  });
});

describe('average entry & PnL', () => {
  it('weights average entry by quantity', () => {
    expect(averageEntry('0', '0', '2', '10')).toBe('10');
    expect(averageEntry('2', '10', '2', '20')).toBe('15');
    expect(averageEntry('0', '0', '0', '5')).toBe('0');
    expect(
      weightedAverage([
        { qty: '1', price: '10' },
        { qty: '3', price: '30' },
      ]),
    ).toBe('25');
    expect(weightedAverage([])).toBe('0');
  });

  it('realizes PnL FIFO across lots', () => {
    const lots = [
      { qty: '1', price: '10' },
      { qty: '2', price: '20' },
    ];
    const res = fifoSell(lots, '2', '25');
    expect(res.costBasis).toBe('30');
    expect(res.realizedPnl).toBe('20');
    expect(res.remainingLots).toEqual([{ qty: '1', price: '20' }]);
  });

  it('supports negative realized PnL and exact full exits', () => {
    const res = fifoSell([{ qty: '1', price: '100' }], '1', '60');
    expect(res.realizedPnl).toBe('-40');
    expect(res.remainingLots).toEqual([]);
    const two = fifoSell(
      [
        { qty: '1', price: '1' },
        { qty: '1', price: '2' },
      ],
      '1',
      '3',
    );
    expect(two.remainingLots).toEqual([{ qty: '1', price: '2' }]);
  });

  it('rejects overselling and non-positive quantities', () => {
    expect(() => fifoSell([{ qty: '1', price: '1' }], '2', '1')).toThrow('Not enough balance');
    expect(() => fifoSell([], '0', '1')).toThrow(AppError);
  });

  it('computes unrealized PnL', () => {
    expect(unrealizedPnl('12', '10', '3')).toBe('6');
    expect(unrealizedPnl('8', '10', '3')).toBe('-6');
    expect(unrealizedPnlPct('12', '10')).toBe('20');
    expect(unrealizedPnlPct('12', '0')).toBe('0');
  });

  it('buckets sizes without exposing exact amounts', () => {
    expect(sizeBucket('99.99')).toBe('lt100');
    expect(sizeBucket('100')).toBe('100to1k');
    expect(sizeBucket('9999')).toBe('1kto10k');
    expect(sizeBucket('10000')).toBe('gt10k');
  });
});
