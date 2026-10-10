import { assertThrows } from 'std/assert';
import { placeOrderSchema, validateQuote } from './logic.ts';

const quote = {
  id: 'q1',
  assetId: 'hope',
  symbol: 'HOPE',
  assetClass: 'crypto' as const,
  side: 'buy' as const,
  notionalUsd: '25',
  qty: '1000',
  price: '0.025',
  priceImpactPct: '0.1',
  platformFeeUsd: '0.1875',
  networkFeeUsd: '0',
  totalUsd: '25.1875',
  slippageBps: 100,
  expiresAt: Date.now() + 10_000,
};

Deno.test('accepts a valid buy', () => validateQuote(quote, '100', '0'));
Deno.test(
  'rejects below minimum',
  () =>
    void assertThrows(
      () => validateQuote({ ...quote, notionalUsd: '0.5' }, '100', '0'),
      Error,
      'Minimum',
    ),
);
Deno.test(
  'rejects stock tokens below $2',
  () =>
    void assertThrows(() =>
      validateQuote({ ...quote, assetClass: 'stock_token', notionalUsd: '1.5' }, '100', '0'),
    ),
);
Deno.test(
  'rejects expired quotes',
  () =>
    void assertThrows(
      () => validateQuote({ ...quote, expiresAt: 0 }, '100', '0'),
      Error,
      'expired',
    ),
);
Deno.test(
  'rejects excess price impact',
  () =>
    void assertThrows(
      () => validateQuote({ ...quote, priceImpactPct: '2' }, '100', '0'),
      Error,
      'slippage',
    ),
);
Deno.test(
  'rejects insufficient cash',
  () => void assertThrows(() => validateQuote(quote, '10', '0'), Error, 'Not enough balance'),
);
Deno.test(
  'rejects overselling',
  () =>
    void assertThrows(
      () => validateQuote({ ...quote, side: 'sell' }, '0', '10'),
      Error,
      'Not enough balance',
    ),
);
Deno.test(
  'validates payload shape',
  () =>
    void assertThrows(() =>
      placeOrderSchema.parse({
        quote: { ...quote, slippageBps: 5000 },
        copiedFromTradeId: null,
        shareToFeed: true,
      }),
    ),
);
