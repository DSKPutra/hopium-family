import type {
  Backend,
  BackendEvent,
  FeedKind,
  LegendBuy,
  OpenPerpRequest,
  PlaceSpotOrderOptions,
  PortfolioPoint,
  PortfolioRange,
  ProfilePatch,
  SearchResults,
  SpotQuoteRequest,
  ThesisDetail,
  WithdrawRequest,
} from '../backend';
import { CHAIN_META, isValidAddress } from '../chains';
import { AppError, toAppError } from '../errors';
import { add, dec, div, gt, gte, lt, max, min, mul, pctChange, round, sub, sum } from '../money';
import type { MockProviders } from '../providers/mock';
import { USDC_ID } from '../providers/mock/catalog';
import { demoAddresses } from '../providers/mock/wallet';
import {
  fakeTxHash,
  gaussian,
  mulberry32,
  newId,
  pick,
  randInt,
  rngFor,
  type Rng,
} from '../random';
import { commentSchema, isAdult, thesisSchema, usernameSchema, type ThesisInput } from '../schemas';
import { DEFAULT_FEES, DEFAULT_MIN_ORDER_USD, fee as feeOf, spotFeeRate } from '../trading/fees';
import {
  DEFAULT_TIER_THRESHOLDS,
  qualifies,
  rankBy,
  thesisAccuracyPct,
  tierForVolume,
  traderMetrics,
  isSuspectedWashTrading,
} from '../trading/leaderboard';
import { isHighLeverage, isNearLiquidation } from '../trading/perps';
import {
  assertMinOrder,
  exceedsSlippage,
  fifoSell,
  sizeBucket,
  unrealizedPnl,
  unrealizedPnlPct,
  weightedAverage,
  type Lot,
} from '../trading/spot';
import { resolveThesis, validateThesisPrices } from '../trading/thesis';
import type {
  ActivityItem,
  ActivityKind,
  AppConfig,
  AppNotification,
  Asset,
  Badge,
  Chain,
  CommentWithAuthor,
  Decimal,
  Feature,
  FeedItem,
  Fiat,
  HoldingView,
  KycStatus,
  Leaderboard,
  LeaderboardEntry,
  LeaderboardMetric,
  LeaderboardPeriod,
  NotificationSettings,
  NotificationType,
  OnrampQuote,
  OnrampResult,
  Order,
  Page,
  PaymentMethod,
  PerpMarket,
  PerpPosition,
  PortfolioSummary,
  Post,
  PriceAlert,
  PriceAlertCondition,
  Profile,
  PublicUser,
  RegionRule,
  ReportReason,
  ReportTarget,
  Session,
  SpotOrderResult,
  SpotQuote,
  StockQuote,
  SwapQuote,
  Thesis,
  ThesisStatus,
  Trade,
  TxResult,
  Unsubscribe,
  UserBadge,
  UserStats,
} from '../types';
import { BADGES, BLOCKED_WORDS, COMMENT_POOL, DEFAULT_REGION_RULE } from './content';
import { DB_VERSION, DEFAULT_NOTIFICATION_SETTINGS, lotKey, type DemoDb } from './db';
import { lotsValue, seedDemoDb } from './seed';

const DAY = 86_400_000;
const FEED_PAGE = 15;
const STABLES = new Set(['usdc', 'usdt', 'pyusd', 'dai']);
const WITHDRAW_FEE_USD: Record<Chain, Decimal> = {
  solana: '0.01',
  base: '0.05',
  arbitrum: '0.08',
  ethereum: '2.4',
  robinhood: '0.05',
};
const PERIOD_MS: Record<LeaderboardPeriod, number> = {
  daily: DAY,
  weekly: 7 * DAY,
  season: 0,
  all_time: Number.POSITIVE_INFINITY,
};

export interface DemoStorage {
  load(): string | null;
  save(value: string): void;
  clear(): void;
}

export interface DemoBackendOptions {
  seed?: number;
  now?: () => number;
  storage?: DemoStorage;
  /** Run price/bot/resolution engines (off in unit tests). */
  engines?: boolean;
  /** Mean seconds between simulated trader actions. */
  botIntervalMs?: [number, number];
}

interface PersistedState {
  version: number;
  db: DemoDb;
  world: ReturnType<MockProviders['world']['exportState']>;
  prices: ReturnType<MockProviders['marketData']['exportPrices']>;
}

export function seasonFor(now: number): { name: string; endsAt: string; startsAt: string } {
  const d = new Date(now);
  const q = Math.floor(d.getUTCMonth() / 3);
  const start = Date.UTC(d.getUTCFullYear(), q * 3, 1);
  const end = Date.UTC(d.getUTCFullYear(), q * 3 + 3, 1) - 1;
  return {
    name: `Q${q + 1} ${d.getUTCFullYear()}`,
    startsAt: new Date(start).toISOString(),
    endsAt: new Date(end).toISOString(),
  };
}

/** Content filter shared with the moderate-content edge function. */
export function moderate(body: string): void {
  const lower = body.toLowerCase();
  if (/(https?:\/\/|www\.|\b[a-z0-9-]+\.(com|io|xyz|net|org|app|gg|me)\b)/i.test(body)) {
    throw new AppError('content_rejected', 'Links are not allowed in posts or comments.');
  }
  if (BLOCKED_WORDS.some((w) => lower.includes(w))) {
    throw new AppError('content_rejected', 'This message looks like spam.');
  }
}

/** Deep copy of a JSON-shaped backend result (records are plain data). */
function detach<T>(value: T): T {
  return value === undefined ? value : (JSON.parse(JSON.stringify(value)) as T);
}

/**
 * In-memory implementation of every backend endpoint, mirroring the Supabase
 * schema, RLS rules, triggers and edge functions so the app works fully
 * without a Supabase project, real keys or real money.
 */
export class DemoBackend implements Backend {
  readonly kind = 'demo' as const;
  private db: DemoDb;
  private listeners = new Set<(e: BackendEvent) => void>();
  private quotes = new Map<string, { raw: SwapQuote | StockQuote; quote: SpotQuote }>();
  private timers: ReturnType<typeof setTimeout>[] = [];
  private unsubs: Unsubscribe[] = [];
  private saveTimer: ReturnType<typeof setTimeout> | null = null;
  private rng: Rng;
  private readonly now: () => number;
  private leaderboardCache = new Map<string, { at: number; board: Leaderboard }>();
  private lastAlertCheck = 0;
  private lastRank: number | null = null;

  constructor(
    readonly providers: MockProviders,
    private opts: DemoBackendOptions = {},
  ) {
    this.now = opts.now ?? Date.now;
    this.rng = mulberry32((opts.seed ?? 1) ^ Date.now());
    const seed = opts.seed ?? 20260924;
    const restored = this.restore();
    this.db = restored ?? seedDemoDb({ seed, now: this.now(), market: providers.marketData });
    if (this.db.session) providers.world.currentUserId = this.db.session.userId;
    providers.world.onChange(() => {
      this.emit({ type: 'balances' });
      this.scheduleSave();
    });
    if (opts.engines !== false) this.startEngines();
    // Like a network backend, hand callers copies: query caches must never share
    // (and double-apply mutations to) the live in-memory records.
    return new Proxy(this, {
      get(target, prop, receiver) {
        const value: unknown = Reflect.get(target, prop, receiver);
        if (typeof value !== 'function' || prop === 'constructor') return value;
        return (...args: unknown[]) => {
          const result: unknown = (value as (...a: unknown[]) => unknown).apply(target, args);
          return result instanceof Promise ? result.then(detach) : result;
        };
      },
    });
  }

  // ─── persistence ───────────────────────────────────────────────────────
  private restore(): DemoDb | null {
    const raw = this.opts.storage?.load();
    if (!raw) return null;
    try {
      const state = JSON.parse(raw) as PersistedState;
      if (state.version !== DB_VERSION || state.db.version !== DB_VERSION) return null;
      this.providers.world.importState(state.world);
      this.providers.marketData.importPrices(state.prices);
      return state.db;
    } catch {
      return null;
    }
  }

  private scheduleSave(): void {
    if (!this.opts.storage || this.saveTimer) return;
    this.saveTimer = setTimeout(() => {
      this.saveTimer = null;
      this.saveNow();
    }, 500);
  }

  saveNow(): void {
    if (!this.opts.storage) return;
    if (this.saveTimer) {
      clearTimeout(this.saveTimer);
      this.saveTimer = null;
    }
    const state: PersistedState = {
      version: DB_VERSION,
      db: this.db,
      world: this.providers.world.exportState(),
      prices: this.providers.marketData.exportPrices(),
    };
    this.opts.storage.save(JSON.stringify(state));
  }

  private changed(...events: BackendEvent[]): void {
    for (const e of events) this.emit(e);
    // User-initiated writes persist immediately so a reload can't lose them;
    // background churn (bot trades, likes) is debounced.
    const critical = events.some((e) =>
      ['session', 'profile', 'orders', 'positions', 'kyc'].includes(e.type),
    );
    if (critical) this.saveNow();
    else this.scheduleSave();
  }

  // ─── events ────────────────────────────────────────────────────────────
  subscribe(cb: (event: BackendEvent) => void): Unsubscribe {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  }

  private emit(e: BackendEvent): void {
    for (const l of this.listeners) l(e);
  }

  // ─── engines ───────────────────────────────────────────────────────────
  startEngines(): void {
    const { marketData, perps } = this.providers;
    marketData.start();
    perps.start();
    this.unsubs.push(
      marketData.subscribeAll(() => this.onPriceTick()),
      perps.subscribePositions(() => {
        this.checkLiquidationRisk();
        this.emit({ type: 'positions' });
      }),
      perps.subscribeEvents((e) => this.onPerpEvent(e.type, e.position)),
    );
    const every = (ms: number, fn: () => void) => {
      const t = setInterval(fn, ms);
      this.timers.push(t as unknown as ReturnType<typeof setTimeout>);
    };
    every(5000, () => this.resolveTheses());
    every(60_000, () => this.snapshotPortfolio());
    every(30_000, () => this.checkRankUp());
    this.scheduleBot();
  }

  stopEngines(): void {
    this.providers.marketData.stop();
    this.providers.perps.stop();
    for (const u of this.unsubs) u();
    this.unsubs = [];
    for (const t of this.timers) clearInterval(t as unknown as ReturnType<typeof setInterval>);
    this.timers = [];
    if (this.saveTimer) clearTimeout(this.saveTimer);
  }

  private scheduleBot(): void {
    const [lo, hi] = this.opts.botIntervalMs ?? [15_000, 40_000];
    const t = setTimeout(
      () => {
        try {
          this.simulateBotTrade();
        } finally {
          this.scheduleBot();
        }
      },
      lo + this.rng() * (hi - lo),
    );
    this.timers.push(t);
  }

  private onPriceTick(): void {
    const t = this.now();
    if (t - this.lastAlertCheck < 2000) return;
    this.lastAlertCheck = t;
    this.checkPriceAlerts();
  }

  // ─── helpers ───────────────────────────────────────────────────────────
  private uid(): string {
    const s = this.db.session;
    if (!s) throw new AppError('not_authenticated', 'Please sign in.');
    return s.userId;
  }

  private me(): Profile {
    const p = this.db.profiles[this.uid()];
    if (!p) throw new AppError('not_authenticated');
    return p;
  }

  private profile(id: string): Profile {
    const p = this.db.profiles[id];
    if (!p) throw new AppError('not_found', 'User not found');
    return p;
  }

  private iso(t = this.now()): string {
    return new Date(t).toISOString();
  }

  private asset(id: string): Asset {
    return this.providers.marketData.assetSync(id);
  }

  private price(id: string): Decimal {
    return this.providers.marketData.priceOf(id);
  }

  private blockedSet(userId: string | null): Set<string> {
    const set = new Set<string>();
    if (!userId) return set;
    for (const b of this.db.blocks) {
      if (b.blockerId === userId) set.add(b.blockedId);
      if (b.blockedId === userId) set.add(b.blockerId);
    }
    return set;
  }

  private viewerId(): string | null {
    return this.db.session?.userId ?? null;
  }

  private settingsFor(userId: string): NotificationSettings {
    return (this.db.notificationSettings[userId] ??= { ...DEFAULT_NOTIFICATION_SETTINGS });
  }

  private notify(
    userId: string,
    type: NotificationType,
    titleKey: string,
    bodyKey: string,
    params: Record<string, string | number>,
    data: AppNotification['data'],
    push = false,
  ): void {
    const profile = this.db.profiles[userId];
    if (!profile || profile.isDemoBot) return;
    const s = this.settingsFor(userId);
    const allowed: Record<NotificationType, boolean> = {
      followed_trade: s.followedTrades,
      price_alert: s.priceAlerts,
      liquidation_risk: s.liquidationRisk,
      liquidated: true,
      thesis_update: s.thesisUpdates,
      social_like: s.social,
      social_comment: s.social,
      social_follow: s.social,
      order_filled: true,
      badge: true,
      rank_up: true,
      deposit: true,
    };
    if (!allowed[type]) return;
    const n: AppNotification = {
      id: newId('n_'),
      userId,
      type,
      titleKey,
      bodyKey,
      params,
      data,
      readAt: null,
      createdAt: this.iso(),
    };
    this.db.notifications.unshift(n);
    if (this.db.notifications.length > 300) this.db.notifications.length = 300;
    this.changed({ type: 'notification', notification: n, push });
  }

  private addActivity(userId: string, item: Omit<ActivityItem, 'id' | 'createdAt'>): ActivityItem {
    const full: ActivityItem = { ...item, id: newId('ac_'), createdAt: this.iso() };
    (this.db.activity[userId] ??= []).unshift(full);
    return full;
  }

  private awardBadge(userId: string, slug: string): void {
    if (this.db.userBadges.some((b) => b.userId === userId && b.slug === slug)) return;
    this.db.userBadges.push({ userId, slug, awardedAt: this.iso() });
    const badge = BADGES.find((b) => b.slug === slug);
    this.notify(
      userId,
      'badge',
      'notifications.badge.title',
      'notifications.badge.body',
      { badge: slug, icon: badge?.icon ?? '🏅' },
      { href: '/profile' },
    );
    this.emit({ type: 'milestone', kind: 'badge', params: { badge: slug } });
  }

  private regionRule(countryCode: string | null): RegionRule {
    const found = this.db.regionRules.find((r) => r.countryCode === countryCode);
    return found ?? { countryCode: countryCode ?? 'XX', ...DEFAULT_REGION_RULE };
  }

  private assertFeature(feature: Feature): void {
    const me = this.me();
    const rule = this.regionRule(me.countryCode);
    const allowed =
      feature === 'stock_tokens'
        ? rule.allowStockTokens
        : feature === 'perps'
          ? rule.allowPerps
          : feature === 'copy_trade'
            ? rule.allowCopyTrade
            : true;
    if (!allowed)
      throw new AppError('region_restricted', 'This feature is not available in your region.', {
        feature,
      });
    if (rule.requiresKycFor.includes(feature)) {
      const status = this.providers.world.kyc[me.id] ?? me.kycStatus;
      if (status !== 'approved')
        throw new AppError('kyc_required', 'Identity verification is required for this feature.', {
          feature,
        });
    }
  }

  // ─── auth ──────────────────────────────────────────────────────────────
  async getSession(): Promise<Session | null> {
    return this.db.session;
  }

  async startEmailSignIn(email: string): Promise<void> {
    await this.providers.world.simulateLatency();
    this.db.pendingEmail = email.trim().toLowerCase();
    this.scheduleSave();
  }

  async verifyOtp(email: string, code: string): Promise<Session> {
    const session = await this.providers.wallet.login('email', { email, otp: code });
    return this.onSignedIn(session);
  }

  async signInWithProvider(method: 'apple' | 'google'): Promise<Session> {
    const session = await this.providers.wallet.login(method);
    return this.onSignedIn(session);
  }

  private onSignedIn(session: Session): Session {
    this.db.session = session;
    this.db.pendingEmail = null;
    if (!this.db.profiles[session.userId]) this.createAccount(session);
    this.providers.analytics.identify(session.userId);
    this.changed({ type: 'session' }, { type: 'profile' });
    return session;
  }

  private createAccount(session: Session): void {
    const created = this.iso();
    const profile: Profile = {
      id: session.userId,
      username: '',
      displayName: '',
      avatarUrl: null,
      bio: '',
      countryCode: null,
      birthYear: null,
      interests: [],
      holdingsPublic: true,
      shareExactAmounts: false,
      tier: 'rookie',
      kycStatus: 'none',
      language: 'en',
      theme: 'dark',
      onboardedAt: null,
      createdAt: created,
      riskAcceptedAt: null,
    };
    this.db.profiles[profile.id] = profile;
    this.db.notificationSettings[profile.id] = { ...DEFAULT_NOTIFICATION_SETTINGS };
    // $10,000 demo USDC plus small random holdings.
    const r = rngFor(session.userId, 'bags');
    const choices = ['sol', 'hope', 'fam', 'eth', 'mooncat', 'aaplx'];
    const bags = [pick(r, choices), pick(r, choices)].filter((v, i, a) => a.indexOf(v) === i);
    const extras = bags.map((assetId) => {
      const usd = String(randInt(r, 8, 40));
      const qty = round(div(usd, this.price(assetId)), 10, 'down');
      this.db.lots[lotKey(profile.id, assetId)] = [{ qty, price: this.price(assetId) }];
      return { assetId, qty };
    });
    this.providers.wallet.fundNewAccount(profile.id, extras);
    this.addActivity(profile.id, {
      kind: 'deposit',
      title: 'demo',
      symbol: 'USDC',
      amountUsd: '10000',
      qty: '10000',
      side: null,
      status: 'completed',
      txHash: null,
      chain: 'solana',
    });
    this.db.portfolioSnapshots[profile.id] = [
      { time: this.now(), value: this.portfolioTotal(profile.id) },
    ];
  }

  async signOut(): Promise<void> {
    await this.providers.wallet.logout();
    this.db.session = null;
    this.providers.analytics.reset();
    this.changed({ type: 'session' });
    this.saveNow();
  }

  async deleteAccount(confirmation: string): Promise<void> {
    if (confirmation.trim().toLowerCase() !== 'delete')
      throw new AppError('invalid_input', 'Type "delete" to confirm.');
    const id = this.uid();
    await this.providers.world.simulateLatency();
    // Keep anonymized trade records (legal retention); drop everything else.
    for (const t of this.db.trades)
      if (t.userId === id) Object.assign(t, { userId: 'deleted', isPublic: false });
    this.db.posts = this.db.posts.filter((p) => p.authorId !== id);
    this.db.comments = this.db.comments.filter((c) => c.authorId !== id);
    this.db.likes = this.db.likes.filter((l) => l.userId !== id);
    this.db.follows = this.db.follows.filter((f) => f.followerId !== id && f.followeeId !== id);
    this.db.blocks = this.db.blocks.filter((b) => b.blockerId !== id && b.blockedId !== id);
    this.db.theses = this.db.theses.filter((t) => t.authorId !== id);
    this.db.orders = this.db.orders.filter((o) => o.userId !== id);
    this.db.notifications = this.db.notifications.filter((n) => n.userId !== id);
    this.db.priceAlerts = this.db.priceAlerts.filter((a) => a.userId !== id);
    this.db.pushTokens = this.db.pushTokens.filter((t) => t.userId !== id);
    this.db.userBadges = this.db.userBadges.filter((b) => b.userId !== id);
    for (const k of Object.keys(this.db.lots)) if (k.startsWith(`${id}:`)) delete this.db.lots[k];
    delete this.db.activity[id];
    delete this.db.portfolioSnapshots[id];
    delete this.db.notificationSettings[id];
    delete this.db.profiles[id];
    delete this.providers.world.balances[id];
    delete this.providers.world.kyc[id];
    this.providers.world.positions = this.providers.world.positions.filter((p) => p.userId !== id);
    await this.signOut();
  }

  // ─── profile ───────────────────────────────────────────────────────────
  async getMe(): Promise<Profile | null> {
    const s = this.db.session;
    if (!s) return null;
    const p = this.db.profiles[s.userId];
    if (!p) return null;
    const kyc = this.providers.world.kyc[p.id];
    return kyc && kyc !== p.kycStatus ? { ...p, kycStatus: kyc } : p;
  }

  async checkUsername(username: string): Promise<{ available: boolean }> {
    await this.providers.world.simulateLatency();
    const parsed = usernameSchema.safeParse(username);
    if (!parsed.success) return { available: false };
    const me = this.viewerId();
    const taken = Object.values(this.db.profiles).some(
      (p) => p.username === parsed.data && p.id !== me,
    );
    return { available: !taken };
  }

  async updateProfile(patch: ProfilePatch): Promise<Profile> {
    await this.providers.world.simulateLatency();
    const me = this.me();
    const next: Profile = { ...me };
    if (patch.username !== undefined) {
      const username = usernameSchema.parse(patch.username);
      if (!(await this.checkUsername(username)).available)
        throw new AppError('username_taken', 'That username is taken.');
      next.username = username;
    }
    if (patch.displayName !== undefined) next.displayName = patch.displayName.trim().slice(0, 40);
    if (patch.bio !== undefined) {
      if (patch.bio) moderate(patch.bio);
      next.bio = patch.bio.slice(0, 160);
    }
    if (patch.avatarUrl !== undefined) next.avatarUrl = patch.avatarUrl;
    // Region and birth year are locked after onboarding (mirrors the profiles_guard trigger).
    const locked =
      me.onboardedAt !== null &&
      ((patch.countryCode !== undefined && patch.countryCode.toUpperCase() !== me.countryCode) ||
        (patch.birthYear !== undefined && patch.birthYear !== me.birthYear));
    if (locked)
      throw new AppError('invalid_input', 'Region and birth year are locked after onboarding.');
    if (patch.countryCode !== undefined) next.countryCode = patch.countryCode.toUpperCase();
    if (patch.birthYear !== undefined) {
      if (!isAdult(patch.birthYear, new Date(this.now())))
        throw new AppError('invalid_input', 'hopium.family is only for adults 18+.');
      next.birthYear = patch.birthYear;
    }
    if (patch.interests !== undefined) next.interests = patch.interests;
    if (patch.holdingsPublic !== undefined) next.holdingsPublic = patch.holdingsPublic;
    if (patch.shareExactAmounts !== undefined) next.shareExactAmounts = patch.shareExactAmounts;
    if (patch.language !== undefined) next.language = patch.language;
    if (patch.theme !== undefined) next.theme = patch.theme;
    if (patch.riskAccepted) next.riskAcceptedAt = this.iso();
    this.db.profiles[me.id] = next;
    this.changed({ type: 'profile' });
    return next;
  }

  async completeOnboarding(): Promise<Profile> {
    const me = this.me();
    if (!me.username) throw new AppError('invalid_input', 'Choose a username first.');
    if (!me.riskAcceptedAt)
      throw new AppError('invalid_input', 'Please accept the risk disclosure.');
    if (!me.birthYear || !isAdult(me.birthYear, new Date(this.now())))
      throw new AppError('invalid_input', 'hopium.family is only for adults 18+.');
    const next = {
      ...me,
      onboardedAt: me.onboardedAt ?? this.iso(),
      displayName: me.displayName || me.username,
    };
    this.db.profiles[me.id] = next;
    this.awardBadge(me.id, 'family');
    this.changed({ type: 'profile' });
    return next;
  }

  private stats(userId: string): UserStats {
    const trades = this.db.trades.filter((t) => t.userId === userId);
    const m = traderMetrics(trades);
    const theses = this.db.theses.filter((t) => t.authorId === userId);
    const resolved = theses.filter(
      (t) => t.status === 'hit' || t.status === 'invalidated' || t.status === 'expired',
    ).length;
    const hits = theses.filter((t) => t.status === 'hit').length;
    return {
      pnlPct: round(m.pnlPct, 4),
      winRatePct: round(m.winRatePct, 2),
      thesisAccuracyPct: round(thesisAccuracyPct(hits, resolved), 2),
      followers: this.db.follows.filter((f) => f.followeeId === userId).length,
      following: this.db.follows.filter((f) => f.followerId === userId).length,
      copiers: trades.reduce((acc, t) => acc + t.copiers, 0),
      tradesCount: trades.length,
      volumeUsd: m.volumeUsd,
    };
  }

  private publicUser(p: Profile): PublicUser {
    const viewer = this.viewerId();
    const follow = viewer
      ? this.db.follows.find((f) => f.followerId === viewer && f.followeeId === p.id)
      : undefined;
    return {
      profile: p,
      stats: this.stats(p.id),
      isFollowing: !!follow,
      isBlocked:
        !!viewer && this.db.blocks.some((b) => b.blockerId === viewer && b.blockedId === p.id),
      notifyOnTrade: follow?.notify ?? false,
    };
  }

  async getFollowSuggestions(limit = 10): Promise<PublicUser[]> {
    await this.providers.world.simulateLatency();
    const viewer = this.viewerId();
    const blocked = this.blockedSet(viewer);
    const me = viewer ? this.db.profiles[viewer] : undefined;
    const likesMemes = me?.interests.includes('memecoins');
    return Object.values(this.db.profiles)
      .filter((p) => p.isDemoBot && p.id !== viewer && !blocked.has(p.id))
      .map((p) => this.publicUser(p))
      .filter((u) => !u.isFollowing)
      .sort((a, b) => {
        const score = (u: PublicUser) =>
          dec(u.stats.pnlPct).toNumber() +
          u.stats.copiers / 5 +
          u.stats.followers +
          (likesMemes && u.profile.interests.includes('memecoins') ? 10 : 0);
        return score(b) - score(a);
      })
      .slice(0, limit);
  }

  async getUser(username: string): Promise<PublicUser> {
    await this.providers.world.simulateLatency();
    const p = Object.values(this.db.profiles).find((x) => x.username === username.toLowerCase());
    if (!p) throw new AppError('not_found', 'User not found');
    const viewer = this.viewerId();
    if (
      viewer &&
      viewer !== p.id &&
      this.db.blocks.some((b) => b.blockerId === p.id && b.blockedId === viewer)
    ) {
      throw new AppError('not_found', 'User not found');
    }
    return this.publicUser(p);
  }

  private canSeeTrades(userId: string): boolean {
    const viewer = this.viewerId();
    return viewer === userId || !this.blockedSet(viewer).has(userId);
  }

  async getUserTrades(userId: string, cursor?: string | null): Promise<Page<Trade>> {
    await this.providers.world.simulateLatency();
    if (!this.canSeeTrades(userId)) return { items: [], nextCursor: null };
    const viewer = this.viewerId();
    const author = this.profile(userId);
    const own = viewer === userId;
    const all = this.db.trades
      .filter((t) => t.userId === userId && (own || t.isPublic))
      .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
      .map((t) => (own || author.shareExactAmounts ? t : this.redactTrade(t)));
    const offset = cursor ? Number(cursor) : 0;
    return {
      items: all.slice(offset, offset + 20),
      nextCursor: offset + 20 < all.length ? String(offset + 20) : null,
    };
  }

  async getUserTheses(userId: string, status: ThesisStatus | 'all' = 'all'): Promise<Thesis[]> {
    await this.providers.world.simulateLatency();
    if (!this.canSeeTrades(userId)) return [];
    return this.db.theses
      .filter((t) => t.authorId === userId && (status === 'all' || t.status === status))
      .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
  }

  private holdingViews(userId: string, balances: Record<string, Decimal>): HoldingView[] {
    const out: HoldingView[] = [];
    for (const [assetId, qty] of Object.entries(balances)) {
      if (STABLES.has(assetId) || !gt(qty, 0)) continue;
      const asset = this.asset(assetId);
      const lots = this.db.lots[lotKey(userId, assetId)] ?? [];
      const avgEntry = lots.length ? weightedAverage(lots) : asset.price;
      out.push({
        asset,
        qty,
        avgEntry,
        valueUsd: round(mul(qty, asset.price), 6),
        unrealizedPnl: round(unrealizedPnl(asset.price, avgEntry, qty), 6),
        unrealizedPnlPct: round(unrealizedPnlPct(asset.price, avgEntry), 4),
      });
    }
    return out.sort((a, b) => dec(b.valueUsd).comparedTo(dec(a.valueUsd)));
  }

  private botBalances(userId: string): Record<string, Decimal> {
    const out: Record<string, Decimal> = {};
    for (const [k, lots] of Object.entries(this.db.lots)) {
      if (!k.startsWith(`${userId}:`)) continue;
      out[k.slice(userId.length + 1)] = sum(lots.map((l) => l.qty));
    }
    return out;
  }

  private balancesOf(userId: string): Record<string, Decimal> {
    return this.db.profiles[userId]?.isDemoBot
      ? this.botBalances(userId)
      : (this.providers.world.balances[userId] ?? {});
  }

  async getUserHoldings(userId: string): Promise<HoldingView[] | null> {
    await this.providers.world.simulateLatency();
    const p = this.profile(userId);
    const viewer = this.viewerId();
    if (viewer !== userId && (!p.holdingsPublic || this.blockedSet(viewer).has(userId)))
      return null;
    return this.holdingViews(userId, this.balancesOf(userId));
  }

  async getUserBadges(userId: string): Promise<(UserBadge & { badge: Badge })[]> {
    return this.db.userBadges
      .filter((b) => b.userId === userId)
      .map((b) => ({ ...b, badge: BADGES.find((x) => x.slug === b.slug) as Badge }))
      .filter((b) => !!b.badge);
  }

  private portfolioTotal(userId: string): Decimal {
    const balances = this.balancesOf(userId);
    let total = '0';
    for (const [assetId, qty] of Object.entries(balances)) {
      total = add(total, STABLES.has(assetId) ? qty : mul(qty, this.price(assetId)));
    }
    for (const p of this.providers.perps.positionsFor(userId))
      total = add(total, add(p.margin, p.unrealizedPnl));
    return round(total, 6);
  }

  async getPortfolioHistory(
    userId: string,
    range: PortfolioRange,
  ): Promise<PortfolioPoint[] | null> {
    await this.providers.world.simulateLatency();
    const p = this.profile(userId);
    const viewer = this.viewerId();
    if (viewer !== userId && !p.holdingsPublic) return null;
    const span =
      range === '1D' ? DAY : range === '1W' ? 7 * DAY : range === '1M' ? 30 * DAY : 365 * DAY;
    const now = this.now();
    const current = this.portfolioTotal(userId);
    if (p.isDemoBot) {
      // Simulated history for demo traders, ending at today's value.
      const r = rngFor(userId, range, 'history');
      const points = 60;
      const values: number[] = [1];
      for (let i = 1; i < points; i++)
        values.push((values[i - 1] as number) * Math.exp(gaussian(r) * 0.03 + 0.002));
      const last = values[points - 1] as number;
      return values.map((v, i) => ({
        time: now - span + (span * i) / (points - 1),
        value: round(mul(current, (v / last).toFixed(10)), 2),
      }));
    }
    const snaps = (this.db.portfolioSnapshots[userId] ?? []).filter((s) => s.time >= now - span);
    const created = Date.parse(p.createdAt);
    const series: PortfolioPoint[] = [];
    if (!snaps.length || (snaps[0]?.time ?? now) > Math.max(created, now - span)) {
      series.push({ time: Math.max(created, now - span), value: snaps[0]?.value ?? '10000' });
    }
    series.push(...snaps.map((s) => ({ time: s.time, value: s.value })));
    series.push({ time: now, value: current });
    return series;
  }

  private snapshotPortfolio(): void {
    const id = this.viewerId();
    if (!id || !this.db.profiles[id]) return;
    const list = (this.db.portfolioSnapshots[id] ??= []);
    list.push({ time: this.now(), value: this.portfolioTotal(id) });
    if (list.length > 2000) list.splice(0, list.length - 2000);
    this.scheduleSave();
  }

  async follow(userId: string): Promise<void> {
    const me = this.uid();
    if (me === userId) throw new AppError('invalid_input', 'You cannot follow yourself.');
    this.profile(userId);
    if (!this.db.follows.some((f) => f.followerId === me && f.followeeId === userId)) {
      this.db.follows.push({
        followerId: me,
        followeeId: userId,
        notify: false,
        createdAt: this.iso(),
      });
    }
    if (this.db.follows.filter((f) => f.followerId === me).length >= 5)
      this.awardBadge(me, 'social');
    this.changed({ type: 'profile' });
  }

  async unfollow(userId: string): Promise<void> {
    const me = this.uid();
    this.db.follows = this.db.follows.filter(
      (f) => !(f.followerId === me && f.followeeId === userId),
    );
    this.changed({ type: 'profile' });
  }

  async setNotifyOnTrade(userId: string, on: boolean): Promise<void> {
    const me = this.uid();
    let f = this.db.follows.find((x) => x.followerId === me && x.followeeId === userId);
    if (!f && on) {
      await this.follow(userId);
      f = this.db.follows.find((x) => x.followerId === me && x.followeeId === userId);
    }
    if (f) f.notify = on;
    this.changed({ type: 'profile' });
  }

  async block(userId: string): Promise<void> {
    const me = this.uid();
    if (me === userId) throw new AppError('invalid_input');
    if (!this.db.blocks.some((b) => b.blockerId === me && b.blockedId === userId))
      this.db.blocks.push({ blockerId: me, blockedId: userId });
    this.db.follows = this.db.follows.filter(
      (f) =>
        !(
          (f.followerId === me && f.followeeId === userId) ||
          (f.followerId === userId && f.followeeId === me)
        ),
    );
    this.leaderboardCache.clear();
    this.changed({ type: 'profile' });
  }

  async unblock(userId: string): Promise<void> {
    const me = this.uid();
    this.db.blocks = this.db.blocks.filter((b) => !(b.blockerId === me && b.blockedId === userId));
    this.leaderboardCache.clear();
    this.changed({ type: 'profile' });
  }

  async report(p: {
    targetType: ReportTarget;
    targetId: string;
    reason: ReportReason;
  }): Promise<void> {
    const me = this.uid();
    await this.providers.world.simulateLatency();
    this.db.reports.push({
      id: newId('rp_'),
      reporterId: me,
      ...p,
      status: 'pending',
      createdAt: this.iso(),
    });
    // Auto-hide content with 3+ pending reports until reviewed.
    const pending = this.db.reports.filter(
      (r) => r.targetId === p.targetId && r.status === 'pending',
    ).length;
    if (p.targetType === 'post' && pending >= 3) {
      const post = this.db.posts.find((x) => x.id === p.targetId);
      if (post) post.isHidden = true;
    }
    if (p.targetType === 'comment' && pending >= 3)
      this.db.comments = this.db.comments.filter((c) => c.id !== p.targetId);
    this.scheduleSave();
  }

  async search(query: string): Promise<SearchResults> {
    await this.providers.world.simulateLatency();
    const q = query.trim().toLowerCase().replace(/^[@$]/, '');
    if (!q) return { people: [], theses: [] };
    const blocked = this.blockedSet(this.viewerId());
    const people = Object.values(this.db.profiles)
      .filter(
        (p) =>
          p.username &&
          !blocked.has(p.id) &&
          (p.username.includes(q) || p.displayName.toLowerCase().includes(q)),
      )
      .slice(0, 10);
    const theses = this.db.theses
      .filter(
        (t) =>
          !blocked.has(t.authorId) &&
          (t.symbol.toLowerCase().includes(q) || t.body.toLowerCase().includes(q)),
      )
      .slice(0, 10)
      .map((thesis) => ({ thesis, author: this.profile(thesis.authorId) }));
    return { people, theses };
  }

  // ─── feed ──────────────────────────────────────────────────────────────
  private redactTrade(t: Trade): Trade {
    return { ...t, qty: '0', notional: '0', fee: '0', realizedPnl: '0' };
  }

  private feedItem(post: Post): FeedItem {
    const author = this.db.profiles[post.authorId] ?? this.deletedProfile();
    const viewer = this.viewerId();
    const trade = post.tradeId ? (this.db.trades.find((t) => t.id === post.tradeId) ?? null) : null;
    const thesis = post.thesisId
      ? (this.db.theses.find((t) => t.id === post.thesisId) ?? null)
      : null;
    const amountsVisible = !!trade && (author.shareExactAmounts || author.id === viewer);
    return {
      post,
      author,
      trade: trade ? (amountsVisible ? trade : this.redactTrade(trade)) : null,
      thesis,
      likedByMe: !!viewer && this.db.likes.some((l) => l.postId === post.id && l.userId === viewer),
      sizeBucket: trade ? sizeBucket(trade.notional) : null,
      amountsVisible,
    };
  }

  private deletedProfile(): Profile {
    return {
      id: 'deleted',
      username: 'deleted',
      displayName: 'deleted',
      avatarUrl: null,
      bio: '',
      countryCode: null,
      birthYear: null,
      interests: [],
      holdingsPublic: false,
      shareExactAmounts: false,
      tier: 'rookie',
      kycStatus: 'none',
      language: 'en',
      theme: 'dark',
      onboardedAt: null,
      createdAt: this.iso(0),
      riskAcceptedAt: null,
    };
  }

  private visiblePosts(): Post[] {
    const blocked = this.blockedSet(this.viewerId());
    return this.db.posts.filter((p) => !p.isHidden && !blocked.has(p.authorId));
  }

  async getFeed(kind: FeedKind, cursor?: string | null): Promise<Page<FeedItem>> {
    await this.providers.world.simulateLatency();
    const viewer = this.viewerId();
    let posts = this.visiblePosts();
    const byRecency = (a: Post, b: Post) => Date.parse(b.createdAt) - Date.parse(a.createdAt);
    if (kind === 'following') {
      const followees = new Set(
        this.db.follows.filter((f) => f.followerId === viewer).map((f) => f.followeeId),
      );
      if (viewer) followees.add(viewer);
      posts = posts.filter((p) => followees.has(p.authorId)).sort(byRecency);
    } else if (kind === 'theses') {
      posts = posts.filter((p) => p.kind === 'thesis').sort(byRecency);
    } else {
      // Engagement velocity over the last 24h (widened for sparse demo data).
      const now = this.now();
      const velocity = (p: Post) => {
        const hours = (now - Date.parse(p.createdAt)) / 3_600_000;
        return (p.likeCount + 2 * p.commentCount + 1) / Math.pow(hours + 2, 1.5);
      };
      posts = posts
        .filter((p) => now - Date.parse(p.createdAt) < 7 * DAY)
        .sort((a, b) => velocity(b) - velocity(a));
    }
    const offset = cursor ? Number(cursor) : 0;
    const items = posts.slice(offset, offset + FEED_PAGE).map((p) => this.feedItem(p));
    return {
      items,
      nextCursor: offset + FEED_PAGE < posts.length ? String(offset + FEED_PAGE) : null,
    };
  }

  async getPost(postId: string): Promise<FeedItem> {
    await this.providers.world.simulateLatency();
    const post = this.visiblePosts().find((p) => p.id === postId);
    if (!post) throw new AppError('not_found', 'Post not found');
    return this.feedItem(post);
  }

  async getLegendsBuying(): Promise<LegendBuy[]> {
    await this.providers.world.simulateLatency();
    const blocked = this.blockedSet(this.viewerId());
    const seen = new Set<string>();
    const out: LegendBuy[] = [];
    const legendTiers = new Set(['legend', 'whale', 'degen']);
    const trades = [...this.db.trades]
      .filter((t) => t.side === 'buy' && t.isPublic && !blocked.has(t.userId))
      .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
    for (const t of trades) {
      const p = this.db.profiles[t.userId];
      if (!p || !legendTiers.has(p.tier) || seen.has(p.id)) continue;
      const post = this.db.posts.find((x) => x.tradeId === t.id);
      if (!post) continue;
      seen.add(p.id);
      out.push({
        profile: p,
        trade: p.shareExactAmounts ? t : this.redactTrade(t),
        postId: post.id,
      });
      if (out.length >= 12) break;
    }
    return out;
  }

  async like(postId: string): Promise<void> {
    const me = this.uid();
    const post = this.db.posts.find((p) => p.id === postId);
    if (!post) throw new AppError('not_found');
    if (this.db.likes.some((l) => l.postId === postId && l.userId === me)) return;
    this.db.likes.push({ postId, userId: me });
    post.likeCount += 1;
    this.scheduleSave();
  }

  async unlike(postId: string): Promise<void> {
    const me = this.uid();
    const post = this.db.posts.find((p) => p.id === postId);
    if (!post) throw new AppError('not_found');
    const before = this.db.likes.length;
    this.db.likes = this.db.likes.filter((l) => !(l.postId === postId && l.userId === me));
    if (this.db.likes.length < before) post.likeCount = Math.max(0, post.likeCount - 1);
    this.scheduleSave();
  }

  async getComments(postId: string): Promise<CommentWithAuthor[]> {
    await this.providers.world.simulateLatency();
    const blocked = this.blockedSet(this.viewerId());
    return this.db.comments
      .filter((c) => c.postId === postId && !blocked.has(c.authorId))
      .sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt))
      .map((c) => ({ ...c, author: this.db.profiles[c.authorId] ?? this.deletedProfile() }));
  }

  async addComment(
    postId: string,
    body: string,
    parentId: string | null = null,
  ): Promise<CommentWithAuthor> {
    const me = this.me();
    const text = commentSchema.parse(body);
    moderate(text);
    const post = this.db.posts.find((p) => p.id === postId);
    if (!post) throw new AppError('not_found');
    if (this.blockedSet(me.id).has(post.authorId)) throw new AppError('blocked');
    await this.providers.world.simulateLatency();
    const c = {
      id: newId('co_'),
      postId,
      authorId: me.id,
      body: text,
      parentId,
      createdAt: this.iso(),
    };
    this.db.comments.push(c);
    post.commentCount += 1;
    if (post.authorId !== me.id) {
      this.notify(
        post.authorId,
        'social_comment',
        'notifications.comment.title',
        'notifications.comment.body',
        { username: me.username },
        { href: `/post/${post.id}` },
      );
    }
    this.scheduleSave();
    return { ...c, author: me };
  }

  // ─── config & compliance ───────────────────────────────────────────────
  async getAppConfig(): Promise<AppConfig> {
    const s = seasonFor(this.now());
    return {
      fees: DEFAULT_FEES,
      minOrderUsd: DEFAULT_MIN_ORDER_USD,
      maxSlippageBps: 2000,
      tierThresholds: DEFAULT_TIER_THRESHOLDS,
      idrPerUsd: '16250',
      season: { name: s.name, endsAt: s.endsAt },
    };
  }

  async getRegionRule(): Promise<RegionRule> {
    const me = await this.getMe();
    return this.regionRule(me?.countryCode ?? null);
  }

  async getKycStatus(): Promise<KycStatus> {
    return this.providers.kyc.getStatus();
  }

  async startKyc(): Promise<void> {
    const me = this.me();
    await this.providers.kyc.start();
    this.emit({ type: 'kyc', status: 'pending' });
    const off = this.providers.world.onChange(() => {
      const status = this.providers.world.kyc[me.id];
      if (status === 'approved' || status === 'rejected') {
        const p = this.db.profiles[me.id];
        if (p) p.kycStatus = status;
        off();
        this.changed({ type: 'kyc', status }, { type: 'profile' });
      }
    });
  }

  // ─── spot trading ──────────────────────────────────────────────────────
  async quoteSpot(req: SpotQuoteRequest): Promise<SpotQuote> {
    const me = this.me();
    const asset = this.asset(req.assetId);
    if (asset.class === 'perp') throw new AppError('invalid_input');
    const assetClass = asset.class;
    const feeRate = spotFeeRate(assetClass);
    const balance = this.providers.world.balance(me.id, asset.id);
    let qty = req.qty;
    let notionalUsd = req.amountUsd;
    if (req.side === 'sell') {
      if (!qty) qty = round(div(notionalUsd ?? '0', asset.price), 12, 'down');
      qty = min(qty, balance);
      notionalUsd = round(mul(qty, asset.price), 6);
    } else if (!notionalUsd) {
      notionalUsd = round(mul(qty ?? '0', asset.price), 6);
    }
    if (!gt(notionalUsd ?? '0', 0) || (req.side === 'sell' && !gt(qty ?? '0', 0))) {
      throw new AppError(
        req.side === 'sell' && !gt(balance, 0) ? 'insufficient_balance' : 'invalid_amount',
      );
    }
    const notional = notionalUsd as Decimal;
    let raw: SwapQuote | StockQuote;
    let outQty: Decimal;
    let price: Decimal;
    let impact: Decimal;
    let networkFeeUsd: Decimal = '0';
    let gasSponsored = true;
    if (assetClass === 'stock_token') {
      const q = await this.providers.stockTokens.quote({
        assetId: asset.id,
        side: req.side,
        notionalUsd: notional,
        feeRate,
      });
      raw = req.side === 'sell' ? { ...q, qty: qty as Decimal } : q;
      outQty = req.side === 'sell' ? (qty as Decimal) : q.qty;
      price = q.price;
      impact = q.priceImpactPct;
    } else {
      const chain = asset.chain ?? 'solana';
      const feeBps = Number(mul(feeRate, 10_000));
      const q =
        req.side === 'buy'
          ? await this.providers.swap.quote({
              from: USDC_ID,
              to: asset.id,
              amountIn: notional,
              slippageBps: req.slippageBps,
              chain,
              feeBps,
            })
          : await this.providers.swap.quote({
              from: asset.id,
              to: USDC_ID,
              amountIn: qty as Decimal,
              slippageBps: req.slippageBps,
              chain,
              feeBps,
            });
      raw = q;
      outQty = req.side === 'buy' ? q.amountOut : (qty as Decimal);
      price = req.side === 'buy' ? q.price : div(q.amountOut, q.amountIn);
      impact = q.priceImpactPct;
      networkFeeUsd = q.networkFeeUsd;
      gasSponsored = q.gasSponsored;
    }
    const grossUsd = req.side === 'buy' ? notional : round(mul(outQty, price), 6);
    const platformFeeUsd = feeOf(grossUsd, feeRate);
    const totalUsd =
      req.side === 'buy'
        ? round(add(add(grossUsd, platformFeeUsd), networkFeeUsd), 6)
        : round(max('0', sub(sub(grossUsd, platformFeeUsd), networkFeeUsd)), 6);
    const quote: SpotQuote = {
      id: raw.id,
      assetId: asset.id,
      symbol: asset.symbol,
      assetClass,
      side: req.side,
      notionalUsd: grossUsd,
      qty: outQty,
      price,
      priceImpactPct: round(impact, 6),
      networkFeeUsd,
      gasSponsored,
      platformFeeUsd,
      feeRate,
      totalUsd,
      slippageBps: req.slippageBps,
      expiresAt: raw.expiresAt,
    };
    this.quotes.set(quote.id, { raw, quote });
    return quote;
  }

  async placeSpotOrder(quote: SpotQuote, opts: PlaceSpotOrderOptions): Promise<SpotOrderResult> {
    const me = this.me();
    if (quote.assetClass === 'stock_token') this.assertFeature('stock_tokens');
    if (opts.copiedFromTradeId) this.assertFeature('copy_trade');
    assertMinOrder(quote.notionalUsd, quote.assetClass);
    const stored = this.quotes.get(quote.id);
    if (!stored || this.now() > quote.expiresAt)
      throw new AppError('quote_expired', 'This quote expired. Refreshing…');
    if (exceedsSlippage(quote.priceImpactPct, quote.slippageBps))
      throw new AppError('slippage_exceeded', 'Price impact is above your slippage setting.');
    if (quote.side === 'buy' && !this.providers.world.hasBalance(me.id, USDC_ID, quote.totalUsd)) {
      throw new AppError('insufficient_balance', 'Not enough balance for this order.');
    }
    const order: Order = {
      id: newId('or_'),
      userId: me.id,
      assetId: quote.assetId,
      class: quote.assetClass,
      side: quote.side,
      type: 'market',
      amountIn: quote.side === 'buy' ? quote.notionalUsd : quote.qty,
      amountOut: '0',
      price: quote.price,
      fee: quote.platformFeeUsd,
      slippageBps: quote.slippageBps,
      status: 'pending',
      txHash: null,
      errorCode: null,
      copiedFromTradeId: opts.copiedFromTradeId ?? null,
      createdAt: this.iso(),
    };
    this.db.orders.unshift(order);
    this.quotes.delete(quote.id);
    let tx: TxResult;
    try {
      tx =
        quote.assetClass === 'stock_token'
          ? await this.providers.stockTokens.execute(stored.raw as StockQuote)
          : await this.providers.swap.execute(stored.raw as SwapQuote);
    } catch (err) {
      const e = toAppError(err);
      Object.assign(order, { status: 'failed', errorCode: e.code });
      this.changed({ type: 'orders' });
      throw e;
    }
    const filledQty =
      quote.side === 'buy'
        ? (tx.filled?.amountOut ?? quote.qty)
        : (tx.filled?.amountIn ?? quote.qty);
    const fillPrice = tx.filled?.price ?? quote.price;
    const notional = round(mul(filledQty, fillPrice), 6);
    Object.assign(order, {
      status: 'filled',
      amountOut: quote.side === 'buy' ? filledQty : notional,
      price: fillPrice,
      txHash: tx.txHash,
    });

    // Holdings / FIFO lots (mirrors the on-trade trigger).
    const key = lotKey(me.id, quote.assetId);
    let lots: Lot[] = this.db.lots[key] ?? [];
    let realizedPnl = '0';
    if (quote.side === 'buy') {
      lots = [...lots, { qty: filledQty, price: fillPrice }];
    } else {
      const heldInLots = sum(lots.map((l) => l.qty));
      if (lt(heldInLots, filledQty))
        lots = [...lots, { qty: sub(filledQty, heldInLots), price: fillPrice }];
      const res = fifoSell(lots, filledQty, fillPrice);
      realizedPnl = round(res.realizedPnl, 6);
      lots = res.remainingLots;
    }
    if (lots.length) this.db.lots[key] = lots;
    else delete this.db.lots[key];

    const isFirstTrade = !this.db.trades.some((t) => t.userId === me.id);
    const trade: Trade = {
      id: newId('tr_'),
      userId: me.id,
      orderId: order.id,
      assetId: quote.assetId,
      symbol: quote.symbol,
      assetClass: quote.assetClass,
      side: quote.side,
      qty: filledQty,
      price: fillPrice,
      notional,
      fee: quote.platformFeeUsd,
      realizedPnl,
      isPublic: opts.shareToFeed,
      copiedFromTradeId: opts.copiedFromTradeId ?? null,
      copiers: 0,
      createdAt: this.iso(),
    };
    this.db.trades.push(trade);
    if (opts.copiedFromTradeId) {
      const original = this.db.trades.find((t) => t.id === opts.copiedFromTradeId);
      if (original) original.copiers += 1;
      this.awardBadge(me.id, 'copycat');
    }
    if (trade.isPublic) this.publishTradePost(trade);
    if (isFirstTrade) {
      this.awardBadge(me.id, 'first_trade');
      this.emit({ type: 'milestone', kind: 'first_trade', params: {} });
    }
    if (quote.assetClass === 'stock_token') this.awardBadge(me.id, 'stock_token');
    this.updateTier(me.id);
    this.addActivity(me.id, {
      kind: 'trade',
      title: quote.side,
      symbol: quote.symbol,
      amountUsd: notional,
      qty: filledQty,
      side: quote.side,
      status: 'completed',
      txHash: tx.txHash,
      chain: tx.chain,
    });
    this.notify(
      me.id,
      'order_filled',
      'notifications.orderFilled.title',
      'notifications.orderFilled.body',
      { side: quote.side, symbol: quote.symbol },
      { href: `/asset/${quote.symbol}` },
    );
    this.snapshotPortfolio();
    this.leaderboardCache.clear();
    this.changed({ type: 'orders' }, { type: 'balances' });
    return { order, trade, isFirstTrade, txExplorerUrl: tx.explorerUrl };
  }

  private publishTradePost(trade: Trade): Post {
    const post: Post = {
      id: newId('po_'),
      authorId: trade.userId,
      kind: 'trade',
      tradeId: trade.id,
      thesisId: null,
      body: '',
      milestone: null,
      likeCount: 0,
      commentCount: 0,
      isHidden: false,
      createdAt: trade.createdAt,
    };
    this.db.posts.push(post);
    const author = this.profile(trade.userId);
    // Fan out followed-trade notifications (trigger on trades insert).
    for (const f of this.db.follows.filter((x) => x.followeeId === trade.userId)) {
      const loud = f.notify || author.tier === 'legend' || author.tier === 'whale';
      if (!loud) continue;
      this.notify(
        f.followerId,
        'followed_trade',
        'notifications.followedTrade.title',
        trade.side === 'buy'
          ? 'notifications.followedTrade.bodyBuy'
          : 'notifications.followedTrade.bodySell',
        { username: author.username, symbol: trade.symbol },
        { href: `/post/${post.id}` },
        f.notify,
      );
    }
    this.changed({ type: 'feed:new', postId: post.id, authorId: trade.userId });
    if (!author.isDemoBot) this.scheduleEngagement(post);
    return post;
  }

  private updateTier(userId: string): void {
    const p = this.db.profiles[userId];
    if (!p) return;
    const volume = sum(this.db.trades.filter((t) => t.userId === userId).map((t) => t.notional));
    const tier = tierForVolume(volume);
    if (tier !== p.tier) {
      p.tier = tier;
      if (tier === 'legend') this.awardBadge(userId, 'legend');
      this.changed({ type: 'profile' });
    }
  }

  async getPortfolio(): Promise<PortfolioSummary> {
    const me = this.me();
    const balances = this.providers.world.balances[me.id] ?? {};
    let cash = '0';
    for (const [assetId, qty] of Object.entries(balances))
      if (STABLES.has(assetId)) cash = add(cash, qty);
    const holdings = this.holdingViews(me.id, balances);
    const cryptoUsd = sum(
      holdings.filter((h) => h.asset.class === 'crypto').map((h) => h.valueUsd),
    );
    const stockTokensUsd = sum(
      holdings.filter((h) => h.asset.class === 'stock_token').map((h) => h.valueUsd),
    );
    const positions = this.providers.perps.positionsFor(me.id);
    const perpsMarginUsd = sum(positions.map((p) => p.margin));
    const perpsUnrealizedUsd = sum(positions.map((p) => p.unrealizedPnl));
    return {
      totalUsd: round(
        sum([cash, cryptoUsd, stockTokensUsd, perpsMarginUsd, perpsUnrealizedUsd]),
        6,
      ),
      cashUsd: cash,
      cryptoUsd,
      stockTokensUsd,
      perpsMarginUsd,
      perpsUnrealizedUsd,
      holdings,
    };
  }

  async getHolding(assetId: string): Promise<HoldingView | null> {
    const me = this.me();
    const qty = this.providers.world.balance(me.id, assetId);
    if (!gt(qty, 0)) return null;
    return this.holdingViews(me.id, { [assetId]: qty })[0] ?? null;
  }

  async getOrders(): Promise<Order[]> {
    const me = this.uid();
    return this.db.orders.filter((o) => o.userId === me);
  }

  async getActivity(kind: ActivityKind | 'all' = 'all'): Promise<ActivityItem[]> {
    await this.providers.world.simulateLatency();
    const list = this.db.activity[this.uid()] ?? [];
    return kind === 'all'
      ? list
      : list.filter((a) => a.kind === kind || (kind === 'perp_open' && a.kind.startsWith('perp')));
  }

  async getAssetHoldersIFollow(assetId: string): Promise<Profile[]> {
    const viewer = this.viewerId();
    if (!viewer) return [];
    const followees = this.db.follows
      .filter((f) => f.followerId === viewer)
      .map((f) => f.followeeId);
    return followees
      .map((id) => this.db.profiles[id])
      .filter(
        (p): p is Profile =>
          !!p && p.holdingsPublic && gt(this.balancesOf(p.id)[assetId] ?? '0', 0),
      );
  }

  async getAssetTheses(assetId: string): Promise<{ thesis: Thesis; author: Profile }[]> {
    await this.providers.world.simulateLatency();
    const blocked = this.blockedSet(this.viewerId());
    return this.db.theses
      .filter((t) => t.assetId === assetId && !blocked.has(t.authorId))
      .sort(
        (a, b) =>
          Number(b.status === 'active') - Number(a.status === 'active') ||
          Date.parse(b.createdAt) - Date.parse(a.createdAt),
      )
      .slice(0, 10)
      .map((thesis) => ({ thesis, author: this.profile(thesis.authorId) }));
  }

  // ─── perps ─────────────────────────────────────────────────────────────
  async getPerpMarkets(): Promise<PerpMarket[]> {
    return this.providers.perps.listMarkets();
  }

  async getPerpMarket(marketId: string): Promise<PerpMarket> {
    await this.providers.world.simulateLatency();
    return this.providers.perps.marketSync(marketId.toLowerCase());
  }

  async getPositions(): Promise<PerpPosition[]> {
    return this.providers.perps.positionsFor(this.uid());
  }

  async getPositionHistory(): Promise<PerpPosition[]> {
    return this.providers.perps
      .positionsFor(this.uid(), true)
      .filter((p) => p.status !== 'open')
      .sort((a, b) => Date.parse(b.closedAt ?? '') - Date.parse(a.closedAt ?? ''));
  }

  async openPerp(req: OpenPerpRequest): Promise<PerpPosition> {
    const me = this.me();
    this.assertFeature('perps');
    if (isHighLeverage(req.leverage) && !req.acknowledgedHighLeverage) {
      throw new AppError(
        'high_leverage_unacknowledged',
        'Please acknowledge the high-leverage risk.',
      );
    }
    const position = await this.providers.perps.openPosition(req);
    this.addActivity(me.id, {
      kind: 'perp_open',
      title: position.side,
      symbol: position.symbol,
      amountUsd: position.margin,
      qty: position.size,
      side: position.side,
      status: 'completed',
      txHash: fakeTxHash('arbitrum'),
      chain: 'arbitrum',
    });
    this.awardBadge(me.id, 'perp_pioneer');
    this.snapshotPortfolio();
    this.changed({ type: 'positions' });
    return position;
  }

  async closePerp(positionId: string, sizePct: number): Promise<TxResult> {
    const me = this.me();
    const before = this.providers.perps.positionsFor(me.id).find((p) => p.id === positionId);
    const tx = await this.providers.perps.closePosition(positionId, sizePct);
    if (before) {
      this.addActivity(me.id, {
        kind: 'perp_close',
        title: before.side,
        symbol: before.symbol,
        amountUsd: round(mul(before.margin, div(sizePct, 100)), 6),
        qty: round(mul(before.size, div(sizePct, 100)), 10),
        side: before.side,
        status: 'completed',
        txHash: tx.txHash,
        chain: tx.chain,
      });
    }
    delete this.db.liquidationWarned[positionId];
    this.snapshotPortfolio();
    this.changed({ type: 'positions' });
    return tx;
  }

  async setTpSl(positionId: string, tp?: Decimal, sl?: Decimal): Promise<void> {
    await this.providers.perps.setTpSl(positionId, tp, sl);
    this.changed({ type: 'positions' });
  }

  private onPerpEvent(type: 'liquidated' | 'tp_triggered' | 'sl_triggered', p: PerpPosition): void {
    if (type === 'liquidated') {
      this.addActivity(p.userId, {
        kind: 'perp_liquidation',
        title: p.side,
        symbol: p.symbol,
        amountUsd: p.margin,
        qty: p.size,
        side: p.side,
        status: 'completed',
        txHash: null,
        chain: 'arbitrum',
      });
      this.notify(
        p.userId,
        'liquidated',
        'notifications.liquidated.title',
        'notifications.liquidated.body',
        { market: p.symbol },
        { href: `/perps/${p.marketId}` },
        true,
      );
    } else {
      this.addActivity(p.userId, {
        kind: 'perp_close',
        title: type,
        symbol: p.symbol,
        amountUsd: p.margin,
        qty: p.size,
        side: p.side,
        status: 'completed',
        txHash: null,
        chain: 'arbitrum',
      });
      this.notify(
        p.userId,
        'order_filled',
        type === 'tp_triggered' ? 'notifications.tpHit.title' : 'notifications.slHit.title',
        'notifications.tpslHit.body',
        { market: p.symbol },
        { href: `/perps/${p.marketId}` },
        true,
      );
    }
    delete this.db.liquidationWarned[p.id];
    this.changed({ type: 'positions' });
  }

  /** liquidation-watch: warn once when mark is within 10% of liquidation. */
  private checkLiquidationRisk(): void {
    const id = this.viewerId();
    if (!id) return;
    for (const p of this.providers.perps.positionsFor(id)) {
      const near = isNearLiquidation(p.side, p.markPrice, p.liqPrice);
      if (near && !this.db.liquidationWarned[p.id]) {
        this.db.liquidationWarned[p.id] = true;
        this.notify(
          id,
          'liquidation_risk',
          'notifications.liquidationRisk.title',
          'notifications.liquidationRisk.body',
          { market: p.symbol },
          { href: `/perps/${p.marketId}` },
          true,
        );
      } else if (!near && this.db.liquidationWarned[p.id]) {
        delete this.db.liquidationWarned[p.id];
      }
    }
  }

  // ─── wallet ────────────────────────────────────────────────────────────
  async getAddresses(): Promise<Record<Chain, string>> {
    return demoAddresses(this.uid());
  }

  async getOnrampQuote(p: { fiat: Fiat; fiatAmount: Decimal }): Promise<OnrampQuote> {
    this.uid();
    return this.providers.onramp.getQuote({ ...p, asset: USDC_ID, chain: 'solana' });
  }

  async deposit(quote: OnrampQuote, method: PaymentMethod): Promise<OnrampResult> {
    const me = this.me();
    const result = await this.providers.onramp.startPurchase(quote, method);
    if (result.status === 'completed') {
      this.addActivity(me.id, {
        kind: 'deposit',
        title: method,
        symbol: 'USDC',
        amountUsd: result.cryptoAmount,
        qty: result.cryptoAmount,
        side: null,
        status: 'completed',
        txHash: fakeTxHash('solana'),
        chain: 'solana',
      });
      this.notify(
        me.id,
        'deposit',
        'notifications.deposit.title',
        'notifications.deposit.body',
        { amount: result.cryptoAmount },
        { href: '/wallet' },
      );
      this.snapshotPortfolio();
    }
    return result;
  }

  async getWithdrawFee(chain: Chain): Promise<Decimal> {
    return WITHDRAW_FEE_USD[chain];
  }

  async withdraw(req: WithdrawRequest): Promise<ActivityItem> {
    const me = this.me();
    this.assertFeature('withdraw');
    if (!isValidAddress(req.chain, req.address))
      throw new AppError('invalid_input', 'That address is not valid for this network.');
    if (!gt(req.amount, 0)) throw new AppError('invalid_amount');
    const asset = this.asset(req.assetId);
    const feeUsd = WITHDRAW_FEE_USD[req.chain];
    const world = this.providers.world;
    if (!world.hasBalance(me.id, asset.id, req.amount))
      throw new AppError('insufficient_balance', 'Not enough balance for this order.');
    const feeFromSame = asset.id === USDC_ID;
    if (!world.hasBalance(me.id, USDC_ID, feeFromSame ? add(req.amount, feeUsd) : feeUsd)) {
      throw new AppError('insufficient_balance', 'Not enough USDC to cover the network fee.');
    }
    let tx: TxResult;
    if (asset.class === 'stock_token') {
      tx = await this.providers.stockTokens.transfer({
        assetId: asset.id,
        amount: req.amount,
        to: req.address,
      });
    } else {
      tx = await this.providers.wallet.signAndSend({
        chain: req.chain,
        to: req.address,
        value: req.amount,
        memo: asset.symbol,
      });
      world.debit(me.id, asset.id, req.amount);
    }
    world.debit(me.id, USDC_ID, feeUsd);
    const usd = STABLES.has(asset.id) ? req.amount : round(mul(req.amount, asset.price), 6);
    const item = this.addActivity(me.id, {
      kind: 'withdrawal',
      title: CHAIN_META[req.chain].name,
      symbol: asset.symbol,
      amountUsd: usd,
      qty: req.amount,
      side: null,
      status: 'completed',
      txHash: tx.txHash,
      chain: req.chain,
    });
    this.snapshotPortfolio();
    this.changed({ type: 'balances' });
    return item;
  }

  async exportWallet(): Promise<void> {
    await this.providers.wallet.exportWallet();
  }

  // ─── theses ────────────────────────────────────────────────────────────
  async createThesis(input: ThesisInput): Promise<Thesis> {
    const me = this.me();
    const parsed = thesisSchema.parse(input);
    moderate(parsed.body);
    const asset = this.asset(parsed.assetId);
    const entry = asset.price;
    const errors = validateThesisPrices(
      parsed.direction,
      entry,
      parsed.targetPrice,
      parsed.invalidationPrice,
    );
    if (errors.length) throw new AppError('invalid_input', errors[0]);
    await this.providers.world.simulateLatency();
    const thesis: Thesis = {
      id: newId('th_'),
      authorId: me.id,
      assetId: asset.id,
      symbol: asset.symbol,
      direction: parsed.direction,
      entryPrice: entry,
      targetPrice: parsed.targetPrice,
      invalidationPrice: parsed.invalidationPrice,
      timeframeEnd: parsed.timeframeEnd,
      body: parsed.body,
      imageUrl: parsed.imageUrl,
      status: 'active',
      resolvedAt: null,
      maxFavorablePct: '0',
      createdAt: this.iso(),
    };
    this.db.theses.push(thesis);
    // Trigger: thesis insert → post.
    const post: Post = {
      id: newId('po_'),
      authorId: me.id,
      kind: 'thesis',
      tradeId: null,
      thesisId: thesis.id,
      body: '',
      milestone: null,
      likeCount: 0,
      commentCount: 0,
      isHidden: false,
      createdAt: thesis.createdAt,
    };
    this.db.posts.push(post);
    this.awardBadge(me.id, 'first_thesis');
    this.scheduleEngagement(post);
    this.changed({ type: 'feed:new', postId: post.id, authorId: me.id });
    return thesis;
  }

  async getThesis(thesisId: string): Promise<ThesisDetail> {
    await this.providers.world.simulateLatency();
    const thesis = this.db.theses.find((t) => t.id === thesisId);
    if (!thesis || this.blockedSet(this.viewerId()).has(thesis.authorId))
      throw new AppError('not_found', 'Thesis not found');
    const post = this.db.posts.find((p) => p.thesisId === thesisId);
    if (!post) throw new AppError('not_found');
    return { thesis, author: this.profile(thesis.authorId), item: this.feedItem(post) };
  }

  /** resolve-theses: hit / invalidated / expired from live prices. */
  resolveTheses(): void {
    const now = this.now();
    for (const t of this.db.theses) {
      if (t.status !== 'active') continue;
      const price = this.providers.marketData.lastPrice(t.assetId);
      if (!price) continue;
      const { status, maxFavorablePct } = resolveThesis(t, price, now);
      t.maxFavorablePct = round(maxFavorablePct, 4);
      if (status === 'active') continue;
      t.status = status;
      t.resolvedAt = this.iso(now);
      const mine = t.authorId === this.viewerId();
      if (status === 'hit') this.awardBadge(t.authorId, 'oracle');
      this.notify(
        t.authorId,
        'thesis_update',
        `notifications.thesis.${status}.title`,
        'notifications.thesis.body',
        { symbol: t.symbol },
        { href: `/thesis/${t.id}` },
      );
      this.emit({ type: 'thesis:resolved', thesis: t, mine });
      if (mine && status === 'hit')
        this.emit({ type: 'milestone', kind: 'thesis_hit', params: { symbol: t.symbol } });
      this.leaderboardCache.clear();
      this.scheduleSave();
    }
  }

  // ─── leaderboard ───────────────────────────────────────────────────────
  private periodStart(period: LeaderboardPeriod, at: number): number {
    if (period === 'season') return Date.parse(seasonFor(at).startsAt);
    if (period === 'all_time') return 0;
    return at - PERIOD_MS[period];
  }

  private computeBoard(
    period: LeaderboardPeriod,
    metric: LeaderboardMetric,
    at: number,
  ): { userId: string; value: Decimal }[] {
    const blocked = this.blockedSet(this.viewerId());
    const start = this.periodStart(period, at);
    const users = Object.values(this.db.profiles).filter(
      (p) => p.username && p.onboardedAt && !blocked.has(p.id),
    );
    const rows: { userId: string; value: Decimal }[] = [];
    for (const u of users) {
      const trades = this.db.trades.filter(
        (t) =>
          t.userId === u.id && Date.parse(t.createdAt) >= start && Date.parse(t.createdAt) <= at,
      );
      if (metric === 'pnl_pct') {
        const m = traderMetrics(trades);
        if (!qualifies(m) || isSuspectedWashTrading(trades)) continue;
        rows.push({ userId: u.id, value: round(m.pnlPct, 4) });
      } else if (metric === 'thesis_accuracy') {
        const resolved = this.db.theses.filter(
          (t) =>
            t.authorId === u.id &&
            t.status !== 'active' &&
            Date.parse(t.resolvedAt ?? t.createdAt) >= start &&
            Date.parse(t.resolvedAt ?? t.createdAt) <= at,
        );
        if (resolved.length < 2) continue;
        rows.push({
          userId: u.id,
          value: round(
            thesisAccuracyPct(resolved.filter((t) => t.status === 'hit').length, resolved.length),
            2,
          ),
        });
      } else {
        rows.push({ userId: u.id, value: String(trades.reduce((acc, t) => acc + t.copiers, 0)) });
      }
    }
    return rows;
  }

  async getLeaderboard(period: LeaderboardPeriod, metric: LeaderboardMetric): Promise<Leaderboard> {
    await this.providers.world.simulateLatency();
    const key = `${period}:${metric}`;
    const cached = this.leaderboardCache.get(key);
    const at = this.now();
    if (cached && at - cached.at < 60_000) return this.withMe(cached.board);
    const rows = this.computeBoard(period, metric, at);
    const shift =
      period === 'daily'
        ? 6 * 3_600_000
        : period === 'weekly'
          ? DAY
          : period === 'season'
            ? 3 * DAY
            : 7 * DAY;
    const prevRanks = new Map(
      rankBy(this.computeBoard(period, metric, at - shift), (r) => r.value).map((r) => [
        r.item.userId,
        r.rank,
      ]),
    );
    const ranked = rankBy(rows, (r) => r.value);
    const entries: LeaderboardEntry[] = ranked.slice(0, 100).map(({ item, rank }) => ({
      userId: item.userId,
      profile: this.profile(item.userId),
      rank,
      previousRank: prevRanks.get(item.userId) ?? null,
      value: item.value,
    }));
    const s = seasonFor(at);
    const board: Leaderboard = {
      period,
      metric,
      entries,
      me: null,
      computedAt: this.iso(at),
      season: { name: s.name, endsAt: s.endsAt },
    };
    this.leaderboardCache.set(key, { at, board });
    return this.withMe(board);
  }

  private withMe(board: Leaderboard): Leaderboard {
    const viewer = this.viewerId();
    if (!viewer) return board;
    const inList = board.entries.find((e) => e.userId === viewer);
    if (inList) return { ...board, me: inList };
    const profile = this.db.profiles[viewer];
    if (!profile) return board;
    const row = this.computeBoard(board.period, board.metric, this.now()).find(
      (r) => r.userId === viewer,
    );
    if (!row)
      return { ...board, me: { userId: viewer, profile, rank: 0, previousRank: null, value: '0' } };
    const better = board.entries.filter((e) => dec(e.value).greaterThan(dec(row.value))).length;
    return {
      ...board,
      me: { userId: viewer, profile, rank: better + 1, previousRank: null, value: row.value },
    };
  }

  private async checkRankUp(): Promise<void> {
    const viewer = this.viewerId();
    if (!viewer) return;
    const board = await this.getLeaderboard('weekly', 'pnl_pct');
    const rank = board.me?.rank ?? 0;
    if (rank > 0 && this.lastRank !== null && rank < this.lastRank) {
      this.notify(
        viewer,
        'rank_up',
        'notifications.rankUp.title',
        'notifications.rankUp.body',
        { rank },
        { href: '/leaderboard' },
      );
      this.emit({ type: 'milestone', kind: 'rank_up', params: { rank } });
    }
    if (rank > 0) this.lastRank = rank;
  }

  // ─── notifications & alerts ────────────────────────────────────────────
  async getNotifications(): Promise<AppNotification[]> {
    const me = this.viewerId();
    if (!me) return [];
    return this.db.notifications.filter((n) => n.userId === me);
  }

  async markNotificationRead(id: string): Promise<void> {
    const n = this.db.notifications.find((x) => x.id === id && x.userId === this.uid());
    if (n && !n.readAt) n.readAt = this.iso();
    this.scheduleSave();
  }

  async markAllNotificationsRead(): Promise<void> {
    const me = this.uid();
    for (const n of this.db.notifications) if (n.userId === me && !n.readAt) n.readAt = this.iso();
    this.scheduleSave();
  }

  async deleteNotification(id: string): Promise<void> {
    const me = this.uid();
    this.db.notifications = this.db.notifications.filter((n) => !(n.id === id && n.userId === me));
    this.scheduleSave();
  }

  async getNotificationSettings(): Promise<NotificationSettings> {
    return { ...this.settingsFor(this.uid()) };
  }

  async updateNotificationSettings(
    patch: Partial<NotificationSettings>,
  ): Promise<NotificationSettings> {
    const me = this.uid();
    const next = { ...this.settingsFor(me), ...patch };
    this.db.notificationSettings[me] = next;
    this.scheduleSave();
    return next;
  }

  async registerPushToken(token: string, platform: 'ios' | 'android' | 'web'): Promise<void> {
    const me = this.uid();
    if (!this.db.pushTokens.some((t) => t.token === token))
      this.db.pushTokens.push({ userId: me, token, platform });
    this.scheduleSave();
  }

  async getPriceAlerts(): Promise<PriceAlert[]> {
    const me = this.uid();
    return this.db.priceAlerts.filter((a) => a.userId === me);
  }

  async createPriceAlert(p: {
    assetId: string;
    condition: PriceAlertCondition;
    value: Decimal;
  }): Promise<PriceAlert> {
    const me = this.uid();
    if (!gt(p.value, 0)) throw new AppError('invalid_amount');
    const asset = this.asset(p.assetId);
    const alert: PriceAlert = {
      id: newId('pa_'),
      userId: me,
      assetId: asset.id,
      symbol: asset.symbol,
      condition: p.condition,
      value: p.value,
      basePrice: asset.price,
      isActive: true,
      triggeredAt: null,
      createdAt: this.iso(),
    };
    this.db.priceAlerts.push(alert);
    this.scheduleSave();
    return alert;
  }

  async deletePriceAlert(id: string): Promise<void> {
    const me = this.uid();
    this.db.priceAlerts = this.db.priceAlerts.filter((a) => !(a.id === id && a.userId === me));
    this.scheduleSave();
  }

  /** check-price-alerts */
  checkPriceAlerts(): void {
    for (const a of this.db.priceAlerts) {
      if (!a.isActive) continue;
      const price = this.providers.marketData.lastPrice(a.assetId);
      if (!price) continue;
      const hit =
        a.condition === 'above'
          ? gte(price, a.value)
          : a.condition === 'below'
            ? !gt(price, a.value)
            : !lt(dec(pctChange(a.basePrice, price)).abs().toFixed(), a.value);
      if (!hit) continue;
      a.isActive = false;
      a.triggeredAt = this.iso();
      this.notify(
        a.userId,
        'price_alert',
        'notifications.priceAlert.title',
        `notifications.priceAlert.${a.condition}`,
        { symbol: a.symbol, value: a.value },
        { href: `/asset/${a.symbol}` },
        true,
      );
    }
  }

  // ─── simulated community ───────────────────────────────────────────────
  /** A demo trader places a trade (drives the live feed and alerts). */
  simulateBotTrade(forUserId?: string): Trade | null {
    const viewer = this.viewerId();
    const followees = viewer
      ? this.db.follows.filter((f) => f.followerId === viewer).map((f) => f.followeeId)
      : [];
    const bots = Object.values(this.db.profiles).filter((p) => p.isDemoBot);
    if (!bots.length) return null;
    const pool =
      followees.length && this.rng() < 0.6
        ? followees.map((id) => this.db.profiles[id]).filter((p): p is Profile => !!p?.isDemoBot)
        : bots;
    const bot = forUserId ? this.profile(forUserId) : pick(this.rng, pool.length ? pool : bots);
    const held = Object.keys(this.db.lots).filter((k) => k.startsWith(`${bot.id}:`));
    const sell = held.length > 0 && this.rng() < 0.35;
    const assets = this.providers.marketData.allAssets().filter((a) => !STABLES.has(a.id));
    const asset = sell
      ? this.asset(pick(this.rng, held).slice(bot.id.length + 1))
      : pick(
          this.rng,
          assets.filter((a) => a.tags.includes('meme') || this.rng() < 0.3),
        );
    const price = asset.price;
    const key = lotKey(bot.id, asset.id);
    const lots = this.db.lots[key] ?? [];
    let qty: Decimal;
    let realizedPnl = '0';
    if (sell) {
      qty = round(
        mul(sum(lots.map((l) => l.qty)), (0.3 + this.rng() * 0.7).toFixed(4)),
        10,
        'down',
      );
      if (!gt(qty, 0)) return null;
      const res = fifoSell(lots, qty, price);
      realizedPnl = round(res.realizedPnl, 6);
      if (res.remainingLots.length) this.db.lots[key] = res.remainingLots;
      else delete this.db.lots[key];
    } else {
      qty = round(div(String(randInt(this.rng, 20, 3000)), price), 10, 'down');
      this.db.lots[key] = [...lots, { qty, price }];
    }
    const notional = round(mul(qty, price), 6);
    const trade: Trade = {
      id: newId('tr_'),
      userId: bot.id,
      orderId: newId('or_'),
      assetId: asset.id,
      symbol: asset.symbol,
      assetClass: asset.class === 'stock_token' ? 'stock_token' : 'crypto',
      side: sell ? 'sell' : 'buy',
      qty,
      price,
      notional,
      fee: round(mul(notional, '0.0075'), 6),
      realizedPnl,
      isPublic: true,
      copiedFromTradeId: null,
      copiers: 0,
      createdAt: this.iso(),
    };
    this.db.trades.push(trade);
    this.publishTradePost(trade);
    this.leaderboardCache.clear();
    return trade;
  }

  /** Demo traders like and reply to the user's posts shortly after. */
  private scheduleEngagement(post: Post): void {
    if (this.opts.engines === false) return;
    const bots = Object.values(this.db.profiles).filter((p) => p.isDemoBot);
    const count = randInt(this.rng, 1, 3);
    for (let i = 0; i < count; i++) {
      const bot = pick(this.rng, bots);
      const t = setTimeout(
        () => {
          const live = this.db.posts.find((p) => p.id === post.id);
          if (!live || this.db.likes.some((l) => l.postId === post.id && l.userId === bot.id))
            return;
          this.db.likes.push({ postId: post.id, userId: bot.id });
          live.likeCount += 1;
          this.notify(
            post.authorId,
            'social_like',
            'notifications.like.title',
            'notifications.like.body',
            { username: bot.username },
            { href: `/post/${post.id}` },
          );
          if (this.rng() < 0.5) {
            this.db.comments.push({
              id: newId('co_'),
              postId: post.id,
              authorId: bot.id,
              body: pick(this.rng, COMMENT_POOL),
              parentId: null,
              createdAt: this.iso(),
            });
            live.commentCount += 1;
            this.notify(
              post.authorId,
              'social_comment',
              'notifications.comment.title',
              'notifications.comment.body',
              { username: bot.username },
              { href: `/post/${post.id}` },
            );
          }
          if (
            this.rng() < 0.4 &&
            !this.db.follows.some((f) => f.followerId === bot.id && f.followeeId === post.authorId)
          ) {
            this.db.follows.push({
              followerId: bot.id,
              followeeId: post.authorId,
              notify: false,
              createdAt: this.iso(),
            });
            this.notify(
              post.authorId,
              'social_follow',
              'notifications.follow.title',
              'notifications.follow.body',
              { username: bot.username },
              { href: `/user/${bot.username}` },
            );
          }
        },
        4000 + this.rng() * 12_000,
      );
      this.timers.push(t);
    }
  }

  /** Test helper: current raw db. */
  inspect(): Readonly<DemoDb> {
    return this.db;
  }

  /** Bot helper used in seeds and tests. */
  botValue(userId: string, assetId: string): Decimal {
    return lotsValue(this.db.lots[lotKey(userId, assetId)] ?? [], this.price(assetId));
  }
}

export const isStable = (assetId: string): boolean => STABLES.has(assetId);
