-- RPCs used by the app (all security invoker unless noted, so RLS applies).

create or replace function public.username_available(p_username text) returns boolean
language sql stable security definer set search_path = public as $$
  select p_username ~ '^[a-z0-9_]{3,20}$'
    and lower(p_username) not in ('admin','hopium','support','root','system','official','help','moderator','deleted')
    and not exists (select 1 from public.profiles where username = p_username and id <> auth.uid());
$$;

-- Posts from followees (plus own), excluding blocked, hidden, and private trades.
create or replace function public.feed_following(p_user uuid, p_cursor timestamptz, p_limit int)
returns table (id uuid, author_id uuid, kind text, trade_id uuid, thesis_id uuid, body text, milestone jsonb,
  like_count int, comment_count int, is_hidden boolean, created_at timestamptz, cursor timestamptz,
  author jsonb, trade jsonb, thesis jsonb)
language sql stable set search_path = public as $$
  select p.id, p.author_id, p.kind, p.trade_id, p.thesis_id, p.body, p.milestone, p.like_count, p.comment_count, p.is_hidden,
    p.created_at, p.created_at as cursor, to_jsonb(a), to_jsonb(t), to_jsonb(th)
  from public.posts p
  join public.profiles a on a.id = p.author_id
  left join public.trades t on t.id = p.trade_id
  left join public.theses th on th.id = p.thesis_id
  where (p.author_id = p_user or p.author_id in (select followee_id from public.follows where follower_id = p_user))
    and not p.is_hidden
    and not public.is_blocked(p_user, p.author_id)
    and (p.trade_id is null or t.is_public)
    and (p_cursor is null or p.created_at < p_cursor)
  order by p.created_at desc
  limit least(greatest(p_limit, 1), 50);
$$;

-- Ranked by engagement velocity over the last 24h (cursor = offset as timestamp surrogate).
create or replace function public.feed_trending(p_user uuid, p_cursor text, p_limit int)
returns table (id uuid, author_id uuid, kind text, trade_id uuid, thesis_id uuid, body text, milestone jsonb,
  like_count int, comment_count int, is_hidden boolean, created_at timestamptz, cursor text,
  author jsonb, trade jsonb, thesis jsonb)
language sql stable set search_path = public as $$
  with ranked as (
    select p.*, (p.like_count + 2 * p.comment_count + 1) / power(extract(epoch from now() - p.created_at) / 3600 + 2, 1.5) as score
    from public.posts p
    left join public.trades t on t.id = p.trade_id
    where p.created_at > now() - interval '24 hours' and not p.is_hidden
      and not public.is_blocked(p_user, p.author_id) and (p.trade_id is null or t.is_public)
  ), numbered as (select r.*, row_number() over (order by score desc) as rn from ranked r)
  select n.id, n.author_id, n.kind, n.trade_id, n.thesis_id, n.body, n.milestone, n.like_count, n.comment_count, n.is_hidden,
    n.created_at, n.rn::text, to_jsonb(a), to_jsonb(t), to_jsonb(th)
  from numbered n
  join public.profiles a on a.id = n.author_id
  left join public.trades t on t.id = n.trade_id
  left join public.theses th on th.id = n.thesis_id
  where n.rn > coalesce(nullif(p_cursor, '')::int, 0)
  order by n.rn
  limit least(greatest(p_limit, 1), 50);
$$;

create or replace function public.feed_theses(p_user uuid, p_cursor timestamptz, p_limit int)
returns table (id uuid, author_id uuid, kind text, trade_id uuid, thesis_id uuid, body text, milestone jsonb,
  like_count int, comment_count int, is_hidden boolean, created_at timestamptz, cursor timestamptz,
  author jsonb, trade jsonb, thesis jsonb)
language sql stable set search_path = public as $$
  select p.id, p.author_id, p.kind, p.trade_id, p.thesis_id, p.body, p.milestone, p.like_count, p.comment_count, p.is_hidden,
    p.created_at, p.created_at, to_jsonb(a), null::jsonb, to_jsonb(th)
  from public.posts p
  join public.profiles a on a.id = p.author_id
  join public.theses th on th.id = p.thesis_id
  where p.kind = 'thesis' and not p.is_hidden and not public.is_blocked(p_user, p.author_id)
    and (p_cursor is null or p.created_at < p_cursor)
  order by p.created_at desc
  limit least(greatest(p_limit, 1), 50);
$$;

create or replace function public.user_stats(p_username text)
returns table (pnl_pct numeric, win_rate numeric, thesis_accuracy numeric, followers int, following int, copiers int,
  trades_count int, volume_usd numeric)
language sql stable set search_path = public as $$
  with u as (select id from public.profiles where username = p_username),
  t as (select * from public.trades where user_id = (select id from u)),
  sells as (select * from t where side = 'sell'),
  th as (select * from public.theses where author_id = (select id from u) and status <> 'active')
  select
    coalesce((select sum(realized_pnl) / nullif(sum(notional - realized_pnl), 0) * 100 from sells), 0),
    coalesce((select count(*) filter (where realized_pnl > 0)::numeric / nullif(count(*), 0) * 100 from sells), 0),
    coalesce((select count(*) filter (where status = 'hit')::numeric / nullif(count(*), 0) * 100 from th), 0),
    (select count(*)::int from public.follows where followee_id = (select id from u)),
    (select count(*)::int from public.follows where follower_id = (select id from u)),
    coalesce((select sum(copiers)::int from t), 0),
    (select count(*)::int from t),
    coalesce((select sum(notional) from t), 0);
$$;

create or replace function public.asset_holders_i_follow(p_user uuid, p_asset text)
returns setof public.profiles language sql stable set search_path = public as $$
  select p.* from public.profiles p
  join public.follows f on f.followee_id = p.id and f.follower_id = p_user
  join public.holdings h on h.user_id = p.id and h.asset_id = p_asset and h.qty > 0
  where p.holdings_public and not public.is_blocked(p_user, p.id);
$$;

create or replace function public.legends_buying(p_limit int)
returns table (post_id uuid, author jsonb, trade jsonb) language sql stable set search_path = public as $$
  select distinct on (a.id) p.id, to_jsonb(a), to_jsonb(t)
  from public.trades t
  join public.posts p on p.trade_id = t.id
  join public.profiles a on a.id = t.user_id
  where t.side = 'buy' and t.is_public and a.tier in ('degen','whale','legend')
    and not public.is_blocked(auth.uid(), a.id)
  order by a.id, t.created_at desc
  limit least(greatest(p_limit, 1), 30);
$$;

create or replace function public.activity_history(p_kind text)
returns setof public.activity language sql stable set search_path = public as $$
  select * from public.activity
  where user_id = auth.uid() and (p_kind = 'all' or kind = p_kind or (p_kind = 'perp_open' and kind like 'perp%'))
  order by created_at desc limit 200;
$$;

create or replace function public.portfolio_history(p_user uuid, p_range text)
returns table ("time" timestamptz, value numeric) language sql stable set search_path = public as $$
  select s.created_at, s.value from public.portfolio_snapshots s
  where s.user_id = p_user
    and (p_user = auth.uid() or exists (select 1 from public.profiles p where p.id = p_user and p.holdings_public))
    and s.created_at > now() - case p_range when '1D' then interval '1 day' when '1W' then interval '7 days'
      when '1M' then interval '30 days' else interval '10 years' end
  order by s.created_at;
$$;

-- Per-user rate limiting helper for edge functions (service role).
create or replace function public.hit_rate_limit(p_user uuid, p_bucket text, p_limit int) returns boolean
language plpgsql security definer set search_path = public as $$
declare v_count int;
begin
  insert into public.rate_limits (user_id, bucket, window_start, count)
  values (p_user, p_bucket, date_trunc('minute', now()), 1)
  on conflict (user_id, bucket, window_start) do update set count = public.rate_limits.count + 1
  returning count into v_count;
  return v_count <= p_limit;
end $$;
revoke execute on function public.hit_rate_limit from anon, authenticated;
