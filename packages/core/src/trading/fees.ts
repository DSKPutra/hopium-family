import { dec, mul, round, str } from '../money';
import type { AppConfig, AssetClass, Decimal } from '../types';

export const DEFAULT_FEES: AppConfig['fees'] = {
  cryptoSwap: '0.0075',
  stockToken: '0.0075',
  perpsTaker: '0.00035',
  perpsMaker: '0.0001',
};

export const DEFAULT_MIN_ORDER_USD: AppConfig['minOrderUsd'] = { crypto: '1', stock_token: '2' };

/** fee = notional × feeRate, rounded to cents (half-up). */
export function fee(notional: Decimal, feeRate: Decimal): Decimal {
  return round(mul(notional, feeRate), 6);
}

export function spotFeeRate(
  assetClass: Exclude<AssetClass, 'perp'>,
  fees: AppConfig['fees'] = DEFAULT_FEES,
): Decimal {
  return assetClass === 'stock_token' ? fees.stockToken : fees.cryptoSwap;
}

export function perpFeeRate(
  kind: 'taker' | 'maker',
  fees: AppConfig['fees'] = DEFAULT_FEES,
): Decimal {
  return kind === 'taker' ? fees.perpsTaker : fees.perpsMaker;
}

/** Fee expressed as a percentage string, e.g. '0.0075' → '0.75'. */
export const feeRatePct = (rate: Decimal): Decimal => str(dec(rate).times(100));
