import type { MockMarketData } from '../mock/marketData';
import type { FetchLike } from '../real/http';
import { COINGECKO_IDS } from './coingeckoIds';

export interface LivePriceStatus {
  /** Assets anchored to a real price on the last successful refresh. */
  liveCount: number;
  /** Epoch ms of the last successful refresh, null until the first one. */
  updatedAt: number | null;
  /** Set while the feed is failing; the demo keeps simulating meanwhile. */
  error: string | null;
}

export interface LivePriceFeedOptions {
  market: MockMarketData;
  fetch: FetchLike;
  /** Refresh cadence. CoinGecko's free tier allows ~30 calls/min per IP. */
  intervalMs?: number;
  /** Longest wait after repeated failures. */
  maxBackoffMs?: number;
  /** Catalog id → CoinGecko id. */
  ids?: Readonly<Record<string, string>>;
  onStatus?: (status: LivePriceStatus) => void;
  now?: () => number;
}

type SimplePrice = Record<string, { usd?: number; usd_24h_change?: number }>;

const ENDPOINT = 'https://api.coingecko.com/api/v3/simple/price';

/**
 * Demo mode with real prices: periodically pulls CoinGecko's free public
 * prices (no key) and anchors the simulated market to them, so BTC, ETH,
 * stock tokens and the perps built on them show real market prices while
 * trading stays simulated. Fictional demo tokens keep their simulated prices.
 */
export class LivePriceFeed {
  private timer: ReturnType<typeof setTimeout> | null = null;
  private failures = 0;
  private stopped = true;
  private readonly ids: Readonly<Record<string, string>>;
  private readonly intervalMs: number;
  private readonly maxBackoffMs: number;
  private readonly now: () => number;
  status: LivePriceStatus = { liveCount: 0, updatedAt: null, error: null };

  constructor(private opts: LivePriceFeedOptions) {
    this.ids = opts.ids ?? COINGECKO_IDS;
    this.intervalMs = opts.intervalMs ?? 60_000;
    this.maxBackoffMs = opts.maxBackoffMs ?? 10 * 60_000;
    this.now = opts.now ?? Date.now;
  }

  start(): void {
    if (!this.stopped) return;
    this.stopped = false;
    void this.loop();
  }

  stop(): void {
    this.stopped = true;
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
  }

  /** One fetch + anchor pass. Resolves to the number of assets anchored. */
  async refresh(): Promise<number> {
    const entries = Object.entries(this.ids);
    const query = [...new Set(entries.map(([, id]) => id))].map(encodeURIComponent).join(',');
    const res = await this.opts.fetch(
      `${ENDPOINT}?ids=${query}&vs_currencies=usd&include_24hr_change=true`,
    );
    if (res.status === 429) throw new Error('rate_limited');
    if (!res.ok) throw new Error(`http_${res.status}`);
    const data = (await res.json()) as SimplePrice;
    let count = 0;
    for (const [assetId, cgId] of entries) {
      const quote = data[cgId];
      if (typeof quote?.usd !== 'number') continue;
      if (this.opts.market.anchorPrice(assetId, quote.usd, quote.usd_24h_change ?? 0)) count += 1;
    }
    return count;
  }

  private async loop(): Promise<void> {
    if (this.stopped) return;
    let delay = this.intervalMs;
    try {
      const liveCount = await this.refresh();
      this.failures = 0;
      this.setStatus({ liveCount, updatedAt: this.now(), error: null });
    } catch (err) {
      this.failures += 1;
      delay = Math.min(this.intervalMs * 2 ** this.failures, this.maxBackoffMs);
      this.setStatus({ ...this.status, error: err instanceof Error ? err.message : 'failed' });
    }
    if (!this.stopped) this.timer = setTimeout(() => void this.loop(), delay);
  }

  private setStatus(status: LivePriceStatus): void {
    this.status = status;
    this.opts.onStatus?.(status);
  }
}
