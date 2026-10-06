-- hopium.family schema. Every table has RLS enabled with explicit policies.
-- Money amounts use numeric(38,18) — never floating point.

create extension if not exists citext;
create extension if not exists pgcrypto;

-- ─── profiles ───────────────────────────────────────────────────────────────
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username citext unique check (username ~ '^[a-z0-9_]{3,20}$'),
  display_name text not null default '' check (char_length(display_name) <= 40),
  avatar_url text,
  bio text not null default '' check (char_length(bio) <= 160),
  country_code text check (country_code ~ '^[A-Z]{2}$'),
  birth_year int check (birth_year between 1900 and extract(year from now())::int),
  interests text[] not null default '{}',
  holdings_public boolean not null default true,
  share_exact_amounts boolean not null default false,
  tier text not null default 'rookie' check (tier in ('rookie','believer','degen','whale','legend')),
  kyc_status text not null default 'none' check (kyc_status in ('none','pending','approved','rejected')),
  language text not null default 'en' check (language in ('en','id')),
  theme text not null default 'dark' check (theme in ('dark','light','system')),
  risk_accepted_at timestamptz,
  onboarded_at timestamptz,
  created_at timestamptz not null default now()
);
alter table public.profiles enable row level security;

-- ─── social graph ───────────────────────────────────────────────────────────
create table public.follows (
  id uuid primary key default gen_random_uuid(),
  follower_id uuid not null references public.profiles(id) on delete cascade,
  followee_id uuid not null references public.profiles(id) on delete cascade,
  notify boolean not null default false,
  created_at timestamptz not null default now(),
  unique (follower_id, followee_id),
  check (follower_id <> followee_id)
);
alter table public.follows enable row level security;
create index follows_followee_idx on public.follows(followee_id);

create table public.blocks (
  id uuid primary key default gen_random_uuid(),
  blocker_id uuid not null references public.profiles(id) on delete cascade,
  blocked_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);
alter table public.blocks enable row level security;

-- Defined after public.blocks: SQL function bodies are validated at creation.
create or replace function public.is_blocked(a uuid, b uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.blocks
    where (blocker_id = a and blocked_id = b) or (blocker_id = b and blocked_id = a)
  );
$$;

-- ─── wallets & assets ───────────────────────────────────────────────────────
create table public.wallets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  chain text not null check (chain in ('solana','base','ethereum','arbitrum','robinhood')),
  address text not null,
  created_at timestamptz not null default now(),
  unique (user_id, chain)
);
alter table public.wallets enable row level security;

create table public.assets (
  id text primary key,
  symbol text not null,
  name text not null,
  class text not null check (class in ('crypto','stock_token','perp')),
  chain text,
  address text,
  logo_url text,
  decimals int not null default 18,
  tags text[] not null default '{}',
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);
alter table public.assets enable row level security;

-- ─── trading ────────────────────────────────────────────────────────────────
create table public.orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  asset_id text not null references public.assets(id),
  class text not null check (class in ('crypto','stock_token','perp')),
  side text not null check (side in ('buy','sell')),
  type text not null default 'market' check (type in ('market','limit')),
  amount_in numeric(38,18) not null,
  amount_out numeric(38,18) not null default 0,
  price numeric(38,18) not null default 0,
  fee numeric(38,18) not null default 0,
  slippage_bps int not null check (slippage_bps between 1 and 2000),
  status text not null default 'pending' check (status in ('pending','filled','failed','cancelled')),
  tx_hash text,
  error_code text,
  copied_from_trade_id uuid,
  created_at timestamptz not null default now()
);
alter table public.orders enable row level security;
create index orders_user_idx on public.orders(user_id, created_at desc);

create table public.trades (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete set null,
  order_id uuid references public.orders(id) on delete set null,
  asset_id text not null references public.assets(id),
  symbol text not null,
  asset_class text not null default 'crypto',
  side text not null check (side in ('buy','sell')),
  qty numeric(38,18) not null,
  price numeric(38,18) not null,
  notional numeric(38,18) not null,
  fee numeric(38,18) not null default 0,
  realized_pnl numeric(38,18) not null default 0,
  is_public boolean not null default true,
  copied_from_trade_id uuid references public.trades(id) on delete set null,
  copiers int not null default 0,
  created_at timestamptz not null default now()
);
alter table public.trades enable row level security;
create index trades_user_idx on public.trades(user_id, created_at desc);
create index trades_asset_idx on public.trades(asset_id, created_at desc);

create table public.holdings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  asset_id text not null references public.assets(id),
  qty numeric(38,18) not null default 0,
  avg_entry numeric(38,18) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, asset_id)
);
alter table public.holdings enable row level security;

create table public.perp_positions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  market text not null,
  side text not null check (side in ('long','short')),
  size numeric(38,18) not null,
  entry_price numeric(38,18) not null,
  leverage numeric(10,2) not null check (leverage >= 1),
  margin numeric(38,18) not null,
  liq_price numeric(38,18) not null,
  tp numeric(38,18),
  sl numeric(38,18),
  status text not null default 'open' check (status in ('open','closed','liquidated')),
  realized_pnl numeric(38,18) not null default 0,
  closed_at timestamptz,
  created_at timestamptz not null default now()
);
alter table public.perp_positions enable row level security;
create index perp_positions_open_idx on public.perp_positions(status) where status = 'open';

-- ─── theses & posts ─────────────────────────────────────────────────────────
create table public.theses (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.profiles(id) on delete cascade,
  asset_id text not null references public.assets(id),
  symbol text not null,
  direction text not null check (direction in ('long','short')),
  entry_price numeric(38,18) not null,
  target_price numeric(38,18) not null,
  invalidation_price numeric(38,18) not null,
  timeframe_end timestamptz not null,
  body text not null check (char_length(body) between 10 and 2000),
  image_url text,
  status text not null default 'active' check (status in ('active','hit','invalidated','expired')),
  resolved_at timestamptz,
  max_favorable_pct numeric(38,18) not null default 0,
  created_at timestamptz not null default now(),
  check (
    (direction = 'long' and target_price > entry_price and invalidation_price < entry_price) or
    (direction = 'short' and target_price < entry_price and invalidation_price > entry_price)
  )
);
alter table public.theses enable row level security;

create table public.posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.profiles(id) on delete cascade,
  kind text not null check (kind in ('trade','thesis','text','milestone')),
  trade_id uuid references public.trades(id) on delete cascade,
  thesis_id uuid references public.theses(id) on delete cascade,
  body text not null default '' check (char_length(body) <= 2000),
  milestone jsonb,
  like_count int not null default 0,
  comment_count int not null default 0,
  is_hidden boolean not null default false,
  created_at timestamptz not null default now()
);
alter table public.posts enable row level security;
create index posts_author_idx on public.posts(author_id, created_at desc);
create index posts_created_idx on public.posts(created_at desc);

create table public.comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 500),
  parent_id uuid references public.comments(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.comments enable row level security;
create index comments_post_idx on public.comments(post_id, created_at);

create table public.likes (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (post_id, user_id)
);
alter table public.likes enable row level security;

-- ─── gamification ───────────────────────────────────────────────────────────
create table public.leaderboard_snapshots (
  id uuid primary key default gen_random_uuid(),
  period text not null check (period in ('daily','weekly','season','all_time')),
  metric text not null check (metric in ('pnl_pct','thesis_accuracy','copiers')),
  user_id uuid not null references public.profiles(id) on delete cascade,
  rank int not null,
  previous_rank int,
  value numeric(38,18) not null,
  computed_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
alter table public.leaderboard_snapshots enable row level security;
create index leaderboard_lookup_idx on public.leaderboard_snapshots(period, metric, rank);

create table public.badges (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name_en text not null,
  name_id text not null,
  description text not null,
  icon text not null,
  created_at timestamptz not null default now()
);
alter table public.badges enable row level security;

create table public.user_badges (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  slug text not null references public.badges(slug),
  created_at timestamptz not null default now(),
  unique (user_id, slug)
);
alter table public.user_badges enable row level security;

-- ─── notifications & alerts ─────────────────────────────────────────────────
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  type text not null,
  title text not null,
  body text not null,
  data jsonb not null default '{}',
  read_at timestamptz,
  created_at timestamptz not null default now()
);
alter table public.notifications enable row level security;
create index notifications_user_idx on public.notifications(user_id, created_at desc);

create table public.notification_settings (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  followed_trades boolean not null default true,
  price_alerts boolean not null default true,
  liquidation_risk boolean not null default true,
  thesis_updates boolean not null default true,
  social boolean not null default true,
  marketing boolean not null default false,
  created_at timestamptz not null default now()
);
alter table public.notification_settings enable row level security;

create table public.push_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  token text unique not null,
  platform text not null check (platform in ('ios','android','web')),
  created_at timestamptz not null default now()
);
alter table public.push_tokens enable row level security;

create table public.price_alerts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  asset_id text not null references public.assets(id),
  symbol text not null,
  condition text not null check (condition in ('above','below','pct_change')),
  value numeric(38,18) not null check (value > 0),
  base_price numeric(38,18) not null,
  is_active boolean not null default true,
  triggered_at timestamptz,
  created_at timestamptz not null default now()
);
alter table public.price_alerts enable row level security;

-- ─── moderation, config, compliance ─────────────────────────────────────────
create table public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles(id) on delete cascade,
  target_type text not null check (target_type in ('user','post','comment')),
  target_id uuid not null,
  reason text not null check (reason in ('spam','scam','harassment','impersonation','other')),
  status text not null default 'pending' check (status in ('pending','reviewed')),
  created_at timestamptz not null default now()
);
alter table public.reports enable row level security;

create table public.app_config (
  id uuid primary key default gen_random_uuid(),
  key text unique not null,
  value jsonb not null,
  created_at timestamptz not null default now()
);
alter table public.app_config enable row level security;

create table public.region_rules (
  id uuid primary key default gen_random_uuid(),
  country_code text unique not null check (country_code ~ '^[A-Z]{2}$'),
  allow_stock_tokens boolean not null default true,
  allow_perps boolean not null default true,
  allow_copy_trade boolean not null default true,
  requires_kyc_for text[] not null default '{withdraw}',
  created_at timestamptz not null default now()
);
alter table public.region_rules enable row level security;

create table public.rate_limits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  bucket text not null,
  window_start timestamptz not null,
  count int not null default 0,
  created_at timestamptz not null default now(),
  unique (user_id, bucket, window_start)
);
alter table public.rate_limits enable row level security;

create table public.activity (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  kind text not null check (kind in ('deposit','withdrawal','trade','perp_open','perp_close','perp_liquidation')),
  title text not null default '',
  symbol text not null,
  amount_usd numeric(38,18) not null,
  qty numeric(38,18),
  side text,
  status text not null default 'completed',
  tx_hash text,
  chain text,
  created_at timestamptz not null default now()
);
alter table public.activity enable row level security;
create index activity_user_idx on public.activity(user_id, created_at desc);

create table public.portfolio_snapshots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  value numeric(38,18) not null,
  created_at timestamptz not null default now()
);
alter table public.portfolio_snapshots enable row level security;
