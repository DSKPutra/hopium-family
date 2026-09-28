import {
  AppError,
  BADGES,
  DEFAULT_FEES,
  DEFAULT_MIN_ORDER_USD,
  DEFAULT_TIER_THRESHOLDS,
  add,
  div,
  mul,
  round,
  seasonFor,
  spotFeeRate,
  sub,
  sum,
  unrealizedPnl,
  unrealizedPnlPct,
  type ActivityItem,
  type ActivityKind,
  type AppConfig,
  type AppNotification,
  type Backend,
  type BackendEvent,
  type Badge,
  type Chain,
  type CommentWithAuthor,
  type Decimal,
  type FeedItem,
  type FeedKind,
  type Fiat,
  type HoldingView,
  type KycStatus,
  type Leaderboard,
  type LeaderboardMetric,
  type LeaderboardPeriod,
  type LegendBuy,
  type NotificationSettings,
  type OnrampQuote,
  type OnrampResult,
  type OpenPerpRequest,
  type Order,
  type Page,
  type PaymentMethod,
  type PerpMarket,
  type PerpPosition,
  type PlaceSpotOrderOptions,
  type PortfolioPoint,
  type PortfolioRange,
  type PortfolioSummary,
  type Post,
  type PriceAlert,
  type PriceAlertCondition,
  type Profile,
  type ProfilePatch,
  type Providers,
  type PublicUser,
  type RegionRule,
  type ReportReason,
  type ReportTarget,
  type SearchResults,
  type Session,
  type SpotOrderResult,
  type SpotQuote,
  type SpotQuoteRequest,
  type Thesis,
  type ThesisDetail,
  type ThesisInput,
  type ThesisStatus,
  type Trade,
  type TxResult,
  type Unsubscribe,
  type UserBadge,
  type UserStats,
  type WithdrawRequest,
  sizeBucket,
} from '@hopium/core';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';
import * as WebBrowser from 'expo-web-browser';
import { Platform } from 'react-native';

type Row = Record<string, unknown>;

const s = (v: unknown): string => (v === null || v === undefined ? '' : String(v));
const n = (v: unknown): string => (v === null || v === undefined ? '0' : String(v));

/** Session tokens live in the secure keychain/keystore on native. */
const secureStorage = {
  getItem: (key: string) => SecureStore.getItemAsync(key),
  setItem: (key: string, value: string) => SecureStore.setItemAsync(key, value),
  removeItem: (key: string) => SecureStore.deleteItemAsync(key),
};

function toProfile(r: Row): Profile {
  return {
    id: s(r.id),
    username: s(r.username),
    displayName: s(r.display_name),
    avatarUrl: (r.avatar_url as string | null) ?? null,
    bio: s(r.bio),
    countryCode: (r.country_code as string | null) ?? null,
    birthYear: (r.birth_year as number | null) ?? null,
    interests: (r.interests as Profile['interests']) ?? [],
    holdingsPublic: r.holdings_public !== false,
    shareExactAmounts: r.share_exact_amounts === true,
    tier: (r.tier as Profile['tier']) ?? 'rookie',
    kycStatus: (r.kyc_status as KycStatus) ?? 'none',
    language: (r.language as Profile['language']) ?? 'en',
    theme: (r.theme as Profile['theme']) ?? 'dark',
    onboardedAt: (r.onboarded_at as string | null) ?? null,
    createdAt: s(r.created_at),
    riskAcceptedAt: (r.risk_accepted_at as string | null) ?? null,
  };
}

function toTrade(r: Row): Trade {
  return {
    id: s(r.id),
    userId: s(r.user_id),
    orderId: s(r.order_id),
    assetId: s(r.asset_id),
    symbol: s(r.symbol),
    assetClass: (r.asset_class as Trade['assetClass']) ?? 'crypto',
    side: r.side as Trade['side'],
    qty: n(r.qty),
    price: n(r.price),
    notional: n(r.notional),
    fee: n(r.fee),
    realizedPnl: n(r.realized_pnl),
    isPublic: r.is_public === true,
    copiedFromTradeId: (r.copied_from_trade_id as string | null) ?? null,
    copiers: Number(r.copiers ?? 0),
    createdAt: s(r.created_at),
  };
}

function toThesis(r: Row): Thesis {
  return {
    id: s(r.id),
    authorId: s(r.author_id),
    assetId: s(r.asset_id),
    symbol: s(r.symbol),
    direction: r.direction as Thesis['direction'],
    entryPrice: n(r.entry_price),
    targetPrice: n(r.target_price),
    invalidationPrice: n(r.invalidation_price),
    timeframeEnd: s(r.timeframe_end),
    body: s(r.body),
    imageUrl: (r.image_url as string | null) ?? null,
    status: r.status as ThesisStatus,
    resolvedAt: (r.resolved_at as string | null) ?? null,
    maxFavorablePct: n(r.max_favorable_pct),
    createdAt: s(r.created_at),
  };
}

function toPost(r: Row): Post {
  return {
    id: s(r.id),
    authorId: s(r.author_id),
    kind: r.kind as Post['kind'],
    tradeId: (r.trade_id as string | null) ?? null,
    thesisId: (r.thesis_id as string | null) ?? null,
    body: s(r.body),
    milestone: (r.milestone as Post['milestone']) ?? null,
    likeCount: Number(r.like_count ?? 0),
    commentCount: Number(r.comment_count ?? 0),
    isHidden: r.is_hidden === true,
    createdAt: s(r.created_at),
  };
}

function toNotification(r: Row): AppNotification {
  const data = (r.data as Row | null) ?? {};
  return {
    id: s(r.id),
    userId: s(r.user_id),
    type: r.type as AppNotification['type'],
    titleKey: s(r.title),
    bodyKey: s(r.body),
    params: (data.params as AppNotification['params']) ?? {},
    data: { href: data.href as string | undefined },
    readAt: (r.read_at as string | null) ?? null,
    createdAt: s(r.created_at),
  };
}

/**
 * Live backend on Supabase: Auth, Postgres (RLS), RPCs, Realtime and Edge
 * Functions. Market data, swaps, perps and on-ramp go through the configured
 * providers; server-side edge functions validate and record every order.
 */
export class SupabaseBackend implements Backend {
  readonly kind = 'supabase' as const;
  private client: SupabaseClient;
  private listeners = new Set<(e: BackendEvent) => void>();
  private quotes = new Map<string, SpotQuote>();
  private channel: ReturnType<SupabaseClient['channel']> | null = null;

  constructor(private config: { url: string; anonKey: string; providers: Providers }) {
    this.client = createClient(config.url, config.anonKey, {
      auth: {
        storage: Platform.OS === 'web' ? undefined : secureStorage,
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: Platform.OS === 'web',
      },
    });
    this.client.auth.onAuthStateChange((_event, session) => {
      this.emit({ type: 'session' });
      if (session) this.listen(session.user.id);
      else this.unlisten();
    });
  }

  async authHeader(): Promise<Record<string, string>> {
    const { data } = await this.client.auth.getSession();
    return data.session ? { Authorization: `Bearer ${data.session.access_token}` } : {};
  }

  private emit(e: BackendEvent): void {
    for (const l of this.listeners) l(e);
  }

  subscribe(cb: (event: BackendEvent) => void): Unsubscribe {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  }

  private listen(userId: string): void {
    this.unlisten();
    this.channel = this.client
      .channel(`user:${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          this.emit({
            type: 'notification',
            notification: toNotification(payload.new as Row),
            push: true,
          });
        },
      )
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'posts' }, (payload) => {
        const p = payload.new as Row;
        this.emit({ type: 'feed:new', postId: s(p.id), authorId: s(p.author_id) });
      })
      .subscribe();
  }

  private unlisten(): void {
    if (this.channel) void this.client.removeChannel(this.channel);
    this.channel = null;
  }

  private async uid(): Promise<string> {
    const { data } = await this.client.auth.getUser();
    if (!data.user) throw new AppError('not_authenticated', 'Please sign in.');
    return data.user.id;
  }

  private check<T>(res: { data: T | null; error: { message: string; code?: string } | null }): T {
    if (res.error) {
      if (res.error.code === 'PGRST116') throw new AppError('not_found', res.error.message);
      throw new AppError('unknown', res.error.message);
    }
    return res.data as T;
  }

  private async invoke<T>(name: string, body: object): Promise<T> {
    const { data, error } = await this.client.functions.invoke<
      T | { code: string; message: string }
    >(name, { body });
    if (error) {
      const ctx = (
        error as { context?: { json?: () => Promise<{ code?: string; message?: string }> } }
      ).context;
      const parsed = ctx?.json ? await ctx.json().catch(() => null) : null;
      throw new AppError((parsed?.code as never) ?? 'unknown', parsed?.message ?? error.message);
    }
    return data as T;
  }

  // ─── auth ──────────────────────────────────────────────────────────────
  async getSession(): Promise<Session | null> {
    const { data } = await this.client.auth.getSession();
    const u = data.session?.user;
    if (!u) return null;
    const provider = (u.app_metadata.provider as string) ?? 'email';
    return {
      userId: u.id,
      email: u.email ?? null,
      method: provider === 'apple' || provider === 'google' ? provider : 'email',
      createdAt: u.created_at,
    };
  }

  async startEmailSignIn(email: string): Promise<void> {
    const { error } = await this.client.auth.signInWithOtp({
      email,
      options: { shouldCreateUser: true },
    });
    if (error) throw new AppError('network_busy', error.message);
  }

  async verifyOtp(email: string, code: string): Promise<Session> {
    const { error } = await this.client.auth.verifyOtp({ email, token: code, type: 'email' });
    if (error) throw new AppError('invalid_input', error.message);
    const session = await this.getSession();
    if (!session) throw new AppError('not_authenticated');
    return session;
  }

  async signInWithProvider(method: 'apple' | 'google'): Promise<Session> {
    const { data, error } = await this.client.auth.signInWithOAuth({
      provider: method,
      options: { redirectTo: 'hopium://auth', skipBrowserRedirect: Platform.OS !== 'web' },
    });
    if (error) throw new AppError('network_busy', error.message);
    if (Platform.OS !== 'web' && data.url) {
      const res = await WebBrowser.openAuthSessionAsync(data.url, 'hopium://auth');
      if (res.type === 'success') {
        const code = new URL(res.url).searchParams.get('code');
        if (code) await this.client.auth.exchangeCodeForSession(code);
      }
    }
    const session = await this.getSession();
    if (!session) throw new AppError('not_authenticated');
    return session;
  }

  async signOut(): Promise<void> {
    await this.client.auth.signOut();
  }

  async deleteAccount(confirmation: string): Promise<void> {
    if (confirmation.trim().toLowerCase() !== 'delete') throw new AppError('invalid_input');
    await this.invoke('delete-account', { confirmation });
    await this.client.auth.signOut();
  }

  // ─── profile & people ─────────────────────────────────────────────────
  async getMe(): Promise<Profile | null> {
    const session = await this.getSession();
    if (!session) return null;
    const res = await this.client
      .from('profiles')
      .select('*')
      .eq('id', session.userId)
      .maybeSingle();
    return res.data ? toProfile(res.data as Row) : null;
  }

  async checkUsername(username: string): Promise<{ available: boolean }> {
    const res = await this.client.rpc('username_available', { p_username: username.toLowerCase() });
    return { available: this.check(res) === true };
  }

  async updateProfile(patch: ProfilePatch): Promise<Profile> {
    const id = await this.uid();
    const row: Row = {};
    if (patch.username !== undefined) row.username = patch.username;
    if (patch.displayName !== undefined) row.display_name = patch.displayName;
    if (patch.bio !== undefined) row.bio = patch.bio;
    if (patch.avatarUrl !== undefined) row.avatar_url = patch.avatarUrl;
    if (patch.countryCode !== undefined) row.country_code = patch.countryCode;
    if (patch.birthYear !== undefined) row.birth_year = patch.birthYear;
    if (patch.interests !== undefined) row.interests = patch.interests;
    if (patch.holdingsPublic !== undefined) row.holdings_public = patch.holdingsPublic;
    if (patch.shareExactAmounts !== undefined) row.share_exact_amounts = patch.shareExactAmounts;
    if (patch.language !== undefined) row.language = patch.language;
    if (patch.theme !== undefined) row.theme = patch.theme;
    if (patch.riskAccepted) row.risk_accepted_at = new Date().toISOString();
    const res = await this.client
      .from('profiles')
      .upsert({ id, ...row })
      .select('*')
      .single();
    if (res.error?.code === '23505') throw new AppError('username_taken');
    this.emit({ type: 'profile' });
    return toProfile(this.check(res) as Row);
  }

  async completeOnboarding(): Promise<Profile> {
    const id = await this.uid();
    const res = await this.client
      .from('profiles')
      .update({ onboarded_at: new Date().toISOString() })
      .eq('id', id)
      .select('*')
      .single();
    this.emit({ type: 'profile' });
    return toProfile(this.check(res) as Row);
  }

  private async stats(username: string): Promise<UserStats> {
    const res = await this.client.rpc('user_stats', { p_username: username });
    const r = (this.check(res) as Row[] | Row) ?? {};
    const row = (Array.isArray(r) ? r[0] : r) ?? {};
    return {
      pnlPct: n(row.pnl_pct),
      winRatePct: n(row.win_rate),
      thesisAccuracyPct: n(row.thesis_accuracy),
      followers: Number(row.followers ?? 0),
      following: Number(row.following ?? 0),
      copiers: Number(row.copiers ?? 0),
      tradesCount: Number(row.trades_count ?? 0),
      volumeUsd: n(row.volume_usd),
    };
  }

  private async publicUser(p: Profile): Promise<PublicUser> {
    const me = await this.uid().catch(() => null);
    const [stats, follow, block] = await Promise.all([
      this.stats(p.username),
      me
        ? this.client
            .from('follows')
            .select('notify')
            .eq('follower_id', me)
            .eq('followee_id', p.id)
            .maybeSingle()
        : Promise.resolve({ data: null }),
      me
        ? this.client
            .from('blocks')
            .select('blocked_id')
            .eq('blocker_id', me)
            .eq('blocked_id', p.id)
            .maybeSingle()
        : Promise.resolve({ data: null }),
    ]);
    return {
      profile: p,
      stats,
      isFollowing: !!follow.data,
      isBlocked: !!block.data,
      notifyOnTrade: (follow.data as Row | null)?.notify === true,
    };
  }

  async getFollowSuggestions(limit = 10): Promise<PublicUser[]> {
    const res = await this.client
      .from('profiles')
      .select('*')
      .not('onboarded_at', 'is', null)
      .order('tier', { ascending: false })
      .limit(limit + 5);
    const me = await this.uid();
    const profiles = (this.check(res) as Row[])
      .map(toProfile)
      .filter((p) => p.id !== me)
      .slice(0, limit);
    return Promise.all(profiles.map((p) => this.publicUser(p)));
  }

  async getUser(username: string): Promise<PublicUser> {
    const res = await this.client
      .from('profiles')
      .select('*')
      .eq('username', username.toLowerCase())
      .single();
    return this.publicUser(toProfile(this.check(res) as Row));
  }

  async getUserTrades(userId: string, cursor?: string | null): Promise<Page<Trade>> {
    const offset = cursor ? Number(cursor) : 0;
    const res = await this.client
      .from('trades')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .range(offset, offset + 19);
    const items = (this.check(res) as Row[]).map(toTrade);
    return { items, nextCursor: items.length === 20 ? String(offset + 20) : null };
  }

  async getUserTheses(userId: string, status: ThesisStatus | 'all' = 'all'): Promise<Thesis[]> {
    let q = this.client
      .from('theses')
      .select('*')
      .eq('author_id', userId)
      .order('created_at', { ascending: false });
    if (status !== 'all') q = q.eq('status', status);
    return (this.check(await q) as Row[]).map(toThesis);
  }

  private async holdingViews(rows: Row[]): Promise<HoldingView[]> {
    const views: HoldingView[] = [];
    for (const r of rows) {
      const asset = await this.config.providers.marketData.getAsset(s(r.asset_id));
      const qty = n(r.qty);
      const avgEntry = n(r.avg_entry);
      const valueUsd = round(mul(qty, asset.price), 6);
      views.push({
        asset,
        qty,
        avgEntry,
        valueUsd,
        unrealizedPnl: round(unrealizedPnl(asset.price, avgEntry, qty), 6),
        unrealizedPnlPct: round(unrealizedPnlPct(asset.price, avgEntry), 4),
      });
    }
    return views;
  }

  async getUserHoldings(userId: string): Promise<HoldingView[] | null> {
    const res = await this.client.from('holdings').select('*').eq('user_id', userId).gt('qty', 0);
    if (res.error) return null;
    return this.holdingViews(res.data as Row[]);
  }

  async getUserBadges(userId: string): Promise<(UserBadge & { badge: Badge })[]> {
    const res = await this.client.from('user_badges').select('*').eq('user_id', userId);
    return (this.check(res) as Row[])
      .map((r) => ({
        userId: s(r.user_id),
        slug: s(r.slug),
        awardedAt: s(r.created_at),
        badge: BADGES.find((b) => b.slug === r.slug) as Badge,
      }))
      .filter((b) => !!b.badge);
  }

  async getPortfolioHistory(
    userId: string,
    range: PortfolioRange,
  ): Promise<PortfolioPoint[] | null> {
    const res = await this.client.rpc('portfolio_history', { p_user: userId, p_range: range });
    if (res.error) return null;
    return (res.data as Row[]).map((r) => ({ time: Date.parse(s(r.time)), value: n(r.value) }));
  }

  async follow(userId: string): Promise<void> {
    const me = await this.uid();
    this.check(await this.client.from('follows').upsert({ follower_id: me, followee_id: userId }));
  }

  async unfollow(userId: string): Promise<void> {
    const me = await this.uid();
    this.check(
      await this.client.from('follows').delete().eq('follower_id', me).eq('followee_id', userId),
    );
  }

  async setNotifyOnTrade(userId: string, on: boolean): Promise<void> {
    const me = await this.uid();
    this.check(
      await this.client
        .from('follows')
        .upsert({ follower_id: me, followee_id: userId, notify: on }),
    );
  }

  async block(userId: string): Promise<void> {
    const me = await this.uid();
    this.check(await this.client.from('blocks').upsert({ blocker_id: me, blocked_id: userId }));
    await this.unfollow(userId);
  }

  async unblock(userId: string): Promise<void> {
    const me = await this.uid();
    this.check(
      await this.client.from('blocks').delete().eq('blocker_id', me).eq('blocked_id', userId),
    );
  }

  async report(p: {
    targetType: ReportTarget;
    targetId: string;
    reason: ReportReason;
  }): Promise<void> {
    const me = await this.uid();
    this.check(
      await this.client.from('reports').insert({
        reporter_id: me,
        target_type: p.targetType,
        target_id: p.targetId,
        reason: p.reason,
      }),
    );
  }

  async search(query: string): Promise<SearchResults> {
    const q = query.trim().replace(/^[@$]/, '');
    if (!q) return { people: [], theses: [] };
    const [people, theses] = await Promise.all([
      this.client
        .from('profiles')
        .select('*')
        .or(`username.ilike.%${q}%,display_name.ilike.%${q}%`)
        .limit(10),
      this.client
        .from('theses')
        .select('*, author:profiles!theses_author_id_fkey(*)')
        .or(`symbol.ilike.%${q}%,body.ilike.%${q}%`)
        .limit(10),
    ]);
    return {
      people: (this.check(people) as Row[]).map(toProfile),
      theses: (this.check(theses) as Row[]).map((r) => ({
        thesis: toThesis(r),
        author: toProfile(r.author as Row),
      })),
    };
  }

  // ─── feed ──────────────────────────────────────────────────────────────
  private async hydrate(rows: Row[]): Promise<FeedItem[]> {
    const me = await this.uid().catch(() => null);
    const postIds = rows.map((r) => s(r.id));
    const liked =
      me && postIds.length
        ? (((
            await this.client
              .from('likes')
              .select('post_id')
              .eq('user_id', me)
              .in('post_id', postIds)
          ).data as Row[] | null) ?? [])
        : [];
    const likedSet = new Set(liked.map((l) => s(l.post_id)));
    return rows.map((r) => {
      const author = toProfile((r.author as Row) ?? {});
      const trade = r.trade ? toTrade(r.trade as Row) : null;
      const visible = !!trade && (author.shareExactAmounts || author.id === me);
      return {
        post: toPost(r),
        author,
        thesis: r.thesis ? toThesis(r.thesis as Row) : null,
        likedByMe: likedSet.has(s(r.id)),
        trade:
          trade && !visible
            ? { ...trade, qty: '0', notional: '0', fee: '0', realizedPnl: '0' }
            : trade,
        sizeBucket: trade
          ? ((r.size_bucket as FeedItem['sizeBucket']) ?? sizeBucket(trade.notional))
          : null,
        amountsVisible: visible,
      };
    });
  }

  async getFeed(kind: FeedKind, cursor?: string | null): Promise<Page<FeedItem>> {
    const me = await this.uid();
    const fn =
      kind === 'following'
        ? 'feed_following'
        : kind === 'trending'
          ? 'feed_trending'
          : 'feed_theses';
    const res = await this.client.rpc(fn, { p_user: me, p_cursor: cursor ?? null, p_limit: 15 });
    const rows = this.check(res) as Row[];
    const items = await this.hydrate(rows);
    const last = rows.at(-1);
    return {
      items,
      nextCursor: rows.length === 15 && last ? s(last.cursor ?? last.created_at) : null,
    };
  }

  async getPost(postId: string): Promise<FeedItem> {
    const res = await this.client
      .from('posts')
      .select('*, author:profiles(*), trade:trades(*), thesis:theses(*)')
      .eq('id', postId)
      .single();
    const [item] = await this.hydrate([this.check(res) as Row]);
    if (!item) throw new AppError('not_found');
    return item;
  }

  async getLegendsBuying(): Promise<LegendBuy[]> {
    const res = await this.client.rpc('legends_buying', { p_limit: 12 });
    return (this.check(res) as Row[]).map((r) => ({
      profile: toProfile(r.author as Row),
      trade: toTrade(r.trade as Row),
      postId: s(r.post_id),
    }));
  }

  async like(postId: string): Promise<void> {
    const me = await this.uid();
    this.check(await this.client.from('likes').upsert({ post_id: postId, user_id: me }));
  }

  async unlike(postId: string): Promise<void> {
    const me = await this.uid();
    this.check(await this.client.from('likes').delete().eq('post_id', postId).eq('user_id', me));
  }

  async getComments(postId: string): Promise<CommentWithAuthor[]> {
    const res = await this.client
      .from('comments')
      .select('*, author:profiles(*)')
      .eq('post_id', postId)
      .order('created_at');
    return (this.check(res) as Row[]).map((r) => ({
      id: s(r.id),
      postId: s(r.post_id),
      authorId: s(r.author_id),
      body: s(r.body),
      parentId: (r.parent_id as string | null) ?? null,
      createdAt: s(r.created_at),
      author: toProfile(r.author as Row),
    }));
  }

  async addComment(
    postId: string,
    body: string,
    parentId: string | null = null,
  ): Promise<CommentWithAuthor> {
    await this.invoke('moderate-content', { body });
    const me = await this.uid();
    const res = await this.client
      .from('comments')
      .insert({ post_id: postId, author_id: me, body, parent_id: parentId })
      .select('*, author:profiles(*)')
      .single();
    const r = this.check(res) as Row;
    return {
      id: s(r.id),
      postId,
      authorId: me,
      body,
      parentId,
      createdAt: s(r.created_at),
      author: toProfile(r.author as Row),
    };
  }

  // ─── config & compliance ───────────────────────────────────────────────
  async getAppConfig(): Promise<AppConfig> {
    const res = await this.client.from('app_config').select('key, value');
    const map = new Map(((res.data as Row[] | null) ?? []).map((r) => [s(r.key), r.value]));
    const season = seasonFor(Date.now());
    return {
      fees: (map.get('fees') as AppConfig['fees']) ?? DEFAULT_FEES,
      minOrderUsd: (map.get('min_order_usd') as AppConfig['minOrderUsd']) ?? DEFAULT_MIN_ORDER_USD,
      maxSlippageBps: Number(map.get('max_slippage_bps') ?? 2000),
      tierThresholds:
        (map.get('tier_thresholds') as AppConfig['tierThresholds']) ?? DEFAULT_TIER_THRESHOLDS,
      idrPerUsd: s(map.get('idr_per_usd') ?? '16250'),
      season: { name: season.name, endsAt: season.endsAt },
    };
  }

  async getRegionRule(): Promise<RegionRule> {
    const me = await this.getMe();
    const res = await this.client
      .from('region_rules')
      .select('*')
      .eq('country_code', me?.countryCode ?? 'XX')
      .maybeSingle();
    const r = res.data as Row | null;
    return {
      countryCode: me?.countryCode ?? 'XX',
      allowStockTokens: r ? r.allow_stock_tokens === true : true,
      allowPerps: r ? r.allow_perps === true : true,
      allowCopyTrade: r ? r.allow_copy_trade === true : true,
      requiresKycFor: (r?.requires_kyc_for as RegionRule['requiresKycFor']) ?? ['withdraw'],
    };
  }

  async getKycStatus(): Promise<KycStatus> {
    return (await this.getMe())?.kycStatus ?? 'none';
  }

  async startKyc(): Promise<void> {
    await this.config.providers.kyc.start();
    this.emit({ type: 'kyc', status: 'pending' });
  }

  // ─── trading ───────────────────────────────────────────────────────────
  async quoteSpot(req: SpotQuoteRequest): Promise<SpotQuote> {
    const { marketData, swap, stockTokens } = this.config.providers;
    const asset = await marketData.getAsset(req.assetId);
    if (asset.class === 'perp') throw new AppError('invalid_input');
    const feeRate = spotFeeRate(asset.class);
    const qty = req.qty ?? round(div(req.amountUsd ?? '0', asset.price), 12, 'down');
    const notional = req.amountUsd ?? round(mul(qty, asset.price), 6);
    let quote: SpotQuote;
    if (asset.class === 'stock_token') {
      const q = await stockTokens.quote({
        assetId: asset.id,
        side: req.side,
        notionalUsd: notional,
        feeRate,
      });
      const fee = round(mul(notional, feeRate), 6);
      quote = {
        id: q.id,
        assetId: asset.id,
        symbol: asset.symbol,
        assetClass: 'stock_token',
        side: req.side,
        notionalUsd: notional,
        qty: q.qty,
        price: q.price,
        priceImpactPct: q.priceImpactPct,
        networkFeeUsd: '0',
        gasSponsored: true,
        platformFeeUsd: fee,
        feeRate,
        totalUsd: req.side === 'buy' ? add(notional, fee) : sub(notional, fee),
        slippageBps: req.slippageBps,
        expiresAt: q.expiresAt,
      };
    } else {
      const chain = asset.chain ?? 'solana';
      const q =
        req.side === 'buy'
          ? await swap.quote({
              from: 'usdc',
              to: asset.id,
              amountIn: notional,
              slippageBps: req.slippageBps,
              chain,
              feeBps: Number(mul(feeRate, 10_000)),
            })
          : await swap.quote({
              from: asset.id,
              to: 'usdc',
              amountIn: qty,
              slippageBps: req.slippageBps,
              chain,
              feeBps: Number(mul(feeRate, 10_000)),
            });
      const fee = round(mul(notional, feeRate), 6);
      quote = {
        id: q.id,
        assetId: asset.id,
        symbol: asset.symbol,
        assetClass: 'crypto',
        side: req.side,
        notionalUsd: notional,
        qty: req.side === 'buy' ? q.amountOut : qty,
        price: q.price,
        priceImpactPct: q.priceImpactPct,
        networkFeeUsd: q.networkFeeUsd,
        gasSponsored: q.gasSponsored,
        platformFeeUsd: fee,
        feeRate,
        totalUsd:
          req.side === 'buy'
            ? sum([notional, fee, q.networkFeeUsd])
            : sub(notional, add(fee, q.networkFeeUsd)),
        slippageBps: req.slippageBps,
        expiresAt: q.expiresAt,
      };
    }
    this.quotes.set(quote.id, quote);
    return quote;
  }

  async placeSpotOrder(quote: SpotQuote, opts: PlaceSpotOrderOptions): Promise<SpotOrderResult> {
    // place-order validates region, KYC, min order and balance server-side,
    // records the order, and returns the signed transaction request.
    const pending = await this.invoke<{ order: Order }>('place-order', {
      quote,
      copiedFromTradeId: opts.copiedFromTradeId ?? null,
      shareToFeed: opts.shareToFeed,
    });
    const { swap, stockTokens } = this.config.providers;
    let tx: TxResult;
    try {
      tx =
        quote.assetClass === 'stock_token'
          ? await stockTokens.execute({
              id: quote.id,
              assetId: quote.assetId,
              side: quote.side,
              notionalUsd: quote.notionalUsd,
              qty: quote.qty,
              price: quote.price,
              priceImpactPct: quote.priceImpactPct,
              expiresAt: quote.expiresAt,
            })
          : await swap.execute({
              id: quote.id,
              from: quote.side === 'buy' ? 'usdc' : quote.assetId,
              to: quote.side === 'buy' ? quote.assetId : 'usdc',
              chain: 'solana',
              amountIn: quote.side === 'buy' ? quote.notionalUsd : quote.qty,
              amountOut: quote.side === 'buy' ? quote.qty : quote.notionalUsd,
              price: quote.price,
              priceImpactPct: quote.priceImpactPct,
              slippageBps: quote.slippageBps,
              networkFeeUsd: quote.networkFeeUsd,
              gasSponsored: quote.gasSponsored,
              expiresAt: quote.expiresAt,
            });
    } catch (err) {
      await this.invoke('place-order', {
        orderId: pending.order.id,
        status: 'failed',
        errorCode: err instanceof AppError ? err.code : 'unknown',
      });
      throw err;
    }
    const done = await this.invoke<SpotOrderResult>('place-order', {
      orderId: pending.order.id,
      status: 'filled',
      txHash: tx.txHash,
      filled: tx.filled,
    });
    this.emit({ type: 'orders' });
    return { ...done, txExplorerUrl: tx.explorerUrl };
  }

  async getPortfolio(): Promise<PortfolioSummary> {
    const me = await this.uid();
    const { wallet, perps } = this.config.providers;
    const [balances, positions, holdingsRes] = await Promise.all([
      wallet.getBalances(),
      perps.getPositions(),
      this.client.from('holdings').select('*').eq('user_id', me).gt('qty', 0),
    ]);
    const cash = sum(
      balances.filter((b) => ['USDC', 'USDT', 'PYUSD', 'DAI'].includes(b.symbol)).map((b) => b.qty),
    );
    const holdings = await this.holdingViews((holdingsRes.data as Row[] | null) ?? []);
    const cryptoUsd = sum(
      holdings.filter((h) => h.asset.class === 'crypto').map((h) => h.valueUsd),
    );
    const stockTokensUsd = sum(
      holdings.filter((h) => h.asset.class === 'stock_token').map((h) => h.valueUsd),
    );
    const perpsMarginUsd = sum(positions.map((p) => p.margin));
    const perpsUnrealizedUsd = sum(positions.map((p) => p.unrealizedPnl));
    return {
      totalUsd: sum([cash, cryptoUsd, stockTokensUsd, perpsMarginUsd, perpsUnrealizedUsd]),
      cashUsd: cash,
      cryptoUsd,
      stockTokensUsd,
      perpsMarginUsd,
      perpsUnrealizedUsd,
      holdings,
    };
  }

  async getHolding(assetId: string): Promise<HoldingView | null> {
    const me = await this.uid();
    const res = await this.client
      .from('holdings')
      .select('*')
      .eq('user_id', me)
      .eq('asset_id', assetId)
      .gt('qty', 0)
      .maybeSingle();
    if (!res.data) return null;
    return (await this.holdingViews([res.data as Row]))[0] ?? null;
  }

  async getOrders(): Promise<Order[]> {
    const me = await this.uid();
    const res = await this.client
      .from('orders')
      .select('*')
      .eq('user_id', me)
      .order('created_at', { ascending: false })
      .limit(100);
    return (this.check(res) as Row[]).map((r) => ({
      id: s(r.id),
      userId: s(r.user_id),
      assetId: s(r.asset_id),
      class: r.class as Order['class'],
      side: r.side as Order['side'],
      type: r.type as Order['type'],
      amountIn: n(r.amount_in),
      amountOut: n(r.amount_out),
      price: n(r.price),
      fee: n(r.fee),
      slippageBps: Number(r.slippage_bps ?? 0),
      status: r.status as Order['status'],
      txHash: (r.tx_hash as string | null) ?? null,
      errorCode: (r.error_code as string | null) ?? null,
      copiedFromTradeId: (r.copied_from_trade_id as string | null) ?? null,
      createdAt: s(r.created_at),
    }));
  }

  async getActivity(kind: ActivityKind | 'all' = 'all'): Promise<ActivityItem[]> {
    const res = await this.client.rpc('activity_history', { p_kind: kind });
    return (this.check(res) as Row[]).map((r) => ({
      id: s(r.id),
      kind: r.kind as ActivityKind,
      title: s(r.title),
      symbol: s(r.symbol),
      amountUsd: n(r.amount_usd),
      qty: (r.qty as string | null) ?? null,
      side: (r.side as ActivityItem['side']) ?? null,
      status: (r.status as ActivityItem['status']) ?? 'completed',
      txHash: (r.tx_hash as string | null) ?? null,
      chain: (r.chain as Chain | null) ?? null,
      createdAt: s(r.created_at),
    }));
  }

  async getAssetHoldersIFollow(assetId: string): Promise<Profile[]> {
    const me = await this.uid();
    const res = await this.client.rpc('asset_holders_i_follow', { p_user: me, p_asset: assetId });
    return (this.check(res) as Row[]).map(toProfile);
  }

  async getAssetTheses(assetId: string): Promise<{ thesis: Thesis; author: Profile }[]> {
    const res = await this.client
      .from('theses')
      .select('*, author:profiles!theses_author_id_fkey(*)')
      .eq('asset_id', assetId)
      .order('created_at', { ascending: false })
      .limit(10);
    return (this.check(res) as Row[]).map((r) => ({
      thesis: toThesis(r),
      author: toProfile(r.author as Row),
    }));
  }

  // ─── perps ─────────────────────────────────────────────────────────────
  getPerpMarkets(): Promise<PerpMarket[]> {
    return this.config.providers.perps.listMarkets();
  }

  async getPerpMarket(marketId: string): Promise<PerpMarket> {
    const m = (await this.getPerpMarkets()).find((x) => x.id === marketId.toLowerCase());
    if (!m) throw new AppError('not_found');
    return m;
  }

  getPositions(): Promise<PerpPosition[]> {
    return this.config.providers.perps.getPositions();
  }

  async getPositionHistory(): Promise<PerpPosition[]> {
    const me = await this.uid();
    const res = await this.client
      .from('perp_positions')
      .select('*')
      .eq('user_id', me)
      .neq('status', 'open')
      .order('closed_at', { ascending: false })
      .limit(50);
    return (this.check(res) as Row[]).map((r) => ({
      id: s(r.id),
      userId: me,
      marketId: s(r.market),
      symbol: s(r.market).toUpperCase(),
      side: r.side as PerpPosition['side'],
      size: n(r.size),
      entryPrice: n(r.entry_price),
      markPrice: n(r.entry_price),
      leverage: Number(r.leverage),
      margin: n(r.margin),
      liqPrice: n(r.liq_price),
      tp: (r.tp as string | null) ?? null,
      sl: (r.sl as string | null) ?? null,
      unrealizedPnl: '0',
      roePct: '0',
      realizedPnl: n(r.realized_pnl),
      status: r.status as PerpPosition['status'],
      openedAt: s(r.created_at),
      closedAt: (r.closed_at as string | null) ?? null,
    }));
  }

  async openPerp(req: OpenPerpRequest): Promise<PerpPosition> {
    const pos = await this.invoke<PerpPosition>('open-perp', req);
    this.emit({ type: 'positions' });
    return pos;
  }

  async closePerp(positionId: string, sizePct: number): Promise<TxResult> {
    const tx = await this.invoke<TxResult>('close-perp', { positionId, sizePct });
    this.emit({ type: 'positions' });
    return tx;
  }

  async setTpSl(positionId: string, tp?: Decimal, sl?: Decimal): Promise<void> {
    await this.invoke('set-tpsl', { positionId, tp, sl });
    this.emit({ type: 'positions' });
  }

  // ─── wallet ────────────────────────────────────────────────────────────
  getAddresses(): Promise<Record<Chain, string>> {
    return this.config.providers.wallet.getAddresses();
  }

  getOnrampQuote(p: { fiat: Fiat; fiatAmount: Decimal }): Promise<OnrampQuote> {
    return this.config.providers.onramp.getQuote({ ...p, asset: 'usdc', chain: 'solana' });
  }

  deposit(quote: OnrampQuote, method: PaymentMethod): Promise<OnrampResult> {
    return this.config.providers.onramp.startPurchase(quote, method);
  }

  async getWithdrawFee(chain: Chain): Promise<Decimal> {
    return (
      {
        solana: '0.01',
        base: '0.05',
        arbitrum: '0.08',
        ethereum: '2.4',
        robinhood: '0.05',
      } as const
    )[chain];
  }

  async withdraw(req: WithdrawRequest): Promise<ActivityItem> {
    const tx = await this.config.providers.wallet.signAndSend({
      chain: req.chain,
      to: req.address,
      value: req.amount,
      memo: req.assetId,
    });
    return {
      id: tx.txHash,
      kind: 'withdrawal',
      title: req.chain,
      symbol: req.assetId.toUpperCase(),
      amountUsd: req.amount,
      qty: req.amount,
      side: null,
      status: 'completed',
      txHash: tx.txHash,
      chain: req.chain,
      createdAt: new Date().toISOString(),
    };
  }

  exportWallet(): Promise<void> {
    return this.config.providers.wallet.exportWallet();
  }

  // ─── theses ────────────────────────────────────────────────────────────
  async createThesis(input: ThesisInput): Promise<Thesis> {
    await this.invoke('moderate-content', { body: input.body });
    const me = await this.uid();
    const asset = await this.config.providers.marketData.getAsset(input.assetId);
    const res = await this.client
      .from('theses')
      .insert({
        author_id: me,
        asset_id: asset.id,
        symbol: asset.symbol,
        direction: input.direction,
        entry_price: asset.price,
        target_price: input.targetPrice,
        invalidation_price: input.invalidationPrice,
        timeframe_end: input.timeframeEnd,
        body: input.body,
        image_url: input.imageUrl,
      })
      .select('*')
      .single();
    return toThesis(this.check(res) as Row);
  }

  async getThesis(thesisId: string): Promise<ThesisDetail> {
    const res = await this.client
      .from('posts')
      .select('*, author:profiles(*), trade:trades(*), thesis:theses(*)')
      .eq('thesis_id', thesisId)
      .single();
    const [item] = await this.hydrate([this.check(res) as Row]);
    if (!item?.thesis) throw new AppError('not_found');
    return { thesis: item.thesis, author: item.author, item };
  }

  // ─── leaderboard ───────────────────────────────────────────────────────
  async getLeaderboard(period: LeaderboardPeriod, metric: LeaderboardMetric): Promise<Leaderboard> {
    const res = await this.client
      .from('leaderboard_snapshots')
      .select('*, profile:profiles(*)')
      .eq('period', period)
      .eq('metric', metric)
      .order('rank')
      .limit(100);
    const rows = this.check(res) as Row[];
    const me = await this.uid().catch(() => null);
    const entries = rows.map((r) => ({
      userId: s(r.user_id),
      profile: toProfile(r.profile as Row),
      rank: Number(r.rank),
      previousRank: (r.previous_rank as number | null) ?? null,
      value: n(r.value),
    }));
    const season = seasonFor(Date.now());
    return {
      period,
      metric,
      entries,
      me: entries.find((e) => e.userId === me) ?? null,
      computedAt: s(rows[0]?.computed_at ?? new Date().toISOString()),
      season: { name: season.name, endsAt: season.endsAt },
    };
  }

  // ─── notifications ─────────────────────────────────────────────────────
  async getNotifications(): Promise<AppNotification[]> {
    const me = await this.uid();
    const res = await this.client
      .from('notifications')
      .select('*')
      .eq('user_id', me)
      .order('created_at', { ascending: false })
      .limit(100);
    return (this.check(res) as Row[]).map(toNotification);
  }

  async markNotificationRead(id: string): Promise<void> {
    this.check(
      await this.client
        .from('notifications')
        .update({ read_at: new Date().toISOString() })
        .eq('id', id),
    );
  }

  async markAllNotificationsRead(): Promise<void> {
    const me = await this.uid();
    this.check(
      await this.client
        .from('notifications')
        .update({ read_at: new Date().toISOString() })
        .eq('user_id', me)
        .is('read_at', null),
    );
  }

  async deleteNotification(id: string): Promise<void> {
    this.check(await this.client.from('notifications').delete().eq('id', id));
  }

  async getNotificationSettings(): Promise<NotificationSettings> {
    const me = await this.uid();
    const res = await this.client
      .from('notification_settings')
      .select('*')
      .eq('user_id', me)
      .maybeSingle();
    const r = (res.data as Row | null) ?? {};
    return {
      followedTrades: r.followed_trades !== false,
      priceAlerts: r.price_alerts !== false,
      liquidationRisk: r.liquidation_risk !== false,
      thesisUpdates: r.thesis_updates !== false,
      social: r.social !== false,
      marketing: r.marketing === true,
    };
  }

  async updateNotificationSettings(
    patch: Partial<NotificationSettings>,
  ): Promise<NotificationSettings> {
    const me = await this.uid();
    const next = { ...(await this.getNotificationSettings()), ...patch };
    this.check(
      await this.client.from('notification_settings').upsert({
        user_id: me,
        followed_trades: next.followedTrades,
        price_alerts: next.priceAlerts,
        liquidation_risk: next.liquidationRisk,
        thesis_updates: next.thesisUpdates,
        social: next.social,
        marketing: next.marketing,
      }),
    );
    return next;
  }

  async registerPushToken(token: string, platform: 'ios' | 'android' | 'web'): Promise<void> {
    const me = await this.uid();
    this.check(
      await this.client
        .from('push_tokens')
        .upsert({ user_id: me, token, platform }, { onConflict: 'token' }),
    );
  }

  async getPriceAlerts(): Promise<PriceAlert[]> {
    const me = await this.uid();
    const res = await this.client.from('price_alerts').select('*').eq('user_id', me);
    return (this.check(res) as Row[]).map((r) => ({
      id: s(r.id),
      userId: me,
      assetId: s(r.asset_id),
      symbol: s(r.symbol),
      condition: r.condition as PriceAlertCondition,
      value: n(r.value),
      basePrice: n(r.base_price),
      isActive: r.is_active === true,
      triggeredAt: (r.triggered_at as string | null) ?? null,
      createdAt: s(r.created_at),
    }));
  }

  async createPriceAlert(p: {
    assetId: string;
    condition: PriceAlertCondition;
    value: Decimal;
  }): Promise<PriceAlert> {
    const me = await this.uid();
    const asset = await this.config.providers.marketData.getAsset(p.assetId);
    const res = await this.client
      .from('price_alerts')
      .insert({
        user_id: me,
        asset_id: asset.id,
        symbol: asset.symbol,
        condition: p.condition,
        value: p.value,
        base_price: asset.price,
      })
      .select('*')
      .single();
    const r = this.check(res) as Row;
    return {
      id: s(r.id),
      userId: me,
      assetId: asset.id,
      symbol: asset.symbol,
      condition: p.condition,
      value: p.value,
      basePrice: asset.price,
      isActive: true,
      triggeredAt: null,
      createdAt: s(r.created_at),
    };
  }

  async deletePriceAlert(id: string): Promise<void> {
    this.check(await this.client.from('price_alerts').delete().eq('id', id));
  }
}
