import { z } from 'zod';
import { AppError } from '@hopium/core/errors';
import { assertMinOrder, exceedsSlippage } from '@hopium/core/trading/spot';
import { add, gt } from '@hopium/core/money';

const decimal = z.string().regex(/^\d+(\.\d+)?$/, 'Invalid amount');

export const quoteSchema = z.object({
  id: z.string().min(1),
  assetId: z.string().min(1),
  symbol: z.string().min(1),
  assetClass: z.enum(['crypto', 'stock_token']),
  side: z.enum(['buy', 'sell']),
  notionalUsd: decimal,
  qty: decimal,
  price: decimal,
  priceImpactPct: decimal,
  platformFeeUsd: decimal,
  networkFeeUsd: decimal,
  totalUsd: decimal,
  slippageBps: z.number().int().min(1).max(2000),
  expiresAt: z.number(),
});

export const placeOrderSchema = z.union([
  z.object({
    quote: quoteSchema,
    copiedFromTradeId: z.string().uuid().nullable(),
    shareToFeed: z.boolean(),
  }),
  z.object({
    orderId: z.string().uuid(),
    status: z.enum(['filled', 'failed']),
    txHash: z.string().optional(),
    errorCode: z.string().optional(),
    filled: z.object({ amountIn: decimal, amountOut: decimal, price: decimal }).optional(),
  }),
]);

/** Server-side checks mirrored from the client: min order, slippage, balance, expiry. */
export function validateQuote(
  quote: z.infer<typeof quoteSchema>,
  cashUsd: string,
  heldQty: string,
  now = Date.now(),
): void {
  assertMinOrder(quote.notionalUsd, quote.assetClass);
  if (now > quote.expiresAt) throw new AppError('quote_expired', 'This quote expired.');
  if (exceedsSlippage(quote.priceImpactPct, quote.slippageBps))
    throw new AppError('slippage_exceeded', 'Price impact is above your slippage setting.');
  if (quote.side === 'buy' && gt(add(quote.notionalUsd, quote.platformFeeUsd), cashUsd)) {
    throw new AppError('insufficient_balance', 'Not enough balance for this order.');
  }
  if (quote.side === 'sell' && gt(quote.qty, heldQty))
    throw new AppError('insufficient_balance', 'Not enough balance for this order.');
}
