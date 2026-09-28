import type {
  AssetClass,
  CandleRange,
  FeedKind,
  LeaderboardMetric,
  LeaderboardPeriod,
  PortfolioRange,
  AssetSort,
} from '@hopium/core';

/** Centralized TanStack Query keys. */
export const queryKeys = {
  session: ['session'] as const,
  me: ['me'] as const,
  config: ['config'] as const,
  region: ['region'] as const,
  kyc: ['kyc'] as const,
  assets: (q: {
    class?: AssetClass;
    sort?: AssetSort;
    tag?: string;
    search?: string;
    limit?: number;
  }) => ['assets', q] as const,
  asset: (symbolOrId: string) => ['asset', symbolOrId.toLowerCase()] as const,
  candles: (assetId: string, range: CandleRange) => ['candles', assetId, range] as const,
  feed: (kind: FeedKind) => ['feed', kind] as const,
  post: (id: string) => ['post', id] as const,
  comments: (postId: string) => ['comments', postId] as const,
  legends: ['legends'] as const,
  suggestions: ['suggestions'] as const,
  user: (username: string) => ['user', username] as const,
  userTrades: (userId: string) => ['userTrades', userId] as const,
  userTheses: (userId: string, status: string) => ['userTheses', userId, status] as const,
  userHoldings: (userId: string) => ['userHoldings', userId] as const,
  userBadges: (userId: string) => ['userBadges', userId] as const,
  portfolioHistory: (userId: string, range: PortfolioRange) =>
    ['portfolioHistory', userId, range] as const,
  portfolio: ['portfolio'] as const,
  holding: (assetId: string) => ['holding', assetId] as const,
  orders: ['orders'] as const,
  activity: (kind: string) => ['activity', kind] as const,
  holdersIFollow: (assetId: string) => ['holdersIFollow', assetId] as const,
  assetTheses: (assetId: string) => ['assetTheses', assetId] as const,
  perpMarkets: ['perpMarkets'] as const,
  perpMarket: (id: string) => ['perpMarket', id] as const,
  positions: ['positions'] as const,
  positionHistory: ['positionHistory'] as const,
  addresses: ['addresses'] as const,
  thesis: (id: string) => ['thesis', id] as const,
  leaderboard: (period: LeaderboardPeriod, metric: LeaderboardMetric) =>
    ['leaderboard', period, metric] as const,
  notifications: ['notifications'] as const,
  notificationSettings: ['notificationSettings'] as const,
  priceAlerts: ['priceAlerts'] as const,
  search: (q: string) => ['search', q] as const,
};

/** Stale times per data type (ms). */
export const staleTimes = {
  prices: 2_000,
  assetLists: 30_000,
  profiles: 60_000,
  feed: 15_000,
} as const;
