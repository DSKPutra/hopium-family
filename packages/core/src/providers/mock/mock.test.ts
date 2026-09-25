import { dec, gt } from '../../money';
import { createMockProviders } from './index';
import { CRYPTO_CATALOG, PERP_BASES, STOCK_CATALOG, USDC_ID } from './catalog';

const make = () => createMockProviders({ latency: [0, 0], failureRate: 0, seed: 42 });

describe('catalog', () => {
  it('seeds 60 crypto assets, 40 stock tokens and 12 perp markets', () => {
    expect(CRYPTO_CATALOG).toHaveLength(60);
    expect(STOCK_CATALOG).toHaveLength(40);
    expect(STOCK_CATALOG.every((s) => s.symbol.endsWith('x'))).toBe(true);
    expect(PERP_BASES).toHaveLength(12);
    const symbols = new Set([...CRYPTO_CATALOG, ...STOCK_CATALOG].map((c) => c.symbol));
    expect(symbols.size).toBe(100);
    for (const s of ['HOPE', 'FAM', 'MOONCAT', 'BTC', 'ETH', 'SOL', 'USDC'])
      expect(symbols.has(s)).toBe(true);
  });
});

describe('MockMarketData', () => {
  it('is deterministic for a seed and ticks prices', async () => {
    const a = make();
    const b = make();
    expect(a.marketData.priceOf('hope')).toBe(b.marketData.priceOf('hope'));
    const before = a.marketData.priceOf('hope');
    const ticks: string[] = [];
    a.marketData.subscribePrices(['hope'], (t) => ticks.push(t.price));
    for (let i = 0; i < 20; i++) a.marketData.tick();
    expect(ticks.length).toBeGreaterThan(0);
    expect(a.marketData.priceOf('hope')).not.toBe(before);
    expect(a.marketData.priceOf('usdc')).toBe('1');
  });

  it('generates stable candles ending at the live price', async () => {
    const { marketData } = make();
    const c1 = await marketData.getCandles('btc', '1D');
    const c2 = await marketData.getCandles('btc', '1D');
    expect(c1.map((c) => c.close)).toEqual(c2.map((c) => c.close));
    expect(c1.at(-1)?.close).toBe(marketData.priceOf('btc'));
    expect((await marketData.getCandles('eth', '1Y')).length).toBe(365);
  });

  it('lists, filters, sorts and paginates', async () => {
    const { marketData } = make();
    const stocks = await marketData.listAssets({ class: 'stock_token', limit: 50 });
    expect(stocks.items).toHaveLength(40);
    const gainers = await marketData.listAssets({ sort: 'gainers', limit: 5 });
    expect(
      dec(gainers.items[0]!.change24hPct).greaterThanOrEqualTo(dec(gainers.items[4]!.change24hPct)),
    ).toBe(true);
    const page1 = await marketData.listAssets({ limit: 10 });
    expect(page1.nextCursor).toBe('10');
    const search = await marketData.listAssets({ search: '$hope' });
    expect(search.items[0]?.symbol).toBe('HOPE');
    expect((await marketData.getAsset('AAPLx')).underlyingName).toBe('Apple Inc.');
    await expect(marketData.getAsset('NOPE')).rejects.toThrow();
    expect((await marketData.listAssets({ sort: 'new' })).items.length).toBeGreaterThan(0);
  });
});

describe('mock trading venues', () => {
  it('swaps USDC for a memecoin and back', async () => {
    const p = make();
    const session = await p.wallet.login('email', { email: 'a@b.co', otp: '123456' });
    p.wallet.fundNewAccount(session.userId, []);
    const q = await p.swap.quote({
      from: USDC_ID,
      to: 'hope',
      amountIn: '25',
      slippageBps: 100,
      chain: 'solana',
      feeBps: 75,
    });
    expect(q.gasSponsored).toBe(true);
    const tx = await p.swap.execute(q);
    expect(tx.status).toBe('confirmed');
    expect(p.world.balance(session.userId, USDC_ID)).toBe('9974.8125');
    expect(gt(p.world.balance(session.userId, 'hope'), 0)).toBe(true);
  });

  it('rejects expired quotes and insufficient balance', async () => {
    const p = make();
    await p.wallet.login('google');
    const q = await p.swap.quote({
      from: USDC_ID,
      to: 'sol',
      amountIn: '25',
      slippageBps: 100,
      chain: 'solana',
    });
    await expect(p.swap.execute(q)).rejects.toMatchObject({ code: 'insufficient_balance' });
    await expect(p.swap.execute({ ...q, expiresAt: 0 })).rejects.toMatchObject({
      code: 'quote_expired',
    });
  });

  it('fails a configurable fraction of orders with realistic errors', async () => {
    const p = createMockProviders({ latency: [0, 0], failureRate: 1, seed: 1 });
    const s = await p.wallet.login('google');
    p.wallet.fundNewAccount(s.userId, []);
    const q = await p.swap.quote({
      from: USDC_ID,
      to: 'sol',
      amountIn: '25',
      slippageBps: 100,
      chain: 'solana',
    });
    await expect(p.swap.execute(q)).rejects.toMatchObject({
      code: expect.stringMatching(/slippage_exceeded|network_busy|insufficient_balance/),
    });
  });

  it('buys and sells stock tokens 24/7', async () => {
    const p = make();
    const s = await p.wallet.login('apple');
    p.wallet.fundNewAccount(s.userId, []);
    const buy = await p.stockTokens.quote({
      assetId: 'aaplx',
      side: 'buy',
      notionalUsd: '100',
      feeRate: '0.0075',
    });
    await p.stockTokens.execute(buy);
    const qty = p.world.balance(s.userId, 'aaplx');
    expect(gt(qty, 0)).toBe(true);
    const sell = await p.stockTokens.quote({ assetId: 'aaplx', side: 'sell', notionalUsd: '50' });
    await p.stockTokens.execute({ ...sell, qty: qty });
    expect(p.world.balance(s.userId, 'aaplx')).toBe('0');
  });
});

describe('MockPerps', () => {
  it('opens, marks, partially closes and liquidates', async () => {
    const p = make();
    const s = await p.wallet.login('google');
    p.wallet.fundNewAccount(s.userId, []);
    const markets = await p.perps.listMarkets();
    expect(markets).toHaveLength(12);
    const btc = markets.find((m) => m.id === 'btc-perp')!;
    const pos = await p.perps.openPosition({
      marketId: 'btc-perp',
      side: 'long',
      marginUsd: '100',
      leverage: 10,
    });
    expect(pos.leverage).toBe(10);
    expect(dec(pos.liqPrice).lessThan(dec(btc.markPrice))).toBe(true);
    await p.perps.closePosition(pos.id, 50);
    const [half] = await p.perps.getPositions();
    expect(half?.margin).toBe('50');
    const events: string[] = [];
    p.perps.subscribeEvents((e) => events.push(e.type));
    p.marketData.setPrice('btc', dec(half!.liqPrice).times(0.99).toFixed(2));
    p.perps.evaluate();
    expect(events).toContain('liquidated');
    expect(await p.perps.getPositions()).toHaveLength(0);
  });

  it('enforces leverage bounds and TP/SL rules', async () => {
    const p = make();
    const s = await p.wallet.login('google');
    p.wallet.fundNewAccount(s.userId, []);
    await expect(
      p.perps.openPosition({ marketId: 'hope-perp', side: 'long', marginUsd: '10', leverage: 15 }),
    ).rejects.toMatchObject({ code: 'leverage_out_of_range' });
    const mark = p.marketData.priceOf('eth');
    await expect(
      p.perps.openPosition({
        marketId: 'eth-perp',
        side: 'long',
        marginUsd: '10',
        leverage: 3,
        tp: dec(mark).times(0.9).toFixed(2),
      }),
    ).rejects.toMatchObject({ code: 'invalid_tp' });
  });
});

describe('onramp & kyc', () => {
  it('quotes IDR and credits USDC on purchase', async () => {
    const p = make();
    const s = await p.wallet.login('google');
    const q = await p.onramp.getQuote({
      fiat: 'IDR',
      fiatAmount: '1625000',
      asset: USDC_ID,
      chain: 'solana',
    });
    expect(q.cryptoAmount).toBe('98.01');
    await p.onramp.startPurchase(q, 'card');
    expect(p.world.balance(s.userId, USDC_ID)).toBe('98.01');
  });

  it('approves KYC after a delay', async () => {
    jest.useFakeTimers();
    const p = createMockProviders({ latency: [0, 0], kycApproveAfterMs: 3000 });
    await p.wallet.login('google');
    await p.kyc.start();
    expect(await p.kyc.getStatus()).toBe('pending');
    jest.advanceTimersByTime(3000);
    expect(await p.kyc.getStatus()).toBe('approved');
    jest.useRealTimers();
  });
});
