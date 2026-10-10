import { z } from 'zod';
import { AppError } from '@hopium/core/errors';
import {
  assertLeverage,
  assertTpSl,
  isHighLeverage,
  liquidationPrice,
  sizeFromMargin,
} from '@hopium/core/trading/perps';
import { gt } from '@hopium/core/money';

const decimal = z.string().regex(/^\d+(\.\d+)?$/);

export const openPerpSchema = z.object({
  marketId: z.string().min(1),
  side: z.enum(['long', 'short']),
  marginUsd: decimal,
  leverage: z.number().min(1),
  tp: decimal.optional(),
  sl: decimal.optional(),
  acknowledgedHighLeverage: z.boolean(),
});

export interface MarketRules {
  maxLeverage: number;
  maintenanceMarginRate: string;
  markPrice: string;
}

/** Leverage bounds, high-leverage acknowledgement and TP/SL rules (Section 6). */
export function preparePerp(input: z.infer<typeof openPerpSchema>, market: MarketRules) {
  assertLeverage(input.leverage, market.maxLeverage);
  if (isHighLeverage(input.leverage) && !input.acknowledgedHighLeverage) {
    throw new AppError(
      'high_leverage_unacknowledged',
      'Please acknowledge the high-leverage risk.',
    );
  }
  if (!gt(input.marginUsd, 0)) throw new AppError('invalid_amount');
  const liqPrice = liquidationPrice(
    input.side,
    market.markPrice,
    input.leverage,
    market.maintenanceMarginRate,
  );
  assertTpSl({ side: input.side, entry: market.markPrice, liqPrice, tp: input.tp, sl: input.sl });
  return { size: sizeFromMargin(input.marginUsd, input.leverage, market.markPrice), liqPrice };
}
