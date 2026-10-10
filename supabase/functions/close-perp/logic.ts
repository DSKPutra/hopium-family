import { add, div, mul, round, sub } from '@hopium/core/money';
import { perpUnrealizedPnl } from '@hopium/core/trading/perps';
import type { PerpSide } from '@hopium/core/types';

/** Partial or full close at mark: realized PnL and remaining size/margin. */
export function closeAmounts(
  pos: { side: PerpSide; entry: string; size: string; margin: string; realized: string },
  mark: string,
  sizePct: number,
) {
  const fraction = div(sizePct, 100);
  const closedSize = mul(pos.size, fraction);
  const closedMargin = mul(pos.margin, fraction);
  const pnl = perpUnrealizedPnl(pos.side, pos.entry, mark, closedSize);
  return {
    full: sizePct >= 100,
    closedMargin,
    realized: round(add(pos.realized, pnl), 6),
    remainingSize: sub(pos.size, closedSize),
    remainingMargin: sub(pos.margin, closedMargin),
  };
}
