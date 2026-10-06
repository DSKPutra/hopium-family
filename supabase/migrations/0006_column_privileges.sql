-- Column-level privileges. RLS decides which rows a user may touch; these
-- grants decide which columns. Without them a user could update their own
-- profile to kyc_status = 'approved' or tier = 'legend', unhide a moderated
-- post, inflate like counts, or mark their own thesis as hit. Server-managed
-- columns are written only by security-definer triggers, RPCs and edge
-- functions (service role), which these grants don't restrict.

-- profiles: the row is created by the on_auth_user_created trigger.
drop policy if exists profiles_insert on public.profiles;
revoke insert, update on public.profiles from anon, authenticated;
grant update (
  username, display_name, avatar_url, bio, country_code, birth_year, interests,
  holdings_public, share_exact_amounts, language, theme, risk_accepted_at, onboarded_at
) on public.profiles to authenticated;

-- Region and age gate: adults only, and region/birth year can't be changed
-- after onboarding to unlock features (support can still change them).
create or replace function public.guard_profile_update() returns trigger
language plpgsql set search_path = public as $$
begin
  if new.birth_year is not null
     and extract(year from now())::int - new.birth_year - 1 < 18 then
    raise exception 'hopium.family is only for adults 18+.' using errcode = '23514';
  end if;
  if current_user = 'authenticated' and old.onboarded_at is not null and (
    new.country_code is distinct from old.country_code
    or new.birth_year is distinct from old.birth_year
  ) then
    raise exception 'region and birth year are locked after onboarding' using errcode = '42501';
  end if;
  return new;
end $$;
drop trigger if exists profiles_guard on public.profiles;
create trigger profiles_guard before update on public.profiles
  for each row execute function public.guard_profile_update();

-- wallets are provisioned server-side.
drop policy if exists wallets_owner on public.wallets;
revoke insert, update, delete on public.wallets from anon, authenticated;
create policy wallets_owner_select on public.wallets for select to authenticated
  using (user_id = auth.uid());

-- follows: only the notify flag changes after creation.
revoke insert, update on public.follows from anon, authenticated;
grant insert (follower_id, followee_id, notify) on public.follows to authenticated;
-- (follower_id, followee_id are in the update grant for PostgREST upserts; RLS pins follower_id.)
grant update (follower_id, followee_id, notify) on public.follows to authenticated;

-- blocks: insert/delete only.
revoke insert, update on public.blocks from anon, authenticated;
grant insert (blocker_id, blocked_id) on public.blocks to authenticated;

-- theses: status and scoring are set by resolve-theses.
revoke insert, update on public.theses from anon, authenticated;
grant insert (
  author_id, asset_id, symbol, direction, entry_price, target_price,
  invalidation_price, timeframe_end, body, image_url
) on public.theses to authenticated;

-- posts: text posts only; counters and moderation flags are server-managed.
revoke insert, update on public.posts from anon, authenticated;
grant insert (author_id, kind, body) on public.posts to authenticated;
grant update (body) on public.posts to authenticated;

-- comments.
revoke insert, update on public.comments from anon, authenticated;
grant insert (post_id, author_id, body, parent_id) on public.comments to authenticated;
grant update (body) on public.comments to authenticated;

-- likes.
revoke insert, update on public.likes from anon, authenticated;
grant insert (post_id, user_id) on public.likes to authenticated;

-- notifications: users can only mark read.
revoke insert, update on public.notifications from anon, authenticated;
grant update (read_at) on public.notifications to authenticated;

-- price alerts: triggering is server-side.
revoke insert, update on public.price_alerts from anon, authenticated;
grant insert (user_id, asset_id, symbol, condition, value, base_price) on public.price_alerts to authenticated;
grant update (is_active) on public.price_alerts to authenticated;

-- reports: review status is for moderators.
revoke insert, update on public.reports from anon, authenticated;
grant insert (reporter_id, target_type, target_id, reason) on public.reports to authenticated;

-- notification settings and push tokens: owner-editable toggles only.
revoke insert, update on public.notification_settings from anon, authenticated;
grant insert (user_id, followed_trades, price_alerts, liquidation_risk, thesis_updates, social, marketing)
  on public.notification_settings to authenticated;
grant update (user_id, followed_trades, price_alerts, liquidation_risk, thesis_updates, social, marketing)
  on public.notification_settings to authenticated;
revoke insert, update on public.push_tokens from anon, authenticated;
grant insert (user_id, token, platform) on public.push_tokens to authenticated;
grant update (user_id, token, platform) on public.push_tokens to authenticated;

-- Service-only functions. Postgres grants EXECUTE to PUBLIC by default, so
-- revoking from anon/authenticated alone (0004, 0005) left them callable.
revoke execute on function public.hit_rate_limit(uuid, text, int) from public, anon, authenticated;
revoke execute on function public.invoke_edge(text) from public, anon, authenticated;
grant execute on function public.hit_rate_limit(uuid, text, int) to service_role;

-- Interacting with a post requires that neither side has blocked the other.
-- The check must bypass RLS: a blocked user can't see the post, so a plain
-- `not exists (select … from posts …)` in the policy was vacuously true.
create or replace function public.can_interact_with_post(p_post uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.posts p
    where p.id = p_post and not p.is_hidden and not public.is_blocked(auth.uid(), p.author_id)
  );
$$;

drop policy if exists comments_insert on public.comments;
create policy comments_insert on public.comments for insert to authenticated
  with check (author_id = auth.uid() and public.can_interact_with_post(post_id));

drop policy if exists likes_insert on public.likes;
create policy likes_insert on public.likes for insert to authenticated
  with check (user_id = auth.uid() and public.can_interact_with_post(post_id));
