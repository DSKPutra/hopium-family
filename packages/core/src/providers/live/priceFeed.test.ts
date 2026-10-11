import { dec } from '../../money';
import { createMockProviders } from '../mock';
import type { FetchLike } from '../real/http';
import { COINGECKO_IDS } from './coingeckoIds';
import { LivePriceFeed, type LivePriceStatus } from './priceFeed';

const reply =
  (status: number, body: unknown): FetchLike =>
  async () => ({ ok: status >= 200 && status < 300, status, json: async () => body });

const setup = () => createMockProviders({ latency: [0, 0], failureRate: 0, seed: 3 }).marketData;

describe('LivePriceFeed', () => {
  it('anchors real assets to CoinGecko prices and 24h change', async () => {
    const market = setup();
    const urls: string[] = [];
    const feed = new LivePriceFeed({
      market,
      ids: { btc: 'bitcoin', aaplx: 'apple-xstock', hope: 'not-listed' },
      fetch: async (url) => {
        urls.push(url);
        return reply(200, {
          bitcoin: { usd: 82907, usd_24h_change: 2.5 },
          'apple-xstock': { usd: 337.19, usd_24h_change: -1 },
        })(url);
      },
    });
    expect(await feed.refresh()).toBe(2);
    expect(urls[0]).toContain('ids=bitcoin,apple-xstock,not-listed');
    expect(market.priceOf('btc')).toBe('82907');
    expect(dec(market.assetSync('btc').change24hPct).toFixed(2)).toBe('2.50');
    expect(market.assetSync('btc').priceSource).toBe('live');
    expect(market.priceOf('aaplx')).toBe('337.19');
    // Fictional demo tokens keep simulating.
    expect(market.assetSync('hope').priceSource).toBe('simulated');
  });

  it('keeps anchored assets near the real price as the simulation ticks', async () => {
    const market = setup();
    const feed = new LivePriceFeed({
      market,
      ids: { btc: 'bitcoin' },
      fetch: reply(200, { bitcoin: { usd: 80000, usd_24h_change: 0 } }),
    });
    await feed.refresh();
    for (let i = 0; i < 200; i++) market.tick();
    const drift = Math.abs(dec(market.priceOf('btc')).dividedBy(80000).toNumber() - 1);
    expect(drift).toBeLessThan(0.005);
  });

  it('ignores missing or invalid quotes', async () => {
    const market = setup();
    const before = market.priceOf('eth');
    const feed = new LivePriceFeed({
      market,
      ids: { eth: 'ethereum', sol: 'solana' },
      fetch: reply(200, { ethereum: {}, solana: { usd: -1 } }),
    });
    expect(await feed.refresh()).toBe(0);
    expect(market.priceOf('eth')).toBe(before);
  });

  it('reports failures and backs off without throwing', async () => {
    jest.useFakeTimers();
    const market = setup();
    const statuses: LivePriceStatus[] = [];
    let calls = 0;
    const feed = new LivePriceFeed({
      market,
      intervalMs: 1000,
      ids: { btc: 'bitcoin' },
      fetch: async (url) => {
        calls += 1;
        return calls === 1 ? reply(429, {})(url) : reply(200, { bitcoin: { usd: 1 } })(url);
      },
      onStatus: (s) => statuses.push(s),
    });
    feed.start();
    await jest.advanceTimersByTimeAsync(0);
    expect(statuses.at(-1)?.error).toBe('rate_limited');
    // Backoff doubles the interval: nothing at 1s, retry by 2s.
    await jest.advanceTimersByTimeAsync(1000);
    expect(calls).toBe(1);
    await jest.advanceTimersByTimeAsync(1000);
    expect(calls).toBe(2);
    expect(statuses.at(-1)).toMatchObject({ liveCount: 1, error: null });
    feed.stop();
    jest.useRealTimers();
  });

  it('maps every id to a catalog asset', () => {
    const market = setup();
    for (const assetId of Object.keys(COINGECKO_IDS))
      expect(market.resolveId(assetId)).toBe(assetId);
  });
});
