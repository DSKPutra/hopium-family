import { explorerUrl } from '../../chains';
import { AppError } from '../../errors';
import { add, div, gt, mul, round, str, sub } from '../../money';
import { fakeTxHash, newId } from '../../random';
import { estimatePriceImpactPct, exceedsSlippage } from '../../trading/spot';
import type { Asset, Chain, Decimal, Side, StockQuote, SwapQuote, TxResult } from '../../types';
import type { StockTokenProvider, SwapProvider } from '../interfaces';
import { USDC_ID } from './catalog';
import { maybeFail } from './failures';
import type { MockMarketData } from './marketData';
import type { MockWorld } from './world';

const QUOTE_TTL_MS = 15_000;
const NETWORK_FEE_USD: Record<Chain, Decimal> = {
  solana: '0',
  base: '0',
  arbitrum: '0',
  robinhood: '0',
  ethereum: '1.85',
};

function liquidityUsd(asset: Asset): Decimal {
  // Mock depth: ~5% of 24h volume available near the mid price.
  return mul(asset.volume24h ?? '100000', '0.05');
}

/** DEX aggregator mock (Jupiter / 0x / LI.FI shape). */
export class MockSwap implements SwapProvider {
  constructor(
    private world: MockWorld,
    private market: MockMarketData,
  ) {}

  private usdValue(assetId: string, qty: Decimal): Decimal {
    return mul(qty, this.market.priceOf(assetId));
  }

  private compute(from: string, to: string, amountIn: Decimal, feeBps = 0) {
    const fromIsUsd = from === USDC_ID;
    const usdSide = fromIsUsd ? amountIn : this.usdValue(from, amountIn);
    const volatile = fromIsUsd ? to : from;
    const impact = estimatePriceImpactPct(usdSide, liquidityUsd(this.market.assetSync(volatile)));
    const impactFactor = sub(1, div(impact, 100));
    const gross = div(mul(amountIn, this.market.priceOf(from)), this.market.priceOf(to));
    const amountOut = round(mul(gross, impactFactor), 12, 'down');
    const feeAmount = round(mul(usdSide, div(feeBps, 10_000)), 6);
    return {
      impact,
      amountOut,
      feeAmount,
      price: fromIsUsd ? div(amountIn, amountOut) : div(amountOut, amountIn),
    };
  }

  async quote(p: {
    from: string;
    to: string;
    amountIn: Decimal;
    slippageBps: number;
    chain: Chain;
    feeBps?: number;
  }): Promise<SwapQuote> {
    await this.world.simulateLatency();
    if (!gt(p.amountIn, 0)) throw new AppError('invalid_amount');
    const { impact, amountOut, feeAmount, price } = this.compute(
      p.from,
      p.to,
      p.amountIn,
      p.feeBps,
    );
    return {
      id: newId('q_'),
      from: p.from,
      to: p.to,
      chain: p.chain,
      amountIn: p.amountIn,
      amountOut,
      price,
      priceImpactPct: impact,
      slippageBps: p.slippageBps,
      networkFeeUsd: NETWORK_FEE_USD[p.chain],
      gasSponsored: NETWORK_FEE_USD[p.chain] === '0',
      expiresAt: Date.now() + QUOTE_TTL_MS,
      platformFee: feeAmount === '0' ? undefined : { assetId: USDC_ID, amount: feeAmount },
    };
  }

  async execute(quote: SwapQuote): Promise<TxResult> {
    await this.world.simulateLatency();
    const userId = this.world.requireUser();
    if (Date.now() > quote.expiresAt)
      throw new AppError('quote_expired', 'This quote expired. Refreshing…');
    const fee = quote.platformFee?.amount ?? '0';
    const buyingWithUsd = quote.from === USDC_ID;
    const needUsd = buyingWithUsd ? add(quote.amountIn, fee) : '0';
    if (
      buyingWithUsd
        ? !this.world.hasBalance(userId, USDC_ID, needUsd)
        : !this.world.hasBalance(userId, quote.from, quote.amountIn)
    ) {
      throw new AppError('insufficient_balance', 'Not enough balance for this order.');
    }
    maybeFail(this.world.options.failureRate);
    const now = this.compute(quote.from, quote.to, quote.amountIn);
    // Price moved against the user by more than their slippage tolerance?
    const worsePct = gt(quote.amountOut, 0)
      ? mul(div(sub(quote.amountOut, now.amountOut), quote.amountOut), 100)
      : '0';
    if (exceedsSlippage(worsePct, quote.slippageBps)) {
      throw new AppError('slippage_exceeded', 'Price moved more than your slippage setting.');
    }
    const amountOut = now.amountOut;
    this.world.debit(userId, quote.from, quote.amountIn);
    this.world.credit(userId, quote.to, amountOut);
    if (gt(fee, 0)) this.world.debit(userId, USDC_ID, fee);
    const txHash = fakeTxHash(quote.chain);
    return {
      txHash,
      chain: quote.chain,
      status: 'confirmed',
      gasSponsored: quote.gasSponsored,
      explorerUrl: explorerUrl(quote.chain, txHash),
      filled: {
        amountIn: quote.amountIn,
        amountOut,
        price: buyingWithUsd ? div(quote.amountIn, amountOut) : div(amountOut, quote.amountIn),
      },
    };
  }
}

/** Tokenized-equity venue mock (Robinhood Chain shape). Trades 24/7. */
export class MockStockTokens implements StockTokenProvider {
  constructor(
    private world: MockWorld,
    private market: MockMarketData,
  ) {}

  async listStockTokens(): Promise<Asset[]> {
    await this.world.simulateLatency();
    return this.market.allAssets().filter((a) => a.class === 'stock_token');
  }

  private exec(assetId: string, side: Side, notionalUsd: Decimal) {
    const asset = this.market.assetSync(assetId);
    if (asset.class !== 'stock_token') throw new AppError('not_found', 'Not a stock token');
    const impact = estimatePriceImpactPct(notionalUsd, liquidityUsd(asset));
    const factor = div(impact, 100);
    const price =
      side === 'buy' ? mul(asset.price, add(1, factor)) : mul(asset.price, sub(1, factor));
    return { impact, price, qty: round(div(notionalUsd, price), 12, 'down') };
  }

  async quote(p: {
    assetId: string;
    side: Side;
    notionalUsd: Decimal;
    feeRate?: Decimal;
  }): Promise<StockQuote> {
    await this.world.simulateLatency();
    if (!gt(p.notionalUsd, 0)) throw new AppError('invalid_amount');
    const { impact, price, qty } = this.exec(p.assetId, p.side, p.notionalUsd);
    return {
      id: newId('sq_'),
      assetId: p.assetId,
      side: p.side,
      notionalUsd: p.notionalUsd,
      qty,
      price,
      priceImpactPct: impact,
      expiresAt: Date.now() + QUOTE_TTL_MS,
      platformFeeUsd: p.feeRate ? round(mul(p.notionalUsd, p.feeRate), 6) : undefined,
    };
  }

  async execute(q: StockQuote): Promise<TxResult> {
    await this.world.simulateLatency();
    const userId = this.world.requireUser();
    if (Date.now() > q.expiresAt)
      throw new AppError('quote_expired', 'This quote expired. Refreshing…');
    const fee = q.platformFeeUsd ?? '0';
    if (q.side === 'buy' && !this.world.hasBalance(userId, USDC_ID, add(q.notionalUsd, fee))) {
      throw new AppError('insufficient_balance', 'Not enough balance for this order.');
    }
    if (q.side === 'sell' && !this.world.hasBalance(userId, q.assetId, q.qty)) {
      throw new AppError('insufficient_balance', 'Not enough balance for this order.');
    }
    maybeFail(this.world.options.failureRate);
    const now = this.exec(q.assetId, q.side, q.notionalUsd);
    const qty = q.side === 'buy' ? now.qty : q.qty;
    const proceeds = q.side === 'sell' ? round(mul(q.qty, now.price), 6, 'down') : q.notionalUsd;
    if (q.side === 'buy') {
      this.world.debit(userId, USDC_ID, add(q.notionalUsd, fee));
      this.world.credit(userId, q.assetId, qty);
    } else {
      this.world.debit(userId, q.assetId, qty);
      this.world.credit(userId, USDC_ID, str(sub(proceeds, fee)));
    }
    const txHash = fakeTxHash('robinhood');
    return {
      txHash,
      chain: 'robinhood',
      status: 'confirmed',
      gasSponsored: true,
      explorerUrl: explorerUrl('robinhood', txHash),
      filled: {
        amountIn: q.side === 'buy' ? q.notionalUsd : qty,
        amountOut: q.side === 'buy' ? qty : proceeds,
        price: now.price,
      },
    };
  }

  async transfer(p: { assetId: string; amount: Decimal; to: string }): Promise<TxResult> {
    await this.world.simulateLatency();
    const userId = this.world.requireUser();
    if (!this.world.hasBalance(userId, p.assetId, p.amount))
      throw new AppError('insufficient_balance');
    this.world.debit(userId, p.assetId, p.amount);
    const txHash = fakeTxHash('robinhood');
    return {
      txHash,
      chain: 'robinhood',
      status: 'confirmed',
      gasSponsored: true,
      explorerUrl: explorerUrl('robinhood', txHash),
    };
  }
}
