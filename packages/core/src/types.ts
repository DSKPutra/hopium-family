/** Always a decimal string across module/network boundaries. */
export type Decimal = string;
export type ISODate = string;

export type Chain = 'solana' | 'base' | 'ethereum' | 'arbitrum' | 'robinhood';
export const CHAINS: Chain[] = ['solana', 'base', 'ethereum', 'arbitrum', 'robinhood'];
export type AssetClass = 'crypto' | 'stock_token' | 'perp';
export type Side = 'buy' | 'sell';
export type PerpSide = 'long' | 'short';
export type Unsubscribe = () => void;

export interface Asset {
  id: string;
  symbol: string;
  name: string;
  class: AssetClass;
  chain?: Chain;
  address?: string;
  logoUrl: string;
  decimals: number;
  price: Decimal;
  change24hPct: Decimal;
  marketCap?: Decimal;
  volume24h?: Decimal;
  tags: string[];
  /** Stock tokens: underlying company. */
  underlyingName?: string;
  /** Mock catalog: listing date for "new listings". */
  listedAt?: ISODate;
  /** Mock holders count. */
  holders?: number;
}

export interface Page<T> {
  items: T[];
  nextCursor: string | null;
}

export type CandleRange = '1H' | '1D' | '1W' | '1M' | '1Y' | 'ALL';
export const CANDLE_RANGES: CandleRange[] = ['1H', '1D', '1W', '1M', '1Y', 'ALL'];

export interface Candle {
  /** Unix ms. */
  time: number;
  open: Decimal;
  high: Decimal;
  low: Decimal;
  close: Decimal;
}

export interface PriceTick {
  assetId: string;
  price: Decimal;
  change24hPct: Decimal;
  time: number;
}

export interface Session {
  userId: string;
  email: string | null;
  method: 'apple' | 'google' | 'email';
  createdAt: ISODate;
}

export interface Balance {
  assetId: string;
  symbol: string;
  chain: Chain;
  qty: Decimal;
}

export interface UnsignedTx {
  chain: Chain;
  to: string;
  data?: string;
  value?: Decimal;
  memo?: string;
}

export interface TxResult {
  txHash: string;
  chain: Chain;
  status: 'confirmed' | 'failed';
  gasSponsored: boolean;
  explorerUrl: string;
  /** Actual executed amounts, when the provider reports them. */
  filled?: { amountIn: Decimal; amountOut: Decimal; price: Decimal };
}

export interface SwapQuote {
  id: string;
  from: string;
  to: string;
  chain: Chain;
  amountIn: Decimal;
  amountOut: Decimal;
  price: Decimal;
  priceImpactPct: Decimal;
  slippageBps: number;
  networkFeeUsd: Decimal;
  gasSponsored: boolean;
  expiresAt: number;
  /** Platform fee collected within the swap route (e.g. Jupiter platformFeeBps). */
  platformFee?: { assetId: string; amount: Decimal };
}

export interface StockQuote {
  id: string;
  assetId: string;
  side: Side;
  notionalUsd: Decimal;
  qty: Decimal;
  price: Decimal;
  priceImpactPct: Decimal;
  expiresAt: number;
  platformFeeUsd?: Decimal;
}

export interface PerpMarket {
  id: string;
  symbol: string;
  baseAssetId: string;
  name: string;
  markPrice: Decimal;
  indexPrice: Decimal;
  change24hPct: Decimal;
  maxLeverage: number;
  maintenanceMarginRate: Decimal;
  takerFeeRate: Decimal;
  makerFeeRate: Decimal;
  fundingRate: Decimal;
  nextFundingAt: number;
  openInterestUsd: Decimal;
}

export interface OpenPerpParams {
  marketId: string;
  side: PerpSide;
  marginUsd: Decimal;
  leverage: number;
  tp?: Decimal;
  sl?: Decimal;
}

export type PerpStatus = 'open' | 'closed' | 'liquidated';

export interface PerpPosition {
  id: string;
  userId: string;
  marketId: string;
  symbol: string;
  side: PerpSide;
  size: Decimal;
  entryPrice: Decimal;
  markPrice: Decimal;
  leverage: number;
  margin: Decimal;
  liqPrice: Decimal;
  tp: Decimal | null;
  sl: Decimal | null;
  unrealizedPnl: Decimal;
  roePct: Decimal;
  realizedPnl: Decimal;
  status: PerpStatus;
  openedAt: ISODate;
  closedAt: ISODate | null;
}

export type Fiat = 'USD' | 'IDR';
export type PaymentMethod = 'apple_pay' | 'google_pay' | 'card';

export interface OnrampQuote {
  id: string;
  fiat: Fiat;
  fiatAmount: Decimal;
  asset: string;
  chain: Chain;
  cryptoAmount: Decimal;
  feeFiat: Decimal;
  rate: Decimal;
  expiresAt: number;
}

export interface OnrampResult {
  status: 'completed' | 'pending' | 'cancelled' | 'failed';
  cryptoAmount: Decimal;
  asset: string;
  reference: string;
}

export type KycStatus = 'none' | 'pending' | 'approved' | 'rejected';

// ─── social / domain ───────────────────────────────────────────────────────

export type Tier = 'rookie' | 'believer' | 'degen' | 'whale' | 'legend';
export const TIERS: Tier[] = ['rookie', 'believer', 'degen', 'whale', 'legend'];

export type Interest = 'memecoins' | 'blue_chip' | 'stock_tokens' | 'perps' | 'ai_tokens' | 'defi';
export const INTERESTS: Interest[] = [
  'memecoins',
  'blue_chip',
  'stock_tokens',
  'perps',
  'ai_tokens',
  'defi',
];

export type ThemePreference = 'dark' | 'light' | 'system';
export type Language = 'en' | 'id';

export interface Profile {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  bio: string;
  countryCode: string | null;
  birthYear: number | null;
  interests: Interest[];
  holdingsPublic: boolean;
  shareExactAmounts: boolean;
  tier: Tier;
  kycStatus: KycStatus;
  language: Language;
  theme: ThemePreference;
  onboardedAt: ISODate | null;
  createdAt: ISODate;
  riskAcceptedAt: ISODate | null;
  isDemoBot?: boolean;
}

export interface UserStats {
  pnlPct: Decimal;
  winRatePct: Decimal;
  thesisAccuracyPct: Decimal;
  followers: number;
  following: number;
  copiers: number;
  tradesCount: number;
  volumeUsd: Decimal;
}

export interface PublicUser {
  profile: Profile;
  stats: UserStats;
  isFollowing: boolean;
  isBlocked: boolean;
  notifyOnTrade: boolean;
}

export type OrderStatus = 'pending' | 'filled' | 'failed' | 'cancelled';
export type OrderType = 'market' | 'limit';

export interface Order {
  id: string;
  userId: string;
  assetId: string;
  class: AssetClass;
  side: Side;
  type: OrderType;
  amountIn: Decimal;
  amountOut: Decimal;
  price: Decimal;
  fee: Decimal;
  slippageBps: number;
  status: OrderStatus;
  txHash: string | null;
  errorCode: string | null;
  copiedFromTradeId: string | null;
  createdAt: ISODate;
}

export interface Trade {
  id: string;
  userId: string;
  orderId: string;
  assetId: string;
  symbol: string;
  assetClass: AssetClass;
  side: Side;
  qty: Decimal;
  price: Decimal;
  notional: Decimal;
  fee: Decimal;
  realizedPnl: Decimal;
  isPublic: boolean;
  copiedFromTradeId: string | null;
  copiers: number;
  createdAt: ISODate;
}

export interface Holding {
  userId: string;
  assetId: string;
  qty: Decimal;
  avgEntry: Decimal;
  updatedAt: ISODate;
}

export type ThesisDirection = 'long' | 'short';
export type ThesisStatus = 'active' | 'hit' | 'invalidated' | 'expired';
export const THESIS_STATUSES: ThesisStatus[] = ['active', 'hit', 'invalidated', 'expired'];

export interface Thesis {
  id: string;
  authorId: string;
  assetId: string;
  symbol: string;
  direction: ThesisDirection;
  entryPrice: Decimal;
  targetPrice: Decimal;
  invalidationPrice: Decimal;
  timeframeEnd: ISODate;
  body: string;
  imageUrl: string | null;
  status: ThesisStatus;
  resolvedAt: ISODate | null;
  maxFavorablePct: Decimal;
  createdAt: ISODate;
}

export type PostKind = 'trade' | 'thesis' | 'text' | 'milestone';

export interface MilestoneData {
  type: 'rank_up' | 'badge' | 'tier_up';
  rank?: number;
  badgeSlug?: string;
  tier?: Tier;
}

export interface Post {
  id: string;
  authorId: string;
  kind: PostKind;
  tradeId: string | null;
  thesisId: string | null;
  body: string;
  milestone: MilestoneData | null;
  likeCount: number;
  commentCount: number;
  isHidden: boolean;
  createdAt: ISODate;
}

export type SizeBucket = 'lt100' | '100to1k' | '1kto10k' | 'gt10k';

/** A post joined with everything a feed row needs. */
export interface FeedItem {
  post: Post;
  author: Profile;
  /** Trade amounts are redacted (zeroed) unless the author opted in. */
  trade: Trade | null;
  thesis: Thesis | null;
  likedByMe: boolean;
  sizeBucket: SizeBucket | null;
  amountsVisible: boolean;
}

export interface Comment {
  id: string;
  postId: string;
  authorId: string;
  body: string;
  parentId: string | null;
  createdAt: ISODate;
}

export interface CommentWithAuthor extends Comment {
  author: Profile;
}

export type LeaderboardPeriod = 'daily' | 'weekly' | 'season' | 'all_time';
export type LeaderboardMetric = 'pnl_pct' | 'thesis_accuracy' | 'copiers';

export interface LeaderboardEntry {
  userId: string;
  profile: Profile;
  rank: number;
  previousRank: number | null;
  value: Decimal;
}

export interface Leaderboard {
  period: LeaderboardPeriod;
  metric: LeaderboardMetric;
  entries: LeaderboardEntry[];
  me: LeaderboardEntry | null;
  computedAt: ISODate;
  season: { name: string; endsAt: ISODate };
}

export interface Badge {
  slug: string;
  nameEn: string;
  nameId: string;
  descriptionEn: string;
  descriptionId: string;
  icon: string;
}

export interface UserBadge {
  userId: string;
  slug: string;
  awardedAt: ISODate;
}

export type NotificationType =
  | 'followed_trade'
  | 'price_alert'
  | 'liquidation_risk'
  | 'liquidated'
  | 'thesis_update'
  | 'social_like'
  | 'social_comment'
  | 'social_follow'
  | 'order_filled'
  | 'badge'
  | 'rank_up'
  | 'deposit';

export interface AppNotification {
  id: string;
  userId: string;
  type: NotificationType;
  /** i18n key + params so notifications render in the viewer's language. */
  titleKey: string;
  bodyKey: string;
  params: Record<string, string | number>;
  data: { href?: string; [key: string]: string | number | undefined };
  readAt: ISODate | null;
  createdAt: ISODate;
}

export interface NotificationSettings {
  followedTrades: boolean;
  priceAlerts: boolean;
  liquidationRisk: boolean;
  thesisUpdates: boolean;
  social: boolean;
  marketing: boolean;
}

export type PriceAlertCondition = 'above' | 'below' | 'pct_change';

export interface PriceAlert {
  id: string;
  userId: string;
  assetId: string;
  symbol: string;
  condition: PriceAlertCondition;
  value: Decimal;
  /** Price at creation, used by pct_change. */
  basePrice: Decimal;
  isActive: boolean;
  triggeredAt: ISODate | null;
  createdAt: ISODate;
}

export type ReportTarget = 'user' | 'post' | 'comment';
export type ReportReason = 'spam' | 'scam' | 'harassment' | 'impersonation' | 'other';

export type ActivityKind =
  'deposit' | 'withdrawal' | 'trade' | 'perp_open' | 'perp_close' | 'perp_liquidation';

export interface ActivityItem {
  id: string;
  kind: ActivityKind;
  title: string;
  symbol: string;
  amountUsd: Decimal;
  qty: Decimal | null;
  side: Side | PerpSide | null;
  status: 'completed' | 'pending' | 'failed';
  txHash: string | null;
  chain: Chain | null;
  createdAt: ISODate;
}

export type Feature = 'stock_tokens' | 'perps' | 'copy_trade' | 'withdraw';

export interface RegionRule {
  countryCode: string;
  allowStockTokens: boolean;
  allowPerps: boolean;
  allowCopyTrade: boolean;
  requiresKycFor: Feature[];
}

export interface AppConfig {
  fees: {
    cryptoSwap: Decimal;
    stockToken: Decimal;
    perpsTaker: Decimal;
    perpsMaker: Decimal;
  };
  minOrderUsd: { crypto: Decimal; stock_token: Decimal };
  maxSlippageBps: number;
  tierThresholds: Record<Tier, Decimal>;
  idrPerUsd: Decimal;
  season: { name: string; endsAt: ISODate };
}

export interface PortfolioSummary {
  totalUsd: Decimal;
  cashUsd: Decimal;
  cryptoUsd: Decimal;
  stockTokensUsd: Decimal;
  perpsMarginUsd: Decimal;
  perpsUnrealizedUsd: Decimal;
  holdings: HoldingView[];
}

export interface HoldingView {
  asset: Asset;
  qty: Decimal;
  avgEntry: Decimal;
  valueUsd: Decimal;
  unrealizedPnl: Decimal;
  unrealizedPnlPct: Decimal;
}

export interface SpotQuote {
  id: string;
  assetId: string;
  symbol: string;
  assetClass: 'crypto' | 'stock_token';
  side: Side;
  /** USD spent (buy) or USD received (sell) before fees. */
  notionalUsd: Decimal;
  qty: Decimal;
  price: Decimal;
  priceImpactPct: Decimal;
  networkFeeUsd: Decimal;
  gasSponsored: boolean;
  platformFeeUsd: Decimal;
  feeRate: Decimal;
  /** Buy: total USD debited. Sell: net USD credited. */
  totalUsd: Decimal;
  slippageBps: number;
  expiresAt: number;
}

export interface SpotOrderResult {
  order: Order;
  trade: Trade | null;
  isFirstTrade: boolean;
  txExplorerUrl: string | null;
}
