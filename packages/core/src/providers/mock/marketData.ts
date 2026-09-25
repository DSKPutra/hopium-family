import { dec, div, mul, pctChange, priceDecimals, round, str } from '../../money';
import { gaussian, hashString, mulberry32, rngFor, type Rng } from '../../random';
import type {
  Asset,
  Candle,
  CandleRange,
  Decimal,
  Page,
  PriceTick,
  Unsubscribe,
} from '../../types';
import { AppError } from '../../errors';
import type { ListAssetsQuery, MarketDataProvider } from '../interfaces';
import { CATALOG, type CatalogEntry } from './catalog';
import type { MockWorld } from './world';

interface AssetState {
  entry: CatalogEntry;
  price: Decimal;
  open24h: Decimal;
  anchor: number;
  trendScore: number;
}

const RANGE_SPEC: Record<CandleRange, { count: number; stepMs: number }> = {
  '1H': { count: 60, stepMs: 60_000 },
  '1D': { count: 96, stepMs: 15 * 60_000 },
  '1W': { count: 168, stepMs: 3_600_000 },
  '1M': { count: 120, stepMs: 6 * 3_600_000 },
  '1Y': { count: 365, stepMs: 86_400_000 },
  ALL: { count: 260, stepMs: 7 * 86_400_000 },
};

/** Round to a sensible number of decimals for the price magnitude. */
const roundPrice = (price: Decimal): Decimal => round(price, priceDecimals(price) + 2);

export interface MockMarketDataOptions {
  seed: number;
  tickMs?: number;
  /** Multiplier on intraday volatility so demo ticks are visible. */
  tickVolBoost?: number;
  now?: () => number;
}

/**
 * Seeded geometric-Brownian-motion price simulator. Prices tick every
 * `tickMs` (1–2 s), memecoins are far more volatile, and candles are
 * generated deterministically so charts are stable across reloads.
 */
export class MockMarketData implements MarketDataProvider {
  private states = new Map<string, AssetState>();
  private bySymbol = new Map<string, string>();
  private subscribers = new Set<{ ids: Set<string> | null; cb: (tick: PriceTick) => void }>();
  private timer: ReturnType<typeof setInterval> | null = null;
  private rng: Rng;
  private readonly tickMs: number;
  private readonly boost: number;
  private readonly now: () => number;

  constructor(
    private world: MockWorld,
    private opts: MockMarketDataOptions,
  ) {
    this.tickMs = opts.tickMs ?? 1500;
    this.boost = opts.tickVolBoost ?? 6;
    this.now = opts.now ?? Date.now;
    this.rng = mulberry32(opts.seed ^ 0x9e3779b9);
    for (const entry of CATALOG) {
      const r = rngFor(opts.seed, entry.id, 'init');
      const drift = entry.dailyVol === 0 ? 0 : gaussian(r) * entry.dailyVol * 2;
      const price = roundPrice(mul(entry.basePrice, Math.exp(drift).toFixed(12)));
      const change = entry.dailyVol === 0 ? 0 : gaussian(r) * entry.dailyVol;
      const open24h = roundPrice(div(price, (1 + change).toFixed(12)));
      this.states.set(entry.id, {
        entry,
        price,
        open24h,
        anchor: dec(price).toNumber(),
        trendScore: r() * (entry.tags.includes('meme') ? 2 : 1),
      });
      this.bySymbol.set(entry.symbol.toLowerCase(), entry.id);
    }
  }

  // ─── lifecycle ───────────────────────────────────────────────────────────
  start(): void {
    if (this.timer) return;
    this.timer = setInterval(() => this.tick(), this.tickMs);
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  /** Advance one simulation step (exposed for tests). */
  tick(): void {
    const time = this.now();
    const stepSigmaScale = Math.sqrt(this.tickMs / 86_400_000) * this.boost;
    for (const state of this.states.values()) {
      if (state.entry.dailyVol === 0 || this.rng() > 0.7) continue;
      const sigma = state.entry.dailyVol * stepSigmaScale;
      const current = dec(state.price).toNumber();
      const reversion = -0.004 * Math.log(current / state.anchor);
      const logReturn = sigma * gaussian(this.rng) + reversion;
      state.price = roundPrice(mul(state.price, Math.exp(logReturn).toFixed(12)));
      const tick: PriceTick = {
        assetId: state.entry.id,
        price: state.price,
        change24hPct: this.change(state),
        time,
      };
      for (const sub of this.subscribers) if (!sub.ids || sub.ids.has(state.entry.id)) sub.cb(tick);
    }
  }

  private change(state: AssetState): Decimal {
    return pctChange(state.open24h, state.price);
  }

  // ─── MarketDataProvider ───────────────────────────────────────────────────
  resolveId(symbolOrId: string): string | undefined {
    const key = symbolOrId.toLowerCase().replace(/^\$/, '');
    if (this.states.has(key)) return key;
    return this.bySymbol.get(key);
  }

  lastPrice(assetId: string): Decimal | undefined {
    return this.states.get(assetId)?.price;
  }

  /** Synchronous price, throwing for unknown assets. */
  priceOf(assetId: string): Decimal {
    const p = this.lastPrice(assetId);
    if (p === undefined) throw new AppError('not_found', `Unknown asset ${assetId}`);
    return p;
  }

  assetSync(id: string): Asset {
    const state = this.states.get(id);
    if (!state) throw new AppError('not_found', `Unknown asset ${id}`);
    return this.toAsset(state);
  }

  allAssets(): Asset[] {
    return [...this.states.values()].map((s) => this.toAsset(s));
  }

  private toAsset(state: AssetState): Asset {
    const { entry } = state;
    const r = rngFor(this.opts.seed, entry.id, 'meta');
    const volumeJitter = (0.85 + r() * 0.3).toFixed(6);
    return {
      id: entry.id,
      symbol: entry.symbol,
      name: entry.name,
      class: entry.class,
      chain: entry.chain,
      address: this.contractAddress(entry),
      logoUrl: '',
      decimals: entry.decimals,
      price: state.price,
      change24hPct: this.change(state),
      marketCap: entry.supply === '0' ? undefined : round(mul(state.price, entry.supply), 0),
      volume24h: round(mul(entry.volume24h, volumeJitter), 0),
      tags: entry.tags,
      underlyingName: entry.underlyingName,
      listedAt: new Date(this.now() - entry.listedDaysAgo * 86_400_000).toISOString(),
      holders: Math.round(1000 + r() * (entry.tags.includes('blue-chip') ? 5_000_000 : 180_000)),
    };
  }

  private contractAddress(entry: CatalogEntry): string {
    const r = mulberry32(hashString(`addr:${entry.id}`));
    if (entry.chain === 'solana') {
      const alphabet = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
      let s = '';
      for (let i = 0; i < 44; i++) s += alphabet[Math.floor(r() * alphabet.length)];
      return s;
    }
    let s = '0x';
    for (let i = 0; i < 40; i++) s += Math.floor(r() * 16).toString(16);
    return s;
  }

  async listAssets(q: ListAssetsQuery): Promise<Page<Asset>> {
    await this.world.simulateLatency();
    let assets = this.allAssets();
    if (q.class) assets = assets.filter((a) => a.class === q.class);
    if (q.tag) assets = assets.filter((a) => a.tags.includes(q.tag as string));
    if (q.search) {
      const s = q.search.trim().toLowerCase().replace(/^\$/, '');
      assets = assets
        .filter(
          (a) =>
            a.symbol.toLowerCase().includes(s) ||
            a.name.toLowerCase().includes(s) ||
            (a.underlyingName ?? '').toLowerCase().includes(s),
        )
        .sort(
          (a, b) =>
            Number(b.symbol.toLowerCase().startsWith(s)) -
            Number(a.symbol.toLowerCase().startsWith(s)),
        );
    }
    const byChange = (a: Asset, b: Asset) => dec(b.change24hPct).comparedTo(dec(a.change24hPct));
    switch (q.sort) {
      case 'gainers':
        assets = assets.filter((a) => !a.tags.includes('stablecoin')).sort(byChange);
        break;
      case 'losers':
        assets = assets
          .filter((a) => !a.tags.includes('stablecoin'))
          .sort((a, b) => byChange(b, a));
        break;
      case 'volume':
        assets.sort((a, b) => dec(b.volume24h ?? '0').comparedTo(dec(a.volume24h ?? '0')));
        break;
      case 'mcap':
        assets.sort((a, b) =>
          dec(b.marketCap ?? b.volume24h ?? '0').comparedTo(dec(a.marketCap ?? a.volume24h ?? '0')),
        );
        break;
      case 'new':
        assets = assets
          .filter((a) => a.listedAt && this.now() - Date.parse(a.listedAt) <= 90 * 86_400_000)
          .sort((a, b) => Date.parse(b.listedAt ?? '') - Date.parse(a.listedAt ?? ''));
        break;
      case 'trending':
        assets = assets
          .filter((a) => !a.tags.includes('stablecoin'))
          .sort((a, b) => this.trendingScore(b) - this.trendingScore(a));
        break;
      default:
        break;
    }
    const offset = q.cursor ? Number(q.cursor) : 0;
    const limit = q.limit ?? 20;
    const items = assets.slice(offset, offset + limit);
    return { items, nextCursor: offset + limit < assets.length ? String(offset + limit) : null };
  }

  private trendingScore(asset: Asset): number {
    const state = this.states.get(asset.id);
    return (state?.trendScore ?? 0) + Math.abs(dec(asset.change24hPct).toNumber()) / 10;
  }

  async getAsset(symbolOrId: string): Promise<Asset> {
    await this.world.simulateLatency();
    const id = this.resolveId(symbolOrId);
    if (!id) throw new AppError('not_found', `Unknown asset ${symbolOrId}`);
    return this.assetSync(id);
  }

  async getCandles(assetId: string, range: CandleRange): Promise<Candle[]> {
    await this.world.simulateLatency();
    return this.candlesSync(assetId, range);
  }

  candlesSync(assetId: string, range: CandleRange): Candle[] {
    const id = this.resolveId(assetId);
    const state = id ? this.states.get(id) : undefined;
    if (!state) throw new AppError('not_found', `Unknown asset ${assetId}`);
    const { count, stepMs } = RANGE_SPEC[range];
    const r = rngFor(this.opts.seed, state.entry.id, range, 'candles');
    const sigma = state.entry.dailyVol * Math.sqrt(stepMs / 86_400_000);
    // Build a normalized path ending at 1.0, walking backwards.
    const values = new Array<number>(count + 1);
    values[count] = 1;
    for (let i = count; i > 0; i--) {
      values[i - 1] = (values[i] as number) / Math.exp(sigma * gaussian(r));
    }
    if (range === '1D') {
      // Pin the 1D path start to the 24h open so the chart matches the change.
      const target = dec(state.open24h).dividedBy(dec(state.price)).toNumber();
      const start = values[0] as number;
      const k = Math.log(target / start);
      for (let i = 0; i <= count; i++)
        values[i] = (values[i] as number) * Math.exp(k * (1 - i / count));
    }
    const end = this.now();
    const candles: Candle[] = [];
    for (let i = 1; i <= count; i++) {
      const o = values[i - 1] as number;
      const c = values[i] as number;
      const wick = Math.abs(gaussian(r)) * sigma * 0.35;
      const hi = Math.max(o, c) * (1 + wick);
      const lo = Math.min(o, c) * (1 - wick);
      const scale = (x: number) => roundPrice(mul(state.price, x.toFixed(12)));
      candles.push({
        time: end - (count - i) * stepMs,
        open: scale(o),
        high: scale(hi),
        low: scale(lo),
        close: i === count ? state.price : scale(c),
      });
    }
    return candles;
  }

  subscribePrices(assetIds: string[], cb: (tick: PriceTick) => void): Unsubscribe {
    const sub = { ids: assetIds.length ? new Set(assetIds) : null, cb };
    this.subscribers.add(sub);
    return () => {
      this.subscribers.delete(sub);
    };
  }

  /** Subscribe to every asset (used by the demo backend's engines). */
  subscribeAll(cb: (tick: PriceTick) => void): Unsubscribe {
    return this.subscribePrices([], cb);
  }

  exportPrices(): Record<string, { price: Decimal; open24h: Decimal }> {
    const out: Record<string, { price: Decimal; open24h: Decimal }> = {};
    for (const [id, s] of this.states) out[id] = { price: s.price, open24h: s.open24h };
    return out;
  }

  importPrices(prices: Record<string, { price: Decimal; open24h: Decimal }>): void {
    for (const [id, p] of Object.entries(prices)) {
      const s = this.states.get(id);
      if (s && dec(p.price).greaterThan(0)) {
        s.price = str(p.price);
        s.open24h = str(p.open24h);
      }
    }
  }

  /** Test/demo helper: force a price (e.g. to trigger liquidation). */
  setPrice(assetId: string, price: Decimal): void {
    const s = this.states.get(assetId);
    if (!s) throw new AppError('not_found', assetId);
    s.price = price;
    const tick: PriceTick = { assetId, price, change24hPct: this.change(s), time: this.now() };
    for (const sub of this.subscribers) if (!sub.ids || sub.ids.has(assetId)) sub.cb(tick);
  }
}
