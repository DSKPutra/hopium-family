/**
 * Live provider implementations. Read paths talk to public APIs; anything that
 * signs or moves funds goes through the embedded wallet adapter or our Supabase
 * edge functions (which hold server-only secrets). Missing configuration throws
 * a user-friendly ProviderNotConfiguredError instead of failing silently.
 */
import { explorerUrl } from '../../chains';
import { AppError, ProviderNotConfiguredError } from '../../errors';
import { dec, div, mul, pctChange, round, str } from '../../money';
import type {
  Asset,
  Balance,
  Candle,
  CandleRange,
  Chain,
  Decimal,
  Fiat,
  KycStatus,
  OnrampQuote,
  OnrampResult,
  OpenPerpParams,
  Page,
  PaymentMethod,
  PerpMarket,
  PerpPosition,
  PriceTick,
  Session,
  Side,
  StockQuote,
  SwapQuote,
  TxResult,
  UnsignedTx,
  Unsubscribe,
} from '../../types';
import type {
  AnalyticsProvider,
  KycProvider,
  ListAssetsQuery,
  LoginMethod,
  MarketDataProvider,
  OnrampProvider,
  PerpsProvider,
  StockTokenProvider,
  SwapProvider,
  WalletProvider,
} from '../interfaces';
import { getJson, requireEnv, type FetchLike } from './http';

export type { FetchLike } from './http';

// ─── Wallet (Privy / Dynamic / Turnkey) ─────────────────────────────────────

/**
 * Embedded-wallet SDKs are React-bound, so the app registers an adapter from
 * its provider tree (e.g. `@privy-io/expo`) and this class delegates to it.
 */
export interface WalletAdapter extends WalletProvider {
  readonly name: 'privy' | 'dynamic' | 'turnkey';
}

let registeredWalletAdapter: WalletAdapter | null = null;
export function registerWalletAdapter(adapter: WalletAdapter | null): void {
  registeredWalletAdapter = adapter;
}

export class RealWalletProvider implements WalletProvider {
  constructor(private config: { provider: string; appId?: string }) {}

  private adapter(): WalletAdapter {
    requireEnv(`${this.config.provider} wallet`, { EXPO_PUBLIC_WALLET_APP_ID: this.config.appId });
    if (!registeredWalletAdapter || registeredWalletAdapter.name !== this.config.provider) {
      throw new ProviderNotConfiguredError(
        `${this.config.provider} wallet`,
        ['wallet adapter'],
        `register the ${this.config.provider} SDK adapter with registerWalletAdapter()`,
      );
    }
    return registeredWalletAdapter;
  }

  login(method: LoginMethod, payload?: { email?: string; otp?: string }): Promise<Session> {
    return this.adapter().login(method, payload);
  }
  logout(): Promise<void> {
    return this.adapter().logout();
  }
  getAddresses(): Promise<Record<Chain, string>> {
    return this.adapter().getAddresses();
  }
  getBalances(): Promise<Balance[]> {
    return this.adapter().getBalances();
  }
  signAndSend(tx: UnsignedTx): Promise<TxResult> {
    return this.adapter().signAndSend(tx);
  }
  exportWallet(): Promise<void> {
    return this.adapter().exportWallet();
  }
}

// ─── Market data (CoinGecko) ────────────────────────────────────────────────

interface CoinGeckoMarket {
  id: string;
  symbol: string;
  name: string;
  image: string;
  current_price: number;
  price_change_percentage_24h: number | null;
  market_cap: number | null;
  total_volume: number | null;
}

const RANGE_DAYS: Record<CandleRange, string> = {
  '1H': '1',
  '1D': '1',
  '1W': '7',
  '1M': '30',
  '1Y': '365',
  ALL: 'max',
};

export class CoinGeckoMarketData implements MarketDataProvider {
  private cache = new Map<string, Asset>();
  constructor(
    private fetchImpl: FetchLike,
    private config: { apiKey?: string; pollMs?: number } = {},
  ) {}

  private headers(): Record<string, string> {
    return this.config.apiKey ? { 'x-cg-demo-api-key': this.config.apiKey } : {};
  }

  private toAsset(m: CoinGeckoMarket): Asset {
    const asset: Asset = {
      id: m.id,
      symbol: m.symbol.toUpperCase(),
      name: m.name,
      class: 'crypto',
      logoUrl: m.image,
      decimals: 18,
      price: str(m.current_price),
      change24hPct: str(m.price_change_percentage_24h ?? 0),
      marketCap: m.market_cap ? str(m.market_cap) : undefined,
      volume24h: m.total_volume ? str(m.total_volume) : undefined,
      tags: [],
    };
    this.cache.set(asset.id, asset);
    return asset;
  }

  lastPrice(assetId: string): Decimal | undefined {
    return this.cache.get(assetId)?.price;
  }

  async listAssets(q: ListAssetsQuery): Promise<Page<Asset>> {
    if (q.class && q.class !== 'crypto') return { items: [], nextCursor: null };
    const page = q.cursor ? Number(q.cursor) : 1;
    const order = q.sort === 'volume' ? 'volume_desc' : 'market_cap_desc';
    const markets = await getJson<CoinGeckoMarket[]>(
      this.fetchImpl,
      `https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=${order}&per_page=${q.limit ?? 20}&page=${page}&price_change_percentage=24h`,
      { headers: this.headers() },
    );
    let items = markets.map((m) => this.toAsset(m));
    if (q.search) {
      const s = q.search.toLowerCase();
      items = items.filter(
        (a) => a.symbol.toLowerCase().includes(s) || a.name.toLowerCase().includes(s),
      );
    }
    if (q.sort === 'gainers')
      items.sort((a, b) => dec(b.change24hPct).comparedTo(dec(a.change24hPct)));
    if (q.sort === 'losers')
      items.sort((a, b) => dec(a.change24hPct).comparedTo(dec(b.change24hPct)));
    return { items, nextCursor: markets.length ? String(page + 1) : null };
  }

  async getAsset(symbolOrId: string): Promise<Asset> {
    const cached = this.cache.get(symbolOrId.toLowerCase());
    if (cached) return cached;
    const [m] = await getJson<CoinGeckoMarket[]>(
      this.fetchImpl,
      `https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=${encodeURIComponent(symbolOrId.toLowerCase())}`,
      { headers: this.headers() },
    );
    if (!m) throw new AppError('not_found', `Unknown asset ${symbolOrId}`);
    return this.toAsset(m);
  }

  async getCandles(assetId: string, range: CandleRange): Promise<Candle[]> {
    const rows = await getJson<[number, number, number, number, number][]>(
      this.fetchImpl,
      `https://api.coingecko.com/api/v3/coins/${encodeURIComponent(assetId)}/ohlc?vs_currency=usd&days=${RANGE_DAYS[range]}`,
      { headers: this.headers() },
    );
    const cutoff = range === '1H' ? Date.now() - 3_600_000 : 0;
    return rows
      .filter(([t]) => t >= cutoff)
      .map(([time, o, h, l, c]) => ({
        time,
        open: str(o),
        high: str(h),
        low: str(l),
        close: str(c),
      }));
  }

  subscribePrices(assetIds: string[], cb: (tick: PriceTick) => void): Unsubscribe {
    let stopped = false;
    const poll = async () => {
      if (stopped || assetIds.length === 0) return;
      try {
        const data = await getJson<Record<string, { usd: number; usd_24h_change?: number }>>(
          this.fetchImpl,
          `https://api.coingecko.com/api/v3/simple/price?ids=${assetIds.map(encodeURIComponent).join(',')}&vs_currencies=usd&include_24hr_change=true`,
          { headers: this.headers() },
        );
        for (const [assetId, v] of Object.entries(data)) {
          cb({
            assetId,
            price: str(v.usd),
            change24hPct: str(v.usd_24h_change ?? 0),
            time: Date.now(),
          });
        }
      } catch {
        // Transient polling errors are retried on the next interval.
      }
    };
    void poll();
    const timer = setInterval(poll, this.config.pollMs ?? 15_000);
    return () => {
      stopped = true;
      clearInterval(timer);
    };
  }
}

// ─── Swaps (Jupiter for Solana, LI.FI for EVM) ─────────────────────────────

interface JupiterQuote {
  inAmount: string;
  outAmount: string;
  priceImpactPct: string;
  slippageBps: number;
}

interface LifiQuote {
  estimate: { fromAmount: string; toAmount: string; gasCosts?: { amountUSD: string }[] };
  transactionRequest?: { to: string; data: string; value: string };
}

export class RealSwapProvider implements SwapProvider {
  private raw = new Map<string, JupiterQuote | LifiQuote>();
  constructor(
    private fetchImpl: FetchLike,
    private wallet: WalletProvider,
    private resolveToken: (assetId: string, chain: Chain) => { address: string; decimals: number },
    private config: { feeAccount?: string; integrator?: string } = {},
  ) {}

  async quote(p: {
    from: string;
    to: string;
    amountIn: Decimal;
    slippageBps: number;
    chain: Chain;
    feeBps?: number;
  }): Promise<SwapQuote> {
    const from = this.resolveToken(p.from, p.chain);
    const to = this.resolveToken(p.to, p.chain);
    const baseUnits = round(mul(p.amountIn, dec(10).pow(from.decimals).toFixed()), 0, 'down');
    const id = `${p.chain}:${Date.now()}`;
    if (p.chain === 'solana') {
      const fee = p.feeBps && this.config.feeAccount ? `&platformFeeBps=${p.feeBps}` : '';
      const q = await getJson<JupiterQuote>(
        this.fetchImpl,
        `https://lite-api.jup.ag/swap/v1/quote?inputMint=${from.address}&outputMint=${to.address}&amount=${baseUnits}&slippageBps=${p.slippageBps}${fee}`,
      );
      this.raw.set(id, q);
      const amountOut = div(q.outAmount, dec(10).pow(to.decimals).toFixed());
      return {
        id,
        from: p.from,
        to: p.to,
        chain: p.chain,
        amountIn: p.amountIn,
        amountOut,
        price: div(p.amountIn, amountOut),
        priceImpactPct: str(dec(q.priceImpactPct).times(100)),
        slippageBps: p.slippageBps,
        networkFeeUsd: '0',
        gasSponsored: true,
        expiresAt: Date.now() + 15_000,
      };
    }
    const chainIds: Record<Chain, number> = {
      ethereum: 1,
      base: 8453,
      arbitrum: 42161,
      robinhood: 0,
      solana: 0,
    };
    if (!chainIds[p.chain])
      throw new AppError('not_found', `Swaps are not supported on ${p.chain}`);
    const addresses = await this.wallet.getAddresses();
    const fee = p.feeBps ? `&fee=${p.feeBps / 10_000}` : '';
    const q = await getJson<LifiQuote>(
      this.fetchImpl,
      `https://li.quest/v1/quote?fromChain=${chainIds[p.chain]}&toChain=${chainIds[p.chain]}&fromToken=${from.address}&toToken=${to.address}&fromAmount=${baseUnits}&fromAddress=${addresses[p.chain]}&slippage=${p.slippageBps / 10_000}&integrator=${this.config.integrator ?? 'hopium'}${fee}`,
    );
    this.raw.set(id, q);
    const amountOut = div(q.estimate.toAmount, dec(10).pow(to.decimals).toFixed());
    const gas =
      q.estimate.gasCosts?.reduce((acc, g) => acc.plus(dec(g.amountUSD)), dec(0)) ?? dec(0);
    return {
      id,
      from: p.from,
      to: p.to,
      chain: p.chain,
      amountIn: p.amountIn,
      amountOut,
      price: div(p.amountIn, amountOut),
      priceImpactPct: '0',
      slippageBps: p.slippageBps,
      networkFeeUsd: str(gas),
      gasSponsored: gas.isZero(),
      expiresAt: Date.now() + 15_000,
    };
  }

  async execute(quote: SwapQuote): Promise<TxResult> {
    if (Date.now() > quote.expiresAt) throw new AppError('quote_expired');
    const raw = this.raw.get(quote.id);
    if (!raw) throw new AppError('quote_expired');
    if (quote.chain === 'solana') {
      const addresses = await this.wallet.getAddresses();
      const built = await getJson<{ swapTransaction: string }>(
        this.fetchImpl,
        'https://lite-api.jup.ag/swap/v1/swap',
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            quoteResponse: raw,
            userPublicKey: addresses.solana,
            feeAccount: this.config.feeAccount,
          }),
        },
      );
      return this.wallet.signAndSend({
        chain: 'solana',
        to: 'jupiter',
        data: built.swapTransaction,
      });
    }
    const req = (raw as LifiQuote).transactionRequest;
    if (!req) throw new AppError('network_busy', 'Route unavailable, please refresh the quote.');
    return this.wallet.signAndSend({
      chain: quote.chain,
      to: req.to,
      data: req.data,
      value: req.value,
    });
  }
}

// ─── Stock tokens (Robinhood Chain venue REST contract) ─────────────────────

export class RealStockTokenProvider implements StockTokenProvider {
  constructor(
    private fetchImpl: FetchLike,
    private wallet: WalletProvider,
    private config: { apiUrl?: string },
  ) {}

  private base(): string {
    return requireEnv('Stock token venue', { EXPO_PUBLIC_STOCKTOKEN_API_URL: this.config.apiUrl })
      .EXPO_PUBLIC_STOCKTOKEN_API_URL as string;
  }

  listStockTokens(): Promise<Asset[]> {
    return getJson<Asset[]>(this.fetchImpl, `${this.base()}/v1/stock-tokens`);
  }

  quote(p: {
    assetId: string;
    side: Side;
    notionalUsd: Decimal;
    feeRate?: Decimal;
  }): Promise<StockQuote> {
    return getJson<StockQuote>(this.fetchImpl, `${this.base()}/v1/quotes`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(p),
    });
  }

  async execute(q: StockQuote): Promise<TxResult> {
    const tx = await getJson<UnsignedTx>(
      this.fetchImpl,
      `${this.base()}/v1/quotes/${encodeURIComponent(q.id)}/transaction`,
    );
    return this.wallet.signAndSend(tx);
  }

  async transfer(p: { assetId: string; amount: Decimal; to: string }): Promise<TxResult> {
    const tx = await getJson<UnsignedTx>(this.fetchImpl, `${this.base()}/v1/transfers`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(p),
    });
    return this.wallet.signAndSend(tx);
  }
}

// ─── Perps (Hyperliquid) ────────────────────────────────────────────────────

interface HlMeta {
  universe: { name: string; maxLeverage: number; szDecimals: number }[];
}
interface HlCtx {
  markPx: string;
  oraclePx: string;
  prevDayPx: string;
  funding: string;
  openInterest: string;
}
interface HlClearinghouse {
  assetPositions: {
    position: {
      coin: string;
      szi: string;
      entryPx: string;
      leverage: { value: number };
      liquidationPx: string | null;
      marginUsed: string;
      unrealizedPnl: string;
      returnOnEquity: string;
    };
  }[];
}

export class HyperliquidPerps implements PerpsProvider {
  constructor(
    private fetchImpl: FetchLike,
    private wallet: WalletProvider,
    private config: { exchangeProxyUrl?: string; takerFeeRate?: Decimal } = {},
  ) {}

  private info<T>(body: object): Promise<T> {
    return getJson<T>(this.fetchImpl, 'https://api.hyperliquid.xyz/info', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
  }

  async listMarkets(): Promise<PerpMarket[]> {
    const [meta, ctxs] = await this.info<[HlMeta, HlCtx[]]>({ type: 'metaAndAssetCtxs' });
    const hour = 3_600_000;
    return meta.universe.slice(0, 40).map((u, i) => {
      const c = ctxs[i] as HlCtx;
      return {
        id: `${u.name.toLowerCase()}-perp`,
        symbol: `${u.name}-PERP`,
        baseAssetId: u.name.toLowerCase(),
        name: `${u.name} Perpetual`,
        markPrice: c.markPx,
        indexPrice: c.oraclePx,
        change24hPct: pctChange(c.prevDayPx, c.markPx),
        maxLeverage: u.maxLeverage,
        maintenanceMarginRate: str(dec(1).dividedBy(u.maxLeverage * 2)),
        takerFeeRate: this.config.takerFeeRate ?? '0.00035',
        makerFeeRate: '0.0001',
        fundingRate: c.funding,
        nextFundingAt: Math.ceil(Date.now() / hour) * hour,
        openInterestUsd: mul(c.openInterest, c.markPx),
      };
    });
  }

  async getPositions(): Promise<PerpPosition[]> {
    const { arbitrum } = await this.wallet.getAddresses();
    const state = await this.info<HlClearinghouse>({ type: 'clearinghouseState', user: arbitrum });
    return state.assetPositions.map(({ position: p }) => ({
      id: `${arbitrum}:${p.coin}`,
      userId: arbitrum,
      marketId: `${p.coin.toLowerCase()}-perp`,
      symbol: `${p.coin}-PERP`,
      side: dec(p.szi).isNegative() ? 'short' : 'long',
      size: str(dec(p.szi).abs()),
      entryPrice: p.entryPx,
      markPrice: p.entryPx,
      leverage: p.leverage.value,
      margin: p.marginUsed,
      liqPrice: p.liquidationPx ?? '0',
      tp: null,
      sl: null,
      unrealizedPnl: p.unrealizedPnl,
      roePct: str(dec(p.returnOnEquity).times(100)),
      realizedPnl: '0',
      status: 'open',
      openedAt: new Date().toISOString(),
      closedAt: null,
    }));
  }

  /** Order placement is signed server-side by an agent wallet in our edge function. */
  private exchange<T>(action: object): Promise<T> {
    const url = requireEnv(
      'Hyperliquid trading',
      { EXPO_PUBLIC_PERPS_EXCHANGE_URL: this.config.exchangeProxyUrl },
      'deploy the open-perp edge function',
    ).EXPO_PUBLIC_PERPS_EXCHANGE_URL as string;
    return getJson<T>(this.fetchImpl, url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(action),
    });
  }

  openPosition(p: OpenPerpParams): Promise<PerpPosition> {
    return this.exchange<PerpPosition>({ type: 'open', ...p });
  }
  closePosition(positionId: string, sizePct = 100): Promise<TxResult> {
    return this.exchange<TxResult>({ type: 'close', positionId, sizePct });
  }
  async setTpSl(positionId: string, tp?: Decimal, sl?: Decimal): Promise<void> {
    await this.exchange<unknown>({ type: 'tpsl', positionId, tp, sl });
  }

  subscribePositions(cb: (positions: PerpPosition[]) => void): Unsubscribe {
    let stopped = false;
    const poll = async () => {
      if (stopped) return;
      try {
        cb(await this.getPositions());
      } catch {
        // Retried on the next interval.
      }
    };
    void poll();
    const timer = setInterval(poll, 5000);
    return () => {
      stopped = true;
      clearInterval(timer);
    };
  }
}

// ─── On-ramp (MoonPay) ──────────────────────────────────────────────────────

export class MoonPayOnramp implements OnrampProvider {
  constructor(
    private fetchImpl: FetchLike,
    private openBrowser: (url: string) => Promise<'completed' | 'cancelled'>,
    private config: {
      publishableKey?: string;
      signUrlEndpoint?: string;
      walletAddress: () => Promise<string>;
    },
  ) {}

  async getQuote(p: {
    fiat: Fiat;
    fiatAmount: Decimal;
    asset: string;
    chain: Chain;
  }): Promise<OnrampQuote> {
    const { key } = {
      key: requireEnv('MoonPay', { EXPO_PUBLIC_ONRAMP_KEY: this.config.publishableKey })
        .EXPO_PUBLIC_ONRAMP_KEY,
    };
    const code = `${p.asset}_${p.chain === 'solana' ? 'sol' : p.chain}`.toLowerCase();
    const q = await getJson<{
      quoteCurrencyAmount: number;
      feeAmount: number;
      networkFeeAmount: number;
      quoteCurrencyPrice: number;
    }>(
      this.fetchImpl,
      `https://api.moonpay.com/v3/currencies/${code}/buy_quote?apiKey=${key}&baseCurrencyCode=${p.fiat.toLowerCase()}&baseCurrencyAmount=${p.fiatAmount}`,
    );
    return {
      id: `mp:${Date.now()}`,
      fiat: p.fiat,
      fiatAmount: p.fiatAmount,
      asset: p.asset,
      chain: p.chain,
      cryptoAmount: str(q.quoteCurrencyAmount),
      feeFiat: str(q.feeAmount + q.networkFeeAmount),
      rate: str(q.quoteCurrencyPrice),
      expiresAt: Date.now() + 60_000,
    };
  }

  async startPurchase(q: OnrampQuote, method: PaymentMethod): Promise<OnrampResult> {
    const endpoint = requireEnv(
      'MoonPay',
      { onramp_sign_endpoint: this.config.signUrlEndpoint },
      'deploy the onramp signing edge function',
    ).onramp_sign_endpoint as string;
    const address = await this.config.walletAddress();
    const { url } = await getJson<{ url: string }>(this.fetchImpl, endpoint, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ quote: q, method, walletAddress: address }),
    });
    const outcome = await this.openBrowser(url);
    return {
      status: outcome === 'completed' ? 'pending' : 'cancelled',
      cryptoAmount: q.cryptoAmount,
      asset: q.asset,
      reference: q.id,
    };
  }
}

// ─── KYC (Sumsub / Persona hosted flow via edge function) ───────────────────

export class HostedKycProvider implements KycProvider {
  constructor(
    private fetchImpl: FetchLike,
    private openBrowser: (url: string) => Promise<'completed' | 'cancelled'>,
    private config: { endpoint?: string; authHeader: () => Promise<Record<string, string>> },
  ) {}

  private url(): string {
    return requireEnv(
      'KYC provider',
      { kyc_endpoint: this.config.endpoint },
      'deploy the kyc edge function',
    ).kyc_endpoint as string;
  }

  async getStatus(): Promise<KycStatus> {
    const res = await getJson<{ status: KycStatus }>(this.fetchImpl, `${this.url()}/status`, {
      headers: await this.config.authHeader(),
    });
    return res.status;
  }

  async start(): Promise<void> {
    const res = await getJson<{ url: string }>(this.fetchImpl, `${this.url()}/start`, {
      method: 'POST',
      headers: await this.config.authHeader(),
    });
    await this.openBrowser(res.url);
  }
}

// ─── Analytics (PostHog) ────────────────────────────────────────────────────

export class PostHogAnalytics implements AnalyticsProvider {
  private distinctId = 'anonymous';
  constructor(
    private fetchImpl: FetchLike,
    private config: { apiKey: string; host?: string },
  ) {}

  private send(event: string, properties: Record<string, string | number | boolean> = {}): void {
    void this.fetchImpl(`${this.config.host ?? 'https://us.i.posthog.com'}/capture/`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        api_key: this.config.apiKey,
        event,
        distinct_id: this.distinctId,
        properties,
      }),
    }).catch(() => undefined);
  }

  identify(userId: string, traits?: Record<string, string | number | boolean>): void {
    this.distinctId = userId;
    this.send('$identify', traits);
  }
  track(event: string, props?: Record<string, string | number | boolean>): void {
    this.send(event, props);
  }
  screen(name: string): void {
    this.send('$screen', { $screen_name: name });
  }
  reset(): void {
    this.distinctId = 'anonymous';
  }
}

export const txExplorer = explorerUrl;
