-- Row Level Security policies. Service-role (edge functions) bypasses RLS.

-- profiles: readable by authenticated users unless blocked; update own only.
create policy profiles_select on public.profiles for select to authenticated
  using (id = auth.uid() or not public.is_blocked(auth.uid(), id));
create policy profiles_insert on public.profiles for insert to authenticated with check (id = auth.uid());
create policy profiles_update on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

-- follows: visible to authenticated; manage own.
create policy follows_select on public.follows for select to authenticated using (true);
create policy follows_insert on public.follows for insert to authenticated
  with check (follower_id = auth.uid() and not public.is_blocked(follower_id, followee_id));
create policy follows_update on public.follows for update to authenticated using (follower_id = auth.uid());
create policy follows_delete on public.follows for delete to authenticated using (follower_id = auth.uid());

-- blocks: owner only.
create policy blocks_all on public.blocks for all to authenticated
  using (blocker_id = auth.uid()) with check (blocker_id = auth.uid());

-- wallets, orders, notifications, price alerts, settings, push tokens,
-- activity, snapshots, rate limits: owner only.
create policy wallets_owner on public.wallets for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy orders_owner_select on public.orders for select to authenticated using (user_id = auth.uid());
create policy notifications_owner on public.notifications for select to authenticated using (user_id = auth.uid());
create policy notifications_owner_update on public.notifications for update to authenticated using (user_id = auth.uid());
create policy notifications_owner_delete on public.notifications for delete to authenticated using (user_id = auth.uid());
create policy price_alerts_owner on public.price_alerts for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy notification_settings_owner on public.notification_settings for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy push_tokens_owner on public.push_tokens for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy activity_owner on public.activity for select to authenticated using (user_id = auth.uid());
create policy snapshots_owner on public.portfolio_snapshots for select to authenticated using (user_id = auth.uid());
create policy rate_limits_none on public.rate_limits for select to authenticated using (false);

-- perp positions: owner only.
create policy perp_positions_owner on public.perp_positions for select to authenticated using (user_id = auth.uid());

-- trades: own always; others only when public and not blocked.
create policy trades_select on public.trades for select to authenticated
  using (user_id = auth.uid() or (is_public and not public.is_blocked(auth.uid(), user_id)));

-- holdings: own always; others when holder keeps holdings public and not blocked.
create policy holdings_select on public.holdings for select to authenticated
  using (
    user_id = auth.uid() or (
      not public.is_blocked(auth.uid(), user_id)
      and exists (select 1 from public.profiles p where p.id = user_id and p.holdings_public)
    )
  );

-- theses: readable unless blocked; insert/update/delete own.
create policy theses_select on public.theses for select to authenticated using (not public.is_blocked(auth.uid(), author_id));
create policy theses_insert on public.theses for insert to authenticated with check (author_id = auth.uid());
create policy theses_delete on public.theses for delete to authenticated using (author_id = auth.uid());

-- posts & comments: readable by non-blocked authenticated users; write own.
create policy posts_select on public.posts for select to authenticated
  using ((not is_hidden or author_id = auth.uid()) and not public.is_blocked(auth.uid(), author_id));
create policy posts_insert on public.posts for insert to authenticated with check (author_id = auth.uid() and kind = 'text');
create policy posts_update on public.posts for update to authenticated using (author_id = auth.uid());
create policy posts_delete on public.posts for delete to authenticated using (author_id = auth.uid());

create policy comments_select on public.comments for select to authenticated using (not public.is_blocked(auth.uid(), author_id));
create policy comments_insert on public.comments for insert to authenticated
  with check (
    author_id = auth.uid()
    and not exists (select 1 from public.posts p where p.id = post_id and public.is_blocked(auth.uid(), p.author_id))
  );
create policy comments_update on public.comments for update to authenticated using (author_id = auth.uid());
create policy comments_delete on public.comments for delete to authenticated using (author_id = auth.uid());

create policy likes_select on public.likes for select to authenticated using (true);
create policy likes_insert on public.likes for insert to authenticated with check (user_id = auth.uid());
create policy likes_delete on public.likes for delete to authenticated using (user_id = auth.uid());

-- reports: insert own, read own.
create policy reports_insert on public.reports for insert to authenticated with check (reporter_id = auth.uid());
create policy reports_select on public.reports for select to authenticated using (reporter_id = auth.uid());

-- public catalogs / config.
create policy assets_read on public.assets for select using (true);
create policy badges_read on public.badges for select using (true);
create policy user_badges_read on public.user_badges for select to authenticated using (true);
create policy leaderboard_read on public.leaderboard_snapshots for select to authenticated
  using (not public.is_blocked(auth.uid(), user_id));
create policy app_config_read on public.app_config for select using (true);
create policy region_rules_read on public.region_rules for select using (true);
