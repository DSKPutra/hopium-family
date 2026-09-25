import { explorerUrl } from '../../chains';
import { AppError } from '../../errors';
import { add, dec, div, gt, max, mul, round, str, sub } from '../../money';
import { fakeTxHash, newId, rngFor } from '../../random';
import {
  assertLeverage,
  assertTpSl,
  isLiquidatable,
  liquidationPrice,
  perpUnrealizedPnl,
  roePct,
  sizeFromMargin,
} from '../../trading/perps';
import { DEFAULT_FEES } from '../../trading/fees';
import type {
  Decimal,
  OpenPerpParams,
  PerpMarket,
  PerpPosition,
  TxResult,
  Unsubscribe,
} from '../../types';
import type { PerpsEvent, PerpsProvider } from '../interfaces';
import { PERP_BASES, USDC_ID } from './catalog';
import { maybeFail } from './failures';
import type { MockMarketData } from './marketData';
import type { MockWorld } from './world';

const MEMES = new Set(['HOPE', 'FAM', 'DOGE']);
const MAJORS = new Set(['BTC', 'ETH']);

/** Isolated-margin perps exchange mock (Hyperliquid shape). */
export class MockPerps implements PerpsProvider {
  private positionSubs = new Set<(p: PerpPosition[]) => void>();
  private eventSubs = new Set<(e: PerpsEvent) => void>();
  private unsubscribeTicks: Unsubscribe | null = null;
  private readonly markets: Map<
    string,
    Omit<PerpMarket, 'markPrice' | 'indexPrice' | 'change24hPct'>
  >;

  constructor(
    private world: MockWorld,
    private market: MockMarketData,
    private seed: number,
    private takerFee: Decimal = DEFAULT_FEES.perpsTaker,
  ) {
    this.markets = new Map(
      PERP_BASES.map((base) => {
        const r = rngFor(seed, base, 'perp');
        const hour = 3_600_000;
        return [
          `${base.toLowerCase()}-perp`,
          {
            id: `${base.toLowerCase()}-perp`,
            symbol: `${base}-PERP`,
            baseAssetId: base.toLowerCase(),
            name: `${base} Perpetual`,
            maxLeverage: MEMES.has(base) ? 10 : 20,
            maintenanceMarginRate: MAJORS.has(base) ? '0.005' : MEMES.has(base) ? '0.02' : '0.01',
            takerFeeRate: takerFee,
            makerFeeRate: DEFAULT_FEES.perpsMaker,
            fundingRate: round(((r() - 0.45) * 0.0002).toFixed(8), 6),
            nextFundingAt: Math.ceil(Date.now() / hour) * hour,
            openInterestUsd: String(
              Math.round((MAJORS.has(base) ? 800_000_000 : 20_000_000) * (0.4 + r())),
            ),
          },
        ];
      }),
    );
  }

  start(): void {
    if (this.unsubscribeTicks) return;
    const baseIds = [...this.markets.values()].map((m) => m.baseAssetId);
    this.unsubscribeTicks = this.market.subscribePrices(baseIds, () => this.evaluate());
  }

  stop(): void {
    this.unsubscribeTicks?.();
    this.unsubscribeTicks = null;
  }

  private marketFor(id: string) {
    const m = this.markets.get(id);
    if (!m) throw new AppError('not_found', `Unknown market ${id}`);
    return m;
  }

  markPrice(marketId: string): Decimal {
    return this.market.priceOf(this.marketFor(marketId).baseAssetId);
  }

  marketSync(id: string): PerpMarket {
    const m = this.marketFor(id);
    const asset = this.market.assetSync(m.baseAssetId);
    const hour = 3_600_000;
    return {
      ...m,
      markPrice: asset.price,
      indexPrice: round(mul(asset.price, '0.9998'), 10),
      change24hPct: asset.change24hPct,
      nextFundingAt: Math.ceil(Date.now() / hour) * hour,
    };
  }

  async listMarkets(): Promise<PerpMarket[]> {
    await this.world.simulateLatency();
    return [...this.markets.keys()].map((id) => this.marketSync(id));
  }

  private withMark(p: PerpPosition): PerpPosition {
    if (p.status !== 'open') return p;
    const mark = this.markPrice(p.marketId);
    const unrealizedPnl = perpUnrealizedPnl(p.side, p.entryPrice, mark, p.size);
    return { ...p, markPrice: mark, unrealizedPnl, roePct: roePct(unrealizedPnl, p.margin) };
  }

  positionsFor(userId: string, includeClosed = false): PerpPosition[] {
    return this.world.positions
      .filter((p) => p.userId === userId && (includeClosed || p.status === 'open'))
      .map((p) => this.withMark(p));
  }

  async getPositions(): Promise<PerpPosition[]> {
    await this.world.simulateLatency();
    return this.positionsFor(this.world.requireUser());
  }

  async openPosition(params: OpenPerpParams): Promise<PerpPosition> {
    await this.world.simulateLatency();
    const userId = this.world.requireUser();
    const m = this.marketSync(params.marketId);
    assertLeverage(params.leverage, m.maxLeverage);
    if (!gt(params.marginUsd, 0)) throw new AppError('invalid_amount');
    // Taker fill a hair through the mark.
    const entry = round(mul(m.markPrice, params.side === 'long' ? '1.0002' : '0.9998'), 12);
    const size = round(sizeFromMargin(params.marginUsd, params.leverage, entry), 12, 'down');
    const notionalUsd = mul(size, entry);
    const fee = round(mul(notionalUsd, m.takerFeeRate), 6);
    const liqPrice = liquidationPrice(params.side, entry, params.leverage, m.maintenanceMarginRate);
    assertTpSl({ side: params.side, entry, liqPrice, tp: params.tp, sl: params.sl });
    if (!this.world.hasBalance(userId, USDC_ID, add(params.marginUsd, fee))) {
      throw new AppError('insufficient_balance', 'Not enough balance for this order.');
    }
    maybeFail(this.world.options.failureRate);
    this.world.debit(userId, USDC_ID, add(params.marginUsd, fee));
    const position: PerpPosition = {
      id: newId('pos_'),
      userId,
      marketId: m.id,
      symbol: m.symbol,
      side: params.side,
      size,
      entryPrice: entry,
      markPrice: m.markPrice,
      leverage: params.leverage,
      margin: params.marginUsd,
      liqPrice: round(liqPrice, 12),
      tp: params.tp ?? null,
      sl: params.sl ?? null,
      unrealizedPnl: '0',
      roePct: '0',
      realizedPnl: str(dec(fee).negated()),
      status: 'open',
      openedAt: new Date().toISOString(),
      closedAt: null,
    };
    this.world.positions.push(position);
    this.world.emit();
    this.notifyPositions(userId);
    return this.withMark(position);
  }

  /** Close `sizePct` (1–100) of a position at mark. */
  async closePosition(positionId: string, sizePct = 100): Promise<TxResult> {
    await this.world.simulateLatency();
    const userId = this.world.requireUser();
    const idx = this.world.positions.findIndex((p) => p.id === positionId && p.userId === userId);
    const position = this.world.positions[idx];
    if (!position || position.status !== 'open')
      throw new AppError('not_found', 'Position not found');
    if (!(sizePct > 0 && sizePct <= 100)) throw new AppError('invalid_amount');
    this.settle(idx, sizePct, 'closed');
    const txHash = fakeTxHash('arbitrum');
    return {
      txHash,
      chain: 'arbitrum',
      status: 'confirmed',
      gasSponsored: true,
      explorerUrl: explorerUrl('arbitrum', txHash),
    };
  }

  private settle(idx: number, sizePct: number, finalStatus: 'closed' | 'liquidated'): PerpPosition {
    const position = this.world.positions[idx] as PerpPosition;
    const mark = this.markPrice(position.marketId);
    const fraction = div(sizePct, 100);
    const closedSize = mul(position.size, fraction);
    const closedMargin = mul(position.margin, fraction);
    let pnl = perpUnrealizedPnl(position.side, position.entryPrice, mark, closedSize);
    const fee =
      finalStatus === 'liquidated'
        ? '0'
        : round(mul(mul(closedSize, mark), this.marketFor(position.marketId).takerFeeRate), 6);
    if (finalStatus === 'liquidated') pnl = str(dec(closedMargin).negated());
    const payout = max('0', sub(add(closedMargin, pnl), fee));
    if (gt(payout, 0)) this.world.credit(position.userId, USDC_ID, round(payout, 6, 'down'));
    const full = sizePct >= 100;
    const updated: PerpPosition = {
      ...position,
      size: full ? position.size : sub(position.size, closedSize),
      margin: full ? position.margin : sub(position.margin, closedMargin),
      realizedPnl: round(sub(add(position.realizedPnl, pnl), fee), 6),
      markPrice: mark,
      status: full ? finalStatus : 'open',
      closedAt: full ? new Date().toISOString() : null,
    };
    this.world.positions[idx] = updated;
    this.world.emit();
    this.notifyPositions(position.userId);
    return updated;
  }

  async setTpSl(positionId: string, tp?: Decimal, sl?: Decimal): Promise<void> {
    await this.world.simulateLatency();
    const userId = this.world.requireUser();
    const idx = this.world.positions.findIndex((p) => p.id === positionId && p.userId === userId);
    const position = this.world.positions[idx];
    if (!position || position.status !== 'open')
      throw new AppError('not_found', 'Position not found');
    assertTpSl({
      side: position.side,
      entry: position.entryPrice,
      liqPrice: position.liqPrice,
      tp,
      sl,
    });
    this.world.positions[idx] = { ...position, tp: tp ?? null, sl: sl ?? null };
    this.world.emit();
    this.notifyPositions(userId);
  }

  /** Mark-to-market: liquidations and TP/SL triggers. */
  evaluate(): void {
    const touched = new Set<string>();
    this.world.positions.forEach((p, idx) => {
      if (p.status !== 'open') return;
      const mark = this.markPrice(p.marketId);
      if (isLiquidatable(p.side, mark, p.liqPrice)) {
        const settled = this.settle(idx, 100, 'liquidated');
        this.emitEvent({ type: 'liquidated', position: settled });
      } else if (
        p.tp &&
        (p.side === 'long' ? !dec(mark).lessThan(dec(p.tp)) : !dec(mark).greaterThan(dec(p.tp)))
      ) {
        const settled = this.settle(idx, 100, 'closed');
        this.emitEvent({ type: 'tp_triggered', position: settled });
      } else if (
        p.sl &&
        (p.side === 'long' ? !dec(mark).greaterThan(dec(p.sl)) : !dec(mark).lessThan(dec(p.sl)))
      ) {
        const settled = this.settle(idx, 100, 'closed');
        this.emitEvent({ type: 'sl_triggered', position: settled });
      }
      touched.add(p.userId);
    });
    for (const userId of touched) this.notifyPositions(userId);
  }

  private notifyPositions(userId: string): void {
    if (userId !== this.world.currentUserId) return;
    const positions = this.positionsFor(userId);
    for (const cb of this.positionSubs) cb(positions);
  }

  private emitEvent(e: PerpsEvent): void {
    for (const cb of this.eventSubs) cb(e);
  }

  subscribePositions(cb: (positions: PerpPosition[]) => void): Unsubscribe {
    this.positionSubs.add(cb);
    return () => this.positionSubs.delete(cb);
  }

  subscribeEvents(cb: (event: PerpsEvent) => void): Unsubscribe {
    this.eventSubs.add(cb);
    return () => this.eventSubs.delete(cb);
  }
}
