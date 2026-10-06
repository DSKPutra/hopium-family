-- RLS and column-privilege assertions, run by scripts/test-db.sh against the
-- migrated + seeded database. Everything runs in one transaction that is
-- rolled back. Any failed assertion raises and stops the run.
\set ON_ERROR_STOP 1
\set QUIET 1
-- Results go nowhere; each assertion reports through a NOTICE.
\o /dev/null
begin;

-- ─── helpers (run as the current role) ──────────────────────────────────────
create function pg_temp.ok(label text) returns void language plpgsql as $$
begin raise notice '%', 'ok  ' || label; end $$;

create function pg_temp.expect_error(stmt text, code text, label text) returns void
language plpgsql as $$
begin
  begin
    execute stmt;
  exception when others then
    if sqlstate = code then perform pg_temp.ok(label); return; end if;
    raise exception 'FAIL %: expected SQLSTATE %, got % (%)', label, code, sqlstate, sqlerrm;
  end;
  raise exception 'FAIL %: expected SQLSTATE %, but the statement succeeded', label, code;
end $$;

create function pg_temp.expect_count(query text, expected bigint, label text) returns void
language plpgsql as $$
declare n bigint;
begin
  execute format('select count(*) from (%s) q', query) into n;
  if n is distinct from expected then
    raise exception 'FAIL %: expected % rows, got %', label, expected, n;
  end if;
  perform pg_temp.ok(label);
end $$;

create function pg_temp.expect_affected(stmt text, expected bigint, label text) returns void
language plpgsql as $$
declare n bigint;
begin
  execute stmt;
  get diagnostics n = row_count;
  if n is distinct from expected then
    raise exception 'FAIL %: expected % affected rows, got %', label, expected, n;
  end if;
  perform pg_temp.ok(label);
end $$;

-- ─── fixtures (superuser) ───────────────────────────────────────────────────
select id as a from public.profiles where username = 'satoshi_sis' \gset
select id as b from public.profiles where username = 'moonmaxi' \gset
select id as b_post from public.posts where author_id = :'b' and not is_hidden limit 1 \gset
select id as a_post from public.posts where author_id = :'a' and not is_hidden limit 1 \gset
insert into public.notifications (user_id, type, title, body) values (:'b', 'test', 't', 'b');

do $$
declare missing text;
begin
  select string_agg(c.relname, ', ') into missing
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity;
  if missing is not null then raise exception 'FAIL RLS disabled on: %', missing; end if;
  perform pg_temp.ok('RLS enabled on every public table');
end $$;

-- ─── anon ──────────────────────────────────────────────────────────────────
set local role anon;
select pg_temp.expect_count('select 1 from public.profiles', 0, 'anon cannot read profiles');
select pg_temp.expect_count('select 1 from public.trades', 0, 'anon cannot read trades');
do $$
begin
  if (select count(*) from public.assets) = 0 then raise exception 'FAIL anon reads assets'; end if;
  perform pg_temp.ok('anon can read the asset catalog');
end $$;
reset role;

-- ─── authenticated as A ─────────────────────────────────────────────────────
set local role authenticated;
select set_config('request.jwt.claim.sub', :'a', true);

-- Profiles: presentation fields only.
select pg_temp.expect_affected(
  format('update public.profiles set display_name = %L where id = %L', 'Sis', :'a'),
  1, 'user edits own display name');
select pg_temp.expect_affected(
  format('update public.profiles set display_name = %L where id = %L', 'pwned', :'b'),
  0, 'user cannot edit another profile');
select pg_temp.expect_error(
  format('update public.profiles set kyc_status = %L where id = %L', 'approved', :'a'),
  '42501', 'user cannot self-approve KYC');
select pg_temp.expect_error(
  format('update public.profiles set tier = %L where id = %L', 'legend', :'a'),
  '42501', 'user cannot set own tier');
select pg_temp.expect_error(
  format('update public.profiles set country_code = %L where id = %L', 'ID', :'a'),
  '42501', 'region is locked after onboarding');
select pg_temp.expect_error(
  format('update public.profiles set birth_year = %s where id = %L',
    extract(year from now())::int - 15, :'a'),
  '23514', 'under-18 birth year is rejected');
select pg_temp.expect_error(
  format('insert into public.profiles (id, username) values (gen_random_uuid(), %L)', 'sneaky'),
  '42501', 'user cannot insert profiles');

-- Money tables are written only by edge functions.
select pg_temp.expect_error(
  format($q$insert into public.orders (user_id, asset_id, class, side, amount_in, slippage_bps, status)
    values (%L, 'btc', 'crypto', 'buy', 10, 100, 'filled')$q$, :'a'),
  '42501', 'user cannot insert orders');
select pg_temp.expect_error(
  format($q$insert into public.wallets (user_id, chain, address) values (%L, 'solana', 'x')$q$, :'a'),
  '42501', 'user cannot insert wallets');
select pg_temp.expect_count(
  format('select 1 from public.orders where user_id = %L', :'b'), 0, 'user cannot read others'' orders');
select pg_temp.expect_count(
  format('select 1 from public.notifications where user_id = %L', :'b'), 0,
  'user cannot read others'' notifications');
select pg_temp.expect_count(
  format('select 1 from public.holdings where user_id = %L', :'b'), 0,
  'private holdings are hidden from others');
select pg_temp.expect_error('select public.hit_rate_limit(auth.uid(), ''x'', 1)', '42501',
  'user cannot call the rate-limit RPC');
select pg_temp.expect_error('select public.invoke_edge(''resolve-theses'')', '42501',
  'user cannot invoke edge functions via SQL');

-- Social: counters and moderation flags are server-managed.
select pg_temp.expect_error(
  format($q$insert into public.posts (author_id, kind, body, like_count) values (%L, 'text', 'gm', 999)$q$, :'a'),
  '42501', 'user cannot set like_count on insert');
select pg_temp.expect_error(
  format($q$insert into public.posts (author_id, kind, body) values (%L, 'trade', 'fake')$q$, :'a'),
  '42501', 'user cannot insert non-text posts');
select pg_temp.expect_affected(
  format($q$insert into public.posts (author_id, kind, body) values (%L, 'text', 'gm fam')$q$, :'a'),
  1, 'user creates a text post');
select pg_temp.expect_error(
  format('update public.posts set is_hidden = false where author_id = %L', :'a'),
  '42501', 'user cannot unhide moderated posts');
select pg_temp.expect_error(
  format($q$insert into public.theses (author_id, asset_id, symbol, direction, entry_price,
    target_price, invalidation_price, timeframe_end, body, status)
    values (%L, 'btc', 'BTC', 'long', 100, 120, 90, now() + interval '1 day', 'trust me bro', 'hit')$q$, :'a'),
  '42501', 'user cannot mark a thesis as hit');
select pg_temp.expect_error(
  format($q$insert into public.reports (reporter_id, target_type, target_id, reason, status)
    values (%L, 'user', %L, 'spam', 'reviewed')$q$, :'a', :'b'),
  '42501', 'user cannot pre-review a report');

-- Notifications: only read_at is writable.
reset role;
select id as b_notif from public.notifications where user_id = :'b' limit 1 \gset
set local role authenticated;
select set_config('request.jwt.claim.sub', :'b', true);
select pg_temp.expect_affected(
  format('update public.notifications set read_at = now() where id = %L', :'b_notif'),
  1, 'user marks own notification read');
select pg_temp.expect_error(
  format('update public.notifications set title = %L where id = %L', 'x', :'b_notif'),
  '42501', 'user cannot rewrite notification content');
select set_config('request.jwt.claim.sub', :'a', true);
select pg_temp.expect_affected(
  format('update public.notifications set read_at = now() where id = %L', :'b_notif'),
  0, 'user cannot touch others'' notifications');

-- Likes: counted exactly once by the security-definer trigger.
reset role;
select like_count as like_before from public.posts where id = :'b_post' \gset
set local role authenticated;
select set_config('request.jwt.claim.sub', :'a', true);
insert into public.likes (post_id, user_id) values (:'b_post', :'a') on conflict do nothing;
insert into public.likes (post_id, user_id) values (:'b_post', :'a') on conflict do nothing;
select pg_temp.expect_count(
  format('select 1 from public.posts where id = %L and like_count = %s', :'b_post', :like_before + 1),
  1, 'double like increments like_count once');
select pg_temp.expect_error(
  format($q$insert into public.likes (post_id, user_id) values (%L, %L)$q$, :'b_post', :'b'),
  '42501', 'user cannot like on someone else''s behalf');

-- Blocking hides both sides from each other.
insert into public.blocks (blocker_id, blocked_id) values (:'a', :'b');
select pg_temp.expect_count(
  format('select 1 from public.posts where author_id = %L', :'b'), 0, 'blocker no longer sees blocked user''s posts');
select pg_temp.expect_count(
  format('select 1 from public.profiles where id = %L', :'b'), 0, 'blocker no longer sees blocked profile');
select set_config('request.jwt.claim.sub', :'b', true);
select pg_temp.expect_count(
  format('select 1 from public.profiles where id = %L', :'a'), 0, 'blocked user no longer sees blocker');
select pg_temp.expect_error(
  format($q$insert into public.follows (follower_id, followee_id) values (%L, %L)$q$, :'b', :'a'),
  '42501', 'blocked user cannot follow the blocker');
select pg_temp.expect_error(
  format($q$insert into public.comments (post_id, author_id, body) values (%L, %L, 'hi')$q$, :'a_post', :'b'),
  '42501', 'blocked user cannot comment on blocker''s posts');
select pg_temp.expect_error(
  format($q$insert into public.likes (post_id, user_id) values (%L, %L)$q$, :'a_post', :'b'),
  '42501', 'blocked user cannot like blocker''s posts');
reset role;

rollback;
