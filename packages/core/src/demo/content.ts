import type { Badge, RegionRule } from '../types';

/** 50 fictional demo traders. No real people. */
export const BOT_USERNAMES = [
  'satoshi_sis',
  'moonmaxi',
  'degen_dewi',
  'whale_wira',
  'paperhands_pete',
  'gm_gita',
  'hodl_hana',
  'rizky_rekt',
  'budi_bags',
  'luna_lestari',
  'chart_chad',
  'fomo_fiona',
  'ape_arief',
  'based_bayu',
  'bullish_bella',
  'candle_citra',
  'dip_diana',
  'eth_eko',
  'flip_fajar',
  'gainz_galih',
  'hype_hendra',
  'intan_ico',
  'joko_jpeg',
  'kiki_kripto',
  'leverage_lia',
  'meme_maya',
  'nft_nanda',
  'oracle_oki',
  'pump_putri',
  'quant_qori',
  'rally_rina',
  'sol_surya',
  'tendies_tari',
  'uptober_umar',
  'vibes_vina',
  'wagmi_wawan',
  'xrp_xena',
  'yield_yuda',
  'zen_zahra',
  'alpha_agus',
  'beta_bimo',
  'ciao_cahya',
  'doge_dimas',
  'early_eka',
  'fren_fitri',
  'giga_gilang',
  'hopeful_hadi',
  'iron_ira',
  'jiwa_jaya',
  'karma_kurnia',
] as const;

export const BOT_BIOS = [
  'buying the dip since before it was cool.',
  'charts, coffee, conviction.',
  'long memes, short sleep.',
  'not financial advice. mostly vibes.',
  'swing trader. stock tokens after hours.',
  'risk management is my love language.',
  'perps degen in recovery.',
  'dca and chill.',
  'onchain since 2017. still here.',
  'i post my losses too.',
  'thesis first, trade second.',
  'jakarta · solana · sambal',
  'boring blue chips, spicy memes.',
  'size small, think big.',
  'here for the family.',
];

export const BOT_COUNTRIES = [
  'ID',
  'ID',
  'ID',
  'SG',
  'PH',
  'MY',
  'TH',
  'VN',
  'AE',
  'BR',
  'DE',
  'AU',
  'NG',
  'IN',
];

export const THESIS_BODIES_LONG = [
  'volume has been building for a week while price chopped sideways. breakout above the range high opens room to the target. invalidation below the last higher low.',
  'community keeps growing and exchange inflows are down. i think the next leg starts soon. sizing small with a clear stop.',
  'strong earnings momentum and the chart just reclaimed its 50-day. looking for continuation into the target over the timeframe.',
  'funding reset to neutral after the flush, open interest rebuilt from lower levels. classic setup for a squeeze higher.',
  'akumulasi pelan-pelan, support kuat di area ini. target realistis, stop jelas di bawah support.',
  'rotation into this sector is just starting. relative strength vs majors looks great on the weekly.',
  'higher lows for three weeks straight. if it holds this level, i expect a retest of the prior high.',
];

export const THESIS_BODIES_SHORT = [
  'lower highs everywhere and volume drying up on bounces. expecting a move back to support. invalidation above the recent high.',
  'hype peaked last week, unlocks coming, and buyers look exhausted. short with tight risk.',
  'broke its trendline on the daily with no follow-through buying. targeting the gap fill below.',
  'terlalu cepat naik, rawan koreksi. short kecil dengan invalidasi jelas.',
];

export const COMMENT_POOL = [
  'lfg 🚀',
  'nice entry',
  'what is your stop?',
  'been watching this one too',
  'size responsibly fam',
  'mantap 🔥',
  'this aged well',
  'gm, great call',
  'following this',
  'careful with the leverage',
  'bullish',
  'solid thesis',
  'took a small bag',
  'i am early for once',
  'wagmi',
  'cuan terus',
  'respect the invalidation',
  'charts look clean',
];

export const BADGES: Badge[] = [
  {
    slug: 'family',
    nameEn: 'family member',
    nameId: 'anggota family',
    descriptionEn: 'Completed onboarding.',
    descriptionId: 'Menyelesaikan onboarding.',
    icon: '🫶',
  },
  {
    slug: 'first_trade',
    nameEn: 'first trade',
    nameId: 'trade pertama',
    descriptionEn: 'Placed your first trade.',
    descriptionId: 'Melakukan trade pertama.',
    icon: '🚀',
  },
  {
    slug: 'first_thesis',
    nameEn: 'thesis writer',
    nameId: 'penulis tesis',
    descriptionEn: 'Published your first thesis.',
    descriptionId: 'Menerbitkan tesis pertama.',
    icon: '📝',
  },
  {
    slug: 'oracle',
    nameEn: 'oracle',
    nameId: 'oracle',
    descriptionEn: 'A thesis hit its target.',
    descriptionId: 'Tesis mencapai target.',
    icon: '🔮',
  },
  {
    slug: 'social',
    nameEn: 'social butterfly',
    nameId: 'kupu-kupu sosial',
    descriptionEn: 'Followed 5 traders.',
    descriptionId: 'Mengikuti 5 trader.',
    icon: '🦋',
  },
  {
    slug: 'copycat',
    nameEn: 'copycat',
    nameId: 'peniru',
    descriptionEn: 'Copied a trade.',
    descriptionId: 'Menyalin sebuah trade.',
    icon: '🐱',
  },
  {
    slug: 'perp_pioneer',
    nameEn: 'perp pioneer',
    nameId: 'pelopor perp',
    descriptionEn: 'Opened your first perp position.',
    descriptionId: 'Membuka posisi perp pertama.',
    icon: '⚡',
  },
  {
    slug: 'stock_token',
    nameEn: '24/7 investor',
    nameId: 'investor 24/7',
    descriptionEn: 'Bought a stock token.',
    descriptionId: 'Membeli stock token.',
    icon: '📈',
  },
  {
    slug: 'legend',
    nameEn: 'legend status',
    nameId: 'status legend',
    descriptionEn: 'Reached the legend tier.',
    descriptionId: 'Mencapai tier legend.',
    icon: '👑',
  },
];

/**
 * Region feature flags. Unlisted countries fall back to DEFAULT_REGION_RULE.
 * Stock tokens are not offered to US persons; UK retail cannot trade crypto
 * derivatives.
 */
export const REGION_RULES: RegionRule[] = [
  {
    countryCode: 'US',
    allowStockTokens: false,
    allowPerps: false,
    allowCopyTrade: true,
    requiresKycFor: ['withdraw'],
  },
  {
    countryCode: 'GB',
    allowStockTokens: true,
    allowPerps: false,
    allowCopyTrade: true,
    requiresKycFor: ['withdraw', 'stock_tokens'],
  },
  {
    countryCode: 'CA',
    allowStockTokens: false,
    allowPerps: false,
    allowCopyTrade: true,
    requiresKycFor: ['withdraw'],
  },
  {
    countryCode: 'ID',
    allowStockTokens: true,
    allowPerps: true,
    allowCopyTrade: true,
    requiresKycFor: ['withdraw'],
  },
];

export const DEFAULT_REGION_RULE: Omit<RegionRule, 'countryCode'> = {
  allowStockTokens: true,
  allowPerps: true,
  allowCopyTrade: true,
  requiresKycFor: ['withdraw'],
};

/** Very small moderation list; production uses the moderate-content edge function. */
export const BLOCKED_WORDS = [
  'scam-link',
  'free money',
  'send me',
  'dm for signals',
  'guaranteed profit',
];
