import type { Lot } from '../trading/spot';
import type {
  ActivityItem,
  AppNotification,
  Comment,
  NotificationSettings,
  Order,
  Post,
  PriceAlert,
  Profile,
  RegionRule,
  Session,
  Thesis,
  Trade,
  UserBadge,
  ReportReason,
  ReportTarget,
} from '../types';

export interface Follow {
  followerId: string;
  followeeId: string;
  /** Notify-on-trade bell. */
  notify: boolean;
  createdAt: string;
}

export interface DemoDb {
  version: number;
  seed: number;
  createdAt: string;
  profiles: Record<string, Profile>;
  follows: Follow[];
  blocks: { blockerId: string; blockedId: string }[];
  orders: Order[];
  trades: Trade[];
  /** FIFO lots keyed `${userId}:${assetId}`. */
  lots: Record<string, Lot[]>;
  theses: Thesis[];
  posts: Post[];
  comments: Comment[];
  likes: { postId: string; userId: string }[];
  userBadges: UserBadge[];
  notifications: AppNotification[];
  notificationSettings: Record<string, NotificationSettings>;
  pushTokens: { userId: string; token: string; platform: 'ios' | 'android' | 'web' }[];
  priceAlerts: PriceAlert[];
  reports: {
    id: string;
    reporterId: string;
    targetType: ReportTarget;
    targetId: string;
    reason: ReportReason;
    status: 'pending' | 'reviewed';
    createdAt: string;
  }[];
  activity: Record<string, ActivityItem[]>;
  portfolioSnapshots: Record<string, { time: number; value: string }[]>;
  regionRules: RegionRule[];
  leaderboardPrevRanks: Record<string, Record<string, number>>;
  liquidationWarned: Record<string, boolean>;
  session: Session | null;
  pendingEmail: string | null;
}

export const DB_VERSION = 3;

export const DEFAULT_NOTIFICATION_SETTINGS: NotificationSettings = {
  followedTrades: true,
  priceAlerts: true,
  liquidationRisk: true,
  thesisUpdates: true,
  social: true,
  marketing: false,
};

export const lotKey = (userId: string, assetId: string): string => `${userId}:${assetId}`;
