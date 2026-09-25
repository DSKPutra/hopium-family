import type {
  Asset,
  AssetClass,
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
} from '../types';

export type LoginMethod = 'apple' | 'google' | 'email';

export interface WalletProvider {
  login(method: LoginMethod, payload?: { email?: string; otp?: string }): Promise<Session>;
  logout(): Promise<void>;
  getAddresses(): Promise<Record<Chain, string>>;
  getBalances(): Promise<Balance[]>;
  /** Gas sponsored when possible. */
  signAndSend(tx: UnsignedTx): Promise<TxResult>;
  /** Opens the provider's secure export UI; never returns the key to our code. */
  exportWallet(): Promise<void>;
}

export type AssetSort = 'trending' | 'gainers' | 'losers' | 'volume' | 'mcap' | 'new';

export interface ListAssetsQuery {
  class?: AssetClass;
  search?: string;
  sort?: AssetSort;
  tag?: string;
  cursor?: string;
  limit?: number;
}

export interface MarketDataProvider {
  listAssets(q: ListAssetsQuery): Promise<Page<Asset>>;
  getAsset(symbolOrId: string): Promise<Asset>;
  getCandles(assetId: string, range: CandleRange): Promise<Candle[]>;
  subscribePrices(assetIds: string[], cb: (tick: PriceTick) => void): Unsubscribe;
  /** Synchronous last known price, when cached. */
  lastPrice?(assetId: string): Decimal | undefined;
}

export interface SwapProvider {
  quote(p: {
    from: string;
    to: string;
    amountIn: Decimal;
    slippageBps: number;
    chain: Chain;
    /** Platform fee in bps of the USD side, collected in the route. */
    feeBps?: number;
  }): Promise<SwapQuote>;
  execute(quote: SwapQuote): Promise<TxResult>;
}

export interface StockTokenProvider {
  listStockTokens(): Promise<Asset[]>;
  quote(p: {
    assetId: string;
    side: Side;
    notionalUsd: Decimal;
    feeRate?: Decimal;
  }): Promise<StockQuote>;
  execute(q: StockQuote): Promise<TxResult>;
  transfer(p: { assetId: string; amount: Decimal; to: string }): Promise<TxResult>;
}

export interface PerpsEvent {
  type: 'liquidated' | 'tp_triggered' | 'sl_triggered';
  position: PerpPosition;
}

export interface PerpsProvider {
  /** Includes maxLeverage, maintenanceMarginRate, takerFeeRate, fundingRate. */
  listMarkets(): Promise<PerpMarket[]>;
  getPositions(): Promise<PerpPosition[]>;
  openPosition(p: OpenPerpParams): Promise<PerpPosition>;
  closePosition(positionId: string, sizePct?: number): Promise<TxResult>;
  setTpSl(positionId: string, tp?: Decimal, sl?: Decimal): Promise<void>;
  subscribePositions(cb: (positions: PerpPosition[]) => void): Unsubscribe;
  /** Liquidations and TP/SL fills, so the backend can notify the user. */
  subscribeEvents?(cb: (event: PerpsEvent) => void): Unsubscribe;
}

export interface OnrampProvider {
  getQuote(p: {
    fiat: Fiat;
    fiatAmount: Decimal;
    asset: string;
    chain: Chain;
  }): Promise<OnrampQuote>;
  /** Opens provider widget / in-app browser. */
  startPurchase(q: OnrampQuote, method: PaymentMethod): Promise<OnrampResult>;
}

export interface KycProvider {
  getStatus(): Promise<KycStatus>;
  start(): Promise<void>;
}

export interface AnalyticsProvider {
  identify(userId: string, traits?: Record<string, string | number | boolean>): void;
  track(event: string, props?: Record<string, string | number | boolean>): void;
  screen(name: string): void;
  reset(): void;
}

export interface Providers {
  wallet: WalletProvider;
  marketData: MarketDataProvider;
  swap: SwapProvider;
  stockTokens: StockTokenProvider;
  perps: PerpsProvider;
  onramp: OnrampProvider;
  kyc: KycProvider;
  analytics: AnalyticsProvider;
}
