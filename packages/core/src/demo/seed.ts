import { dec, div, gt, mul, round, str } from '../money';
import type { MockMarketData } from '../providers/mock/marketData';
import { between, gaussian, mulberry32, pick, randInt, rngId, shuffle, type Rng } from '../random';
import { fifoSell, type Lot } from '../trading/spot';
import { resolveThesis } from '../trading/thesis';
import { tierForVolume } from '../trading/leaderboard';
import type {
  Asset,
  Comment,
  Post,
  Profile,
  Thesis,
  ThesisStatus,
  Trade,
  UserBadge,
} from '../types';
import {
  BADGES,
  BOT_BIOS,
  BOT_COUNTRIES,
  BOT_USERNAMES,
  COMMENT_POOL,
  REGION_RULES,
  THESIS_BODIES_LONG,
  THESIS_BODIES_SHORT,
} from './content';
import { DB_VERSION, DEFAULT_NOTIFICATION_SETTINGS, lotKey, type DemoDb } from './db';

const DAY = 86_400_000;

const titleCase = (username: string): string =>
  username
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');

/** Price some time ago: a noisy bridge that converges on today's price. */
function historicalPrice(
  rng: Rng,
  asset: Asset,
  daysAgo: number,
  dailyVol: number,
  skill: number,
): string {
  const vol = Math.max(dailyVol, 0.01);
  const noise =
    gaussian(rng) * vol * Math.sqrt(Math.max(daysAgo, 0.02)) * 0.8 -
    skill * vol * Math.sqrt(daysAgo) * 0.3;
  return round(mul(asset.price, Math.exp(noise).toFixed(12)), 12);
}

export interface SeedOptions {
  seed: number;
  now: number;
  market: MockMarketData;
}

/**
 * Deterministic demo world: 50 traders, a follow graph, ~500 trades with FIFO
 * PnL, 80 theses in every status, posts, comments, likes and badges.
 */
export function seedDemoDb({ seed, now, market }: SeedOptions): DemoDb {
  const rng = mulberry32(seed ^ 0x51ed);
  const iso = (t: number) => new Date(t).toISOString();
  const assets = market.allAssets();
  const tradable = assets.filter((a) => !a.tags.includes('stablecoin'));
  const memes = tradable.filter((a) => a.tags.includes('meme'));
  const stocks = tradable.filter((a) => a.class === 'stock_token');
  const majors = tradable.filter((a) => a.tags.includes('blue-chip') || a.tags.includes('l1'));
  const volOf = (a: Asset) =>
    a.tags.includes('meme') ? 0.16 : a.class === 'stock_token' ? 0.02 : 0.05;

  const db: DemoDb = {
    version: DB_VERSION,
    seed,
    createdAt: iso(now),
    profiles: {},
    follows: [],
    blocks: [],
    orders: [],
    trades: [],
    lots: {},
    theses: [],
    posts: [],
    comments: [],
    likes: [],
    userBadges: [],
    notifications: [],
    notificationSettings: {},
    pushTokens: [],
    priceAlerts: [],
    reports: [],
    activity: {},
    portfolioSnapshots: {},
    regionRules: REGION_RULES,
    leaderboardPrevRanks: {},
    liquidationWarned: {},
    session: null,
    pendingEmail: null,
  };

  // ─── profiles ───────────────────────────────────────────────────────────
  const bots: Profile[] = BOT_USERNAMES.map((username, i) => {
    const r = mulberry32(seed + i * 7919);
    const created = now - randInt(r, 30, 420) * DAY;
    return {
      id: `bot_${username}`,
      username,
      displayName: titleCase(username),
      avatarUrl: null,
      bio: pick(r, BOT_BIOS),
      countryCode: pick(r, BOT_COUNTRIES),
      birthYear: randInt(r, 1975, 2003),
      interests: shuffle(r, [
        'memecoins',
        'blue_chip',
        'stock_tokens',
        'perps',
        'ai_tokens',
        'defi',
      ] as const).slice(0, randInt(r, 1, 3)),
      holdingsPublic: r() > 0.25,
      shareExactAmounts: r() > 0.8,
      tier: 'rookie',
      kycStatus: 'approved',
      language: r() > 0.5 ? 'id' : 'en',
      theme: 'dark',
      onboardedAt: iso(created),
      createdAt: iso(created),
      riskAcceptedAt: iso(created),
      isDemoBot: true,
    };
  });
  for (const b of bots) {
    db.profiles[b.id] = b;
    db.notificationSettings[b.id] = { ...DEFAULT_NOTIFICATION_SETTINGS };
  }

  // Skill: positive = tends to buy lower / sell higher.
  const skill = new Map(
    bots.map((b, i) => [b.id, i < 8 ? 1.2 : i < 20 ? 0.5 : between(rng, -0.6, 0.4)]),
  );
  // Activity weight: early bots are the "legends" and trade most.
  const weight = bots.map((_, i) => (i < 8 ? 4 : i < 20 ? 2 : 1));
  const totalWeight = weight.reduce((a, b) => a + b, 0);
  const pickBot = (): Profile => {
    let x = rng() * totalWeight;
    for (let i = 0; i < bots.length; i++) {
      x -= weight[i] as number;
      if (x <= 0) return bots[i] as Profile;
    }
    return bots[bots.length - 1] as Profile;
  };

  // ─── follow graph ───────────────────────────────────────────────────────
  for (const b of bots) {
    const count = randInt(rng, 5, 15);
    const targets = shuffle(
      rng,
      bots.filter((o) => o.id !== b.id),
    ).slice(0, count);
    // Legends attract more followers.
    for (const t of targets)
      db.follows.push({
        followerId: b.id,
        followeeId: t.id,
        notify: false,
        createdAt: iso(now - randInt(rng, 1, 60) * DAY),
      });
    for (const legend of bots.slice(0, 8)) {
      if (legend.id !== b.id && !targets.includes(legend) && rng() > 0.4) {
        db.follows.push({
          followerId: b.id,
          followeeId: legend.id,
          notify: false,
          createdAt: iso(now - randInt(rng, 1, 60) * DAY),
        });
      }
    }
  }

  // ─── trades (chronological, FIFO) ───────────────────────────────────────
  const events = Array.from({ length: 500 }, () => ({
    bot: pickBot(),
    at: now - Math.pow(rng(), 1.6) * 30 * DAY,
  })).sort((a, b) => a.at - b.at);
  const tradeRecords: Trade[] = [];
  for (const { bot, at } of events) {
    const key = (assetId: string) => lotKey(bot.id, assetId);
    const held = Object.keys(db.lots).filter(
      (k) => k.startsWith(`${bot.id}:`) && (db.lots[k]?.length ?? 0) > 0,
    );
    const sell = held.length > 0 && rng() < 0.42;
    let asset: Asset;
    if (sell) {
      const heldKey = pick(rng, held);
      asset = market.assetSync(heldKey.slice(bot.id.length + 1));
    } else {
      const roll = rng();
      asset =
        roll < 0.5
          ? pick(rng, memes)
          : roll < 0.75
            ? pick(rng, majors)
            : roll < 0.92
              ? pick(rng, stocks)
              : pick(rng, tradable);
    }
    const daysAgo = (now - at) / DAY;
    const s = skill.get(bot.id) ?? 0;
    const price = historicalPrice(rng, asset, daysAgo, volOf(asset), sell ? -s : s);
    const lots: Lot[] = db.lots[key(asset.id)] ?? [];
    let qty: string;
    let realizedPnl = '0';
    if (sell) {
      const heldQty = lots.reduce((acc, l) => dec(acc).plus(dec(l.qty)).toFixed(), '0');
      qty = round(mul(heldQty, between(rng, 0.3, 1).toFixed(4)), 10, 'down');
      if (!gt(qty, 0)) continue;
      const res = fifoSell(lots, qty, price);
      realizedPnl = round(res.realizedPnl, 6);
      db.lots[key(asset.id)] = res.remainingLots;
    } else {
      const notionalUsd = String(
        Math.round(
          Math.exp(between(rng, Math.log(15), Math.log(bot.id === bots[0]?.id ? 40000 : 6000))),
        ),
      );
      qty = round(div(notionalUsd, price), 10, 'down');
      lots.push({ qty, price });
      db.lots[key(asset.id)] = lots;
    }
    const notionalUsd = round(mul(qty, price), 6);
    const trade: Trade = {
      id: rngId(rng, 'tr_'),
      userId: bot.id,
      orderId: rngId(rng, 'or_'),
      assetId: asset.id,
      symbol: asset.symbol,
      assetClass: asset.class === 'stock_token' ? 'stock_token' : 'crypto',
      side: sell ? 'sell' : 'buy',
      qty,
      price,
      notional: notionalUsd,
      fee: round(mul(notionalUsd, '0.0075'), 6),
      realizedPnl,
      isPublic: rng() > 0.08,
      copiedFromTradeId: null,
      copiers: 0,
      createdAt: iso(at),
    };
    tradeRecords.push(trade);
  }
  // Copiers: popular trades get copied.
  for (const t of tradeRecords) {
    const legend = bots.slice(0, 8).some((b) => b.id === t.userId);
    t.copiers = t.isPublic ? Math.floor(Math.pow(rng(), legend ? 1.2 : 3) * (legend ? 60 : 12)) : 0;
  }
  db.trades = tradeRecords;

  // Tiers from lifetime volume.
  for (const b of bots) {
    const volume = tradeRecords
      .filter((t) => t.userId === b.id)
      .reduce((acc, t) => dec(acc).plus(dec(t.notional)).toFixed(), '0');
    // Seeded history is 30 days; scale up for a lifetime tier estimate.
    b.tier = tierForVolume(mul(volume, 6));
  }

  // ─── theses ────────────────────────────────────────────────────────────
  const statusPlan: ThesisStatus[] = [
    ...Array<ThesisStatus>(35).fill('active'),
    ...Array<ThesisStatus>(20).fill('hit'),
    ...Array<ThesisStatus>(15).fill('invalidated'),
    ...Array<ThesisStatus>(10).fill('expired'),
  ];
  for (const plan of statusPlan) {
    const author = pickBot();
    const asset =
      rng() < 0.55 ? pick(rng, memes) : rng() < 0.6 ? pick(rng, majors) : pick(rng, stocks);
    const direction = rng() < 0.78 ? 'long' : 'short';
    const vol = volOf(asset);
    const up = (x: number) => (1 + x).toFixed(8);
    const down = (x: number) => (1 - x).toFixed(8);
    let entry: string;
    let createdAt: number;
    let end: number;
    const targetMove = between(rng, 2, 6) * vol;
    const stopMove = between(rng, 0.8, 2) * vol;
    if (plan === 'active') {
      createdAt = now - between(rng, 0.1, 6) * DAY;
      end = now + between(rng, 1, 25) * DAY;
      // Current price sits somewhere between invalidation and target.
      const progress = between(rng, -0.6, 0.8);
      const move = progress >= 0 ? progress * targetMove : progress * stopMove;
      entry = round(div(asset.price, direction === 'long' ? up(move) : down(move)), 12);
    } else {
      createdAt = now - between(rng, 5, 28) * DAY;
      end =
        plan === 'expired'
          ? createdAt + between(rng, 1, 4) * DAY
          : createdAt + between(rng, 3, 30) * DAY;
      entry = historicalPrice(rng, asset, (now - createdAt) / DAY, vol, 0);
    }
    const target = round(
      mul(entry, direction === 'long' ? up(targetMove) : down(Math.min(targetMove, 0.7))),
      12,
    );
    const invalidation = round(
      mul(entry, direction === 'long' ? down(Math.min(stopMove, 0.8)) : up(stopMove)),
      12,
    );
    const resolvedAt =
      plan === 'active'
        ? null
        : iso(Math.min(end, createdAt + between(rng, 0.3, 0.9) * (end - createdAt)));
    const thesis: Thesis = {
      id: rngId(rng, 'th_'),
      authorId: author.id,
      assetId: asset.id,
      symbol: asset.symbol,
      direction,
      entryPrice: entry,
      targetPrice: target,
      invalidationPrice: invalidation,
      timeframeEnd: iso(end),
      body: pick(rng, direction === 'long' ? THESIS_BODIES_LONG : THESIS_BODIES_SHORT),
      imageUrl: null,
      status: plan,
      resolvedAt: plan === 'expired' ? iso(end) : resolvedAt,
      maxFavorablePct:
        plan === 'hit'
          ? str(dec(targetMove * 100).toDecimalPlaces(4))
          : plan === 'invalidated'
            ? str(dec(between(rng, 0, targetMove * 40)).toDecimalPlaces(4))
            : plan === 'expired'
              ? str(dec(between(rng, 0, targetMove * 70)).toDecimalPlaces(4))
              : '0',
      createdAt: iso(createdAt),
    };
    if (plan === 'active') {
      // Keep seeded active theses active at today's price.
      const { status, maxFavorablePct } = resolveThesis(thesis, asset.price, now);
      if (status !== 'active') continue;
      thesis.maxFavorablePct = maxFavorablePct;
    }
    db.theses.push(thesis);
  }

  // ─── posts, likes, comments ─────────────────────────────────────────────
  const makePost = (p: Omit<Post, 'id' | 'likeCount' | 'commentCount' | 'isHidden'>): Post => ({
    ...p,
    id: rngId(rng, 'po_'),
    likeCount: 0,
    commentCount: 0,
    isHidden: false,
  });
  for (const t of db.trades.filter((x) => x.isPublic)) {
    db.posts.push(
      makePost({
        authorId: t.userId,
        kind: 'trade',
        tradeId: t.id,
        thesisId: null,
        body: '',
        milestone: null,
        createdAt: t.createdAt,
      }),
    );
  }
  for (const th of db.theses) {
    db.posts.push(
      makePost({
        authorId: th.authorId,
        kind: 'thesis',
        tradeId: null,
        thesisId: th.id,
        body: '',
        milestone: null,
        createdAt: th.createdAt,
      }),
    );
  }
  for (const b of bots.slice(0, 6)) {
    db.posts.push(
      makePost({
        authorId: b.id,
        kind: 'milestone',
        tradeId: null,
        thesisId: null,
        body: '',
        milestone: { type: 'rank_up', rank: randInt(rng, 1, 10) },
        createdAt: iso(now - between(rng, 0.2, 5) * DAY),
      }),
    );
  }
  for (const post of db.posts) {
    const recency = Math.max(0.05, 1 - (now - Date.parse(post.createdAt)) / (30 * DAY));
    const likeCount = Math.floor(
      Math.pow(rng(), 1.5) * 35 * recency + (post.kind === 'thesis' ? 3 : 0),
    );
    const likers = shuffle(
      rng,
      bots.filter((b) => b.id !== post.authorId),
    ).slice(0, likeCount);
    for (const l of likers) db.likes.push({ postId: post.id, userId: l.id });
    post.likeCount = likers.length;
    const commentCount = rng() < 0.45 ? randInt(rng, 1, post.kind === 'thesis' ? 6 : 3) : 0;
    for (let i = 0; i < commentCount; i++) {
      const author = pick(
        rng,
        bots.filter((b) => b.id !== post.authorId),
      );
      const c: Comment = {
        id: rngId(rng, 'co_'),
        postId: post.id,
        authorId: author.id,
        body: pick(rng, COMMENT_POOL),
        parentId: null,
        createdAt: iso(Math.min(now, Date.parse(post.createdAt) + between(rng, 0.01, 2) * DAY)),
      };
      db.comments.push(c);
    }
    post.commentCount = commentCount;
  }

  // ─── badges ────────────────────────────────────────────────────────────
  const award = (userId: string, slug: string, at: string) =>
    db.userBadges.push({ userId, slug, awardedAt: at } satisfies UserBadge);
  for (const b of bots) {
    award(b.id, 'family', b.createdAt);
    const first = db.trades.find((t) => t.userId === b.id);
    if (first) award(b.id, 'first_trade', first.createdAt);
    const firstThesis = db.theses.find((t) => t.authorId === b.id);
    if (firstThesis) award(b.id, 'first_thesis', firstThesis.createdAt);
    const hit = db.theses.find((t) => t.authorId === b.id && t.status === 'hit');
    if (hit?.resolvedAt) award(b.id, 'oracle', hit.resolvedAt);
    if (db.trades.some((t) => t.userId === b.id && t.assetClass === 'stock_token'))
      award(b.id, 'stock_token', b.createdAt);
    if (b.tier === 'legend') award(b.id, 'legend', b.createdAt);
  }
  if (!BADGES.length) throw new Error('badge catalog missing');

  // Remove empty lot lists.
  for (const k of Object.keys(db.lots)) if (!db.lots[k]?.length) delete db.lots[k];
  return db;
}

/** Holdings value for a bot from its FIFO lots at current prices. */
export function lotsValue(lots: Lot[], price: string): string {
  return lots.reduce(
    (acc, l) =>
      dec(acc)
        .plus(dec(l.qty).times(dec(price)))
        .toFixed(),
    '0',
  );
}
