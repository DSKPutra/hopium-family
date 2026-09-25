import type { ThesisInput } from './schemas';
import type {
  ActivityItem,
  AppConfig,
  AppNotification,
  Badge,
  Chain,
  CommentWithAuthor,
  Decimal,
  FeedItem,
  Fiat,
  HoldingView,
  Language,
  Leaderboard,
  LeaderboardMetric,
  LeaderboardPeriod,
  NotificationSettings,
  OnrampQuote,
  OnrampResult,
  OpenPerpParams,
  Order,
  Page,
  PaymentMethod,
  PerpMarket,
  PerpPosition,
  PortfolioSummary,
  PriceAlert,
  PriceAlertCondition,
  Profile,
  PublicUser,
  RegionRule,
  ReportReason,
  ReportTarget,
  Session,
  Side,
  SpotOrderResult,
  SpotQuote,
  Thesis,
  ThesisStatus,
  ThemePreference,
  Trade,
  TxResult,
  Unsubscribe,
  UserBadge,
  Interest,
  KycStatus,
  ActivityKind,
} from './types';

export type FeedKind = 'following' | 'trending' | 'theses';
export type PortfolioRange = '1D' | '1W' | '1M' | 'ALL';

export type BackendEvent =
  | { type: 'feed:new'; postId: string; authorId: string }
  | { type: 'notification'; notification: AppNotification; push: boolean }
  | { type: 'positions' }
  | { type: 'balances' }
  | { type: 'orders' }
  | { type: 'profile' }
  | { type: 'session' }
  | { type: 'kyc'; status: KycStatus }
  | { type: 'thesis:resolved'; thesis: Thesis; mine: boolean }
  | {
      type: 'milestone';
      kind: 'first_trade' | 'rank_up' | 'thesis_hit' | 'badge';
      params: Record<string, string | number>;
    };

export interface ProfilePatch {
  username?: string;
  displayName?: string;
  bio?: string;
  avatarUrl?: string | null;
  countryCode?: string;
  birthYear?: number;
  interests?: Interest[];
  holdingsPublic?: boolean;
  shareExactAmounts?: boolean;
  language?: Language;
  theme?: ThemePreference;
  riskAccepted?: boolean;
}

export interface SpotQuoteRequest {
  assetId: string;
  side: Side;
  /** USD amount (buy: spend, sell: receive before fees). */
  amountUsd?: Decimal;
  /** Token quantity (alternative to amountUsd). */
  qty?: Decimal;
  slippageBps: number;
}

export interface PlaceSpotOrderOptions {
  copiedFromTradeId?: string | null;
  shareToFeed: boolean;
}

export interface OpenPerpRequest extends OpenPerpParams {
  acknowledgedHighLeverage: boolean;
}

export interface WithdrawRequest {
  assetId: string;
  chain: Chain;
  address: string;
  amount: Decimal;
}

export interface ThesisDetail {
  thesis: Thesis;
  author: Profile;
  item: FeedItem;
}

export interface LegendBuy {
  profile: Profile;
  trade: Trade;
  postId: string;
}

export interface SearchResults {
  people: Profile[];
  theses: { thesis: Thesis; author: Profile }[];
}

export interface PortfolioPoint {
  time: number;
  value: Decimal;
}

/**
 * Everything the app needs from "our server". Implemented in memory by
 * DemoBackend (default) and by SupabaseBackend when a project is configured.
 */
export interface Backend {
  readonly kind: 'demo' | 'supabase';
  subscribe(cb: (event: BackendEvent) => void): Unsubscribe;

  // auth
  getSession(): Promise<Session | null>;
  startEmailSignIn(email: string): Promise<void>;
  verifyOtp(email: string, code: string): Promise<Session>;
  signInWithProvider(method: 'apple' | 'google'): Promise<Session>;
  signOut(): Promise<void>;
  deleteAccount(confirmation: string): Promise<void>;

  // profile & people
  getMe(): Promise<Profile | null>;
  checkUsername(username: string): Promise<{ available: boolean }>;
  updateProfile(patch: ProfilePatch): Promise<Profile>;
  completeOnboarding(): Promise<Profile>;
  getFollowSuggestions(limit?: number): Promise<PublicUser[]>;
  getUser(username: string): Promise<PublicUser>;
  getUserTrades(userId: string, cursor?: string | null): Promise<Page<Trade>>;
  getUserTheses(userId: string, status?: ThesisStatus | 'all'): Promise<Thesis[]>;
  /** `null` when the user keeps holdings private. */
  getUserHoldings(userId: string): Promise<HoldingView[] | null>;
  getUserBadges(userId: string): Promise<(UserBadge & { badge: Badge })[]>;
  getPortfolioHistory(userId: string, range: PortfolioRange): Promise<PortfolioPoint[] | null>;
  follow(userId: string): Promise<void>;
  unfollow(userId: string): Promise<void>;
  setNotifyOnTrade(userId: string, on: boolean): Promise<void>;
  block(userId: string): Promise<void>;
  unblock(userId: string): Promise<void>;
  report(p: { targetType: ReportTarget; targetId: string; reason: ReportReason }): Promise<void>;
  search(query: string): Promise<SearchResults>;

  // feed & social
  getFeed(kind: FeedKind, cursor?: string | null): Promise<Page<FeedItem>>;
  getPost(postId: string): Promise<FeedItem>;
  getLegendsBuying(): Promise<LegendBuy[]>;
  like(postId: string): Promise<void>;
  unlike(postId: string): Promise<void>;
  getComments(postId: string): Promise<CommentWithAuthor[]>;
  addComment(postId: string, body: string, parentId?: string | null): Promise<CommentWithAuthor>;

  // config & compliance
  getAppConfig(): Promise<AppConfig>;
  getRegionRule(): Promise<RegionRule>;
  getKycStatus(): Promise<KycStatus>;
  startKyc(): Promise<void>;

  // spot & stock tokens
  quoteSpot(req: SpotQuoteRequest): Promise<SpotQuote>;
  placeSpotOrder(quote: SpotQuote, opts: PlaceSpotOrderOptions): Promise<SpotOrderResult>;
  getPortfolio(): Promise<PortfolioSummary>;
  getHolding(assetId: string): Promise<HoldingView | null>;
  getOrders(): Promise<Order[]>;
  getActivity(kind?: ActivityKind | 'all'): Promise<ActivityItem[]>;
  getAssetHoldersIFollow(assetId: string): Promise<Profile[]>;
  getAssetTheses(assetId: string): Promise<{ thesis: Thesis; author: Profile }[]>;

  // perps
  getPerpMarkets(): Promise<PerpMarket[]>;
  getPerpMarket(marketId: string): Promise<PerpMarket>;
  getPositions(): Promise<PerpPosition[]>;
  getPositionHistory(): Promise<PerpPosition[]>;
  openPerp(req: OpenPerpRequest): Promise<PerpPosition>;
  closePerp(positionId: string, sizePct: number): Promise<TxResult>;
  setTpSl(positionId: string, tp?: Decimal, sl?: Decimal): Promise<void>;

  // wallet
  getAddresses(): Promise<Record<Chain, string>>;
  getOnrampQuote(p: { fiat: Fiat; fiatAmount: Decimal }): Promise<OnrampQuote>;
  deposit(quote: OnrampQuote, method: PaymentMethod): Promise<OnrampResult>;
  getWithdrawFee(chain: Chain): Promise<Decimal>;
  withdraw(req: WithdrawRequest): Promise<ActivityItem>;
  exportWallet(): Promise<void>;

  // theses
  createThesis(input: ThesisInput): Promise<Thesis>;
  getThesis(thesisId: string): Promise<ThesisDetail>;

  // leaderboard
  getLeaderboard(period: LeaderboardPeriod, metric: LeaderboardMetric): Promise<Leaderboard>;

  // notifications & alerts
  getNotifications(): Promise<AppNotification[]>;
  markNotificationRead(id: string): Promise<void>;
  markAllNotificationsRead(): Promise<void>;
  deleteNotification(id: string): Promise<void>;
  getNotificationSettings(): Promise<NotificationSettings>;
  updateNotificationSettings(patch: Partial<NotificationSettings>): Promise<NotificationSettings>;
  registerPushToken(token: string, platform: 'ios' | 'android' | 'web'): Promise<void>;
  getPriceAlerts(): Promise<PriceAlert[]>;
  createPriceAlert(p: {
    assetId: string;
    condition: PriceAlertCondition;
    value: Decimal;
  }): Promise<PriceAlert>;
  deletePriceAlert(id: string): Promise<void>;
}
