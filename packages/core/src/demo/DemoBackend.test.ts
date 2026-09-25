import { dec, gt } from '../money';
import { createMockProviders } from '../providers/mock';
import { DemoBackend, moderate } from './DemoBackend';
import type { DemoStorage } from './DemoBackend';

function setup(storage?: DemoStorage) {
  const providers = createMockProviders({
    latency: [0, 0],
    failureRate: 0,
    seed: 7,
    kycApproveAfterMs: 0,
  });
  const backend = new DemoBackend(providers, { seed: 7, engines: false, storage });
  return { providers, backend };
}

async function onboard(backend: DemoBackend, username = 'hopeful_me') {
  await backend.startEmailSignIn('me@hopium.family');
  await backend.verifyOtp('me@hopium.family', '123456');
  await backend.updateProfile({
    username,
    displayName: 'Me',
    bio: 'gm',
    countryCode: 'ID',
    birthYear: 1995,
    interests: ['memecoins'],
    riskAccepted: true,
  });
  return backend.completeOnboarding();
}

describe('seed', () => {
  it('creates 50 traders, ~500 trades and 80 theses in every status', () => {
    const { backend } = setup();
    const db = backend.inspect();
    expect(Object.values(db.profiles).filter((p) => p.isDemoBot)).toHaveLength(50);
    expect(db.trades.length).toBeGreaterThan(450);
    expect(db.theses.length).toBeGreaterThanOrEqual(75);
    for (const status of ['active', 'hit', 'invalidated', 'expired'])
      expect(db.theses.some((t) => t.status === status)).toBe(true);
    expect(db.comments.length).toBeGreaterThan(50);
    expect(db.likes.length).toBeGreaterThan(100);
  });
});

describe('DemoBackend happy path', () => {
  it('runs onboarding → trade → perps → thesis → social → leaderboard → delete', async () => {
    const { backend, providers } = setup();
    expect(await backend.getSession()).toBeNull();
    expect((await backend.checkUsername('satoshi_sis')).available).toBe(false);
    expect((await backend.checkUsername('ab')).available).toBe(false);
    const me = await onboard(backend);
    expect(me.onboardedAt).not.toBeNull();

    // New accounts start with $10k demo USDC.
    const portfolio0 = await backend.getPortfolio();
    expect(portfolio0.cashUsd).toBe('10000');

    // Follow suggestions & follow top 5.
    const suggestions = await backend.getFollowSuggestions(10);
    expect(suggestions).toHaveLength(10);
    for (const s of suggestions.slice(0, 5)) await backend.follow(s.profile.id);
    expect((await backend.getFeed('following')).items.length).toBeGreaterThan(0);

    // Buy $25 of $HOPE.
    const quote = await backend.quoteSpot({
      assetId: 'hope',
      side: 'buy',
      amountUsd: '25',
      slippageBps: 100,
    });
    expect(quote.platformFeeUsd).toBe('0.1875');
    expect(quote.gasSponsored).toBe(true);
    const result = await backend.placeSpotOrder(quote, { shareToFeed: true });
    expect(result.isFirstTrade).toBe(true);
    expect(result.order.status).toBe('filled');
    const holding = await backend.getHolding('hope');
    expect(holding && gt(holding.qty, 0)).toBe(true);
    const myTrades = await backend.getUserTrades(me.id);
    expect(myTrades.items[0]?.symbol).toBe('HOPE');

    // Min order validation for stock tokens ($2).
    const tiny = await backend.quoteSpot({
      assetId: 'aaplx',
      side: 'buy',
      amountUsd: '1.5',
      slippageBps: 100,
    });
    await expect(backend.placeSpotOrder(tiny, { shareToFeed: false })).rejects.toMatchObject({
      code: 'min_order',
    });
    const stock = await backend.quoteSpot({
      assetId: 'aaplx',
      side: 'buy',
      amountUsd: '50',
      slippageBps: 100,
    });
    await backend.placeSpotOrder(stock, { shareToFeed: true });

    // Sell half the HOPE and realize PnL.
    const sell = await backend.quoteSpot({
      assetId: 'hope',
      side: 'sell',
      qty: dec(holding!.qty).dividedBy(2).toFixed(6),
      slippageBps: 100,
    });
    const sold = await backend.placeSpotOrder(sell, { shareToFeed: false });
    expect(sold.trade?.side).toBe('sell');

    // Perps: 3× long with TP/SL, then close.
    const mark = providers.marketData.priceOf('sol');
    const pos = await backend.openPerp({
      marketId: 'sol-perp',
      side: 'long',
      marginUsd: '100',
      leverage: 3,
      acknowledgedHighLeverage: false,
      tp: dec(mark).times(1.2).toFixed(4),
      sl: dec(mark).times(0.9).toFixed(4),
    });
    expect(pos.tp).not.toBeNull();
    await expect(
      backend.openPerp({
        marketId: 'sol-perp',
        side: 'long',
        marginUsd: '10',
        leverage: 15,
        acknowledgedHighLeverage: false,
      }),
    ).rejects.toMatchObject({ code: 'high_leverage_unacknowledged' });
    expect(await backend.getPositions()).toHaveLength(1);
    await backend.closePerp(pos.id, 100);
    expect(await backend.getPositions()).toHaveLength(0);
    expect((await backend.getPositionHistory())[0]?.status).toBe('closed');

    // Thesis → appears in theses feed.
    const price = providers.marketData.priceOf('fam');
    const thesis = await backend.createThesis({
      assetId: 'fam',
      direction: 'long',
      targetPrice: dec(price).times(1.5).toFixed(6),
      invalidationPrice: dec(price).times(0.8).toFixed(6),
      timeframeEnd: new Date(Date.now() + 7 * 86_400_000).toISOString(),
      body: 'fam season is coming, community is growing fast.',
      imageUrl: null,
    });
    const theses = await backend.getFeed('theses');
    expect(theses.items[0]?.thesis?.id).toBe(thesis.id);
    await expect(
      backend.createThesis({
        assetId: 'fam',
        direction: 'long',
        targetPrice: dec(price).times(0.5).toFixed(6),
        invalidationPrice: dec(price).times(0.4).toFixed(6),
        timeframeEnd: new Date(Date.now() + 86_400_000).toISOString(),
        body: 'this should fail validation',
        imageUrl: null,
      }),
    ).rejects.toMatchObject({ code: 'invalid_input' });

    // Comment + like.
    const post = theses.items[0]!.post;
    await backend.addComment(post.id, 'lfg fam');
    await expect(backend.addComment(post.id, 'visit www.scam.com')).rejects.toMatchObject({
      code: 'content_rejected',
    });
    await backend.like(post.id);
    expect((await backend.getPost(post.id)).likedByMe).toBe(true);
    expect((await backend.getComments(post.id)).at(-1)?.body).toBe('lfg fam');

    // Copy trade increments copiers.
    const legendItem = (await backend.getFeed('trending')).items.find(
      (i) => i.trade?.side === 'buy' && i.author.isDemoBot,
    );
    if (legendItem?.trade) {
      const before = backend.inspect().trades.find((t) => t.id === legendItem.trade!.id)!.copiers;
      const cq = await backend.quoteSpot({
        assetId: legendItem.trade.assetId,
        side: 'buy',
        amountUsd: '25',
        slippageBps: 500,
      });
      await backend.placeSpotOrder(cq, {
        shareToFeed: true,
        copiedFromTradeId: legendItem.trade.id,
      });
      expect(backend.inspect().trades.find((t) => t.id === legendItem.trade!.id)!.copiers).toBe(
        before + 1,
      );
    }

    // Leaderboard shows the user (pinned row).
    const board = await backend.getLeaderboard('weekly', 'copiers');
    expect(board.me?.userId).toBe(me.id);
    const pnlBoard = await backend.getLeaderboard('all_time', 'pnl_pct');
    expect(pnlBoard.entries.length).toBeGreaterThan(5);
    expect(pnlBoard.entries[0]!.rank).toBe(1);

    // Notifications: followed trade fan-out from a followed trader.
    await backend.setNotifyOnTrade(suggestions[0]!.profile.id, true);
    backend.simulateBotTrade(suggestions[0]!.profile.id);
    const notifications = await backend.getNotifications();
    expect(notifications.some((n) => n.type === 'followed_trade')).toBe(true);
    expect(notifications.some((n) => n.type === 'badge')).toBe(true);
    await backend.markAllNotificationsRead();
    expect((await backend.getNotifications()).every((n) => n.readAt)).toBe(true);

    // Badges.
    const badges = (await backend.getUserBadges(me.id)).map((b) => b.slug);
    expect(badges).toEqual(
      expect.arrayContaining([
        'family',
        'first_trade',
        'first_thesis',
        'perp_pioneer',
        'stock_token',
      ]),
    );

    // Language switch persists on profile.
    expect((await backend.updateProfile({ language: 'id' })).language).toBe('id');

    // Delete account.
    await expect(backend.deleteAccount('nope')).rejects.toMatchObject({ code: 'invalid_input' });
    await backend.deleteAccount('delete');
    expect(await backend.getSession()).toBeNull();
    expect(backend.inspect().profiles[me.id]).toBeUndefined();
  });

  it('blocks under-18 users and region-restricted features', async () => {
    const { backend } = setup();
    await backend.signInWithProvider('google');
    await expect(
      backend.updateProfile({ birthYear: new Date().getFullYear() - 16 }),
    ).rejects.toMatchObject({ code: 'invalid_input' });
    await backend.updateProfile({
      username: 'us_user',
      countryCode: 'US',
      birthYear: 1990,
      riskAccepted: true,
    });
    await backend.completeOnboarding();
    const q = await backend.quoteSpot({
      assetId: 'tslax',
      side: 'buy',
      amountUsd: '10',
      slippageBps: 100,
    });
    await expect(backend.placeSpotOrder(q, { shareToFeed: false })).rejects.toMatchObject({
      code: 'region_restricted',
    });
    await expect(
      backend.openPerp({
        marketId: 'btc-perp',
        side: 'long',
        marginUsd: '10',
        leverage: 2,
        acknowledgedHighLeverage: false,
      }),
    ).rejects.toMatchObject({ code: 'region_restricted' });
    expect((await backend.getRegionRule()).allowPerps).toBe(false);
  });

  it('requires KYC to withdraw and validates addresses', async () => {
    const { backend } = setup();
    await onboard(backend, 'withdrawer');
    const req = {
      assetId: 'usdc',
      chain: 'solana' as const,
      address: '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU',
      amount: '10',
    };
    await expect(backend.withdraw(req)).rejects.toMatchObject({ code: 'kyc_required' });
    await backend.startKyc();
    await new Promise((r) => setTimeout(r, 5));
    expect(await backend.getKycStatus()).toBe('approved');
    await expect(backend.withdraw({ ...req, address: 'not-an-address' })).rejects.toMatchObject({
      code: 'invalid_input',
    });
    const item = await backend.withdraw(req);
    expect(item.kind).toBe('withdrawal');
    expect((await backend.getPortfolio()).cashUsd).toBe('9989.99');
  });

  it('deposits via the on-ramp and hides blocked users everywhere', async () => {
    const { backend } = setup();
    await onboard(backend, 'depositor');
    const quote = await backend.getOnrampQuote({ fiat: 'USD', fiatAmount: '100' });
    await backend.deposit(quote, 'apple_pay');
    expect((await backend.getPortfolio()).cashUsd).toBe('10098.01');
    const target = (await backend.getFollowSuggestions(1))[0]!.profile;
    await backend.block(target.id);
    const trending = await backend.getFeed('trending');
    expect(trending.items.some((i) => i.author.id === target.id)).toBe(false);
    expect((await backend.search(target.username)).people).toHaveLength(0);
    await backend.unblock(target.id);
  });

  it('redacts exact amounts unless the author opts in', async () => {
    const { backend } = setup();
    await onboard(backend, 'viewer');
    const feed = await backend.getFeed('trending');
    const redacted = feed.items.find((i) => i.trade && !i.author.shareExactAmounts);
    expect(redacted?.trade?.notional).toBe('0');
    expect(redacted?.sizeBucket).not.toBeNull();
  });

  it('resolves theses and triggers price alerts', async () => {
    const { backend, providers } = setup();
    await onboard(backend, 'alerter');
    const price = providers.marketData.priceOf('sol');
    const t = await backend.createThesis({
      assetId: 'sol',
      direction: 'long',
      targetPrice: dec(price).times(1.1).toFixed(4),
      invalidationPrice: dec(price).times(0.9).toFixed(4),
      timeframeEnd: new Date(Date.now() + 86_400_000).toISOString(),
      body: 'sol breakout incoming soon',
      imageUrl: null,
    });
    await backend.createPriceAlert({
      assetId: 'sol',
      condition: 'above',
      value: dec(price).times(1.05).toFixed(4),
    });
    providers.marketData.setPrice('sol', dec(price).times(1.2).toFixed(4));
    backend.resolveTheses();
    backend.checkPriceAlerts();
    expect((await backend.getThesis(t.id)).thesis.status).toBe('hit');
    const types = (await backend.getNotifications()).map((n) => n.type);
    expect(types).toEqual(expect.arrayContaining(['thesis_update', 'price_alert']));
  });

  it('persists and restores state through storage', async () => {
    let saved: string | null = null;
    const storage: DemoStorage = {
      load: () => saved,
      save: (v) => (saved = v),
      clear: () => (saved = null),
    };
    const { backend } = setup(storage);
    await onboard(backend, 'persisted');
    backend.saveNow();
    expect(saved).not.toBeNull();
    const { backend: restored } = setup(storage);
    expect((await restored.getMe())?.username).toBe('persisted');
    expect((await restored.getPortfolio()).cashUsd).toBe('10000');
  });
});

describe('moderation', () => {
  it('blocks links and spam phrases', () => {
    expect(() => moderate('check https://x.io')).toThrow();
    expect(() => moderate('DM for signals')).toThrow();
    expect(() => moderate('solid thesis')).not.toThrow();
  });
});
