-- Triggers: holdings materialization, auto-posts, fan-out, counters.

-- New auth user → profile + notification settings.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id) values (new.id) on conflict do nothing;
  insert into public.notification_settings (user_id) values (new.id) on conflict do nothing;
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- Trade insert → upsert holdings (weighted avg entry), public post, follower fan-out.
create or replace function public.on_trade_inserted() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_post_id uuid;
  v_username text;
  v_tier text;
begin
  if new.user_id is null then return new; end if;

  if new.side = 'buy' then
    insert into public.holdings (user_id, asset_id, qty, avg_entry)
    values (new.user_id, new.asset_id, new.qty, new.price)
    on conflict (user_id, asset_id) do update set
      avg_entry = case when public.holdings.qty + excluded.qty = 0 then 0
        else (public.holdings.qty * public.holdings.avg_entry + excluded.qty * excluded.avg_entry) / (public.holdings.qty + excluded.qty) end,
      qty = public.holdings.qty + excluded.qty,
      updated_at = now();
  else
    update public.holdings set qty = greatest(qty - new.qty, 0), updated_at = now()
    where user_id = new.user_id and asset_id = new.asset_id;
  end if;

  if new.is_public then
    insert into public.posts (author_id, kind, trade_id, created_at)
    values (new.user_id, 'trade', new.id, new.created_at) returning id into v_post_id;

    select username, tier into v_username, v_tier from public.profiles where id = new.user_id;
    insert into public.notifications (user_id, type, title, body, data)
    select f.follower_id, 'followed_trade', 'notifications.followedTrade.title',
      case when new.side = 'buy' then 'notifications.followedTrade.bodyBuy' else 'notifications.followedTrade.bodySell' end,
      jsonb_build_object('href', '/post/' || v_post_id, 'push', f.notify,
        'params', jsonb_build_object('username', v_username, 'symbol', new.symbol))
    from public.follows f
    join public.notification_settings s on s.user_id = f.follower_id and s.followed_trades
    where f.followee_id = new.user_id and (f.notify or v_tier in ('whale','legend'));
  end if;

  if new.copied_from_trade_id is not null then
    update public.trades set copiers = copiers + 1 where id = new.copied_from_trade_id;
  end if;
  return new;
end $$;
create trigger trades_after_insert after insert on public.trades
  for each row execute function public.on_trade_inserted();

-- Thesis insert → post.
create or replace function public.on_thesis_inserted() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.posts (author_id, kind, thesis_id, created_at) values (new.author_id, 'thesis', new.id, new.created_at);
  return new;
end $$;
create trigger theses_after_insert after insert on public.theses
  for each row execute function public.on_thesis_inserted();

-- Like/comment counters.
create or replace function public.on_like_changed() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    update public.posts set like_count = like_count + 1 where id = new.post_id;
  else
    update public.posts set like_count = greatest(like_count - 1, 0) where id = old.post_id;
  end if;
  return null;
end $$;
create trigger likes_counter after insert or delete on public.likes
  for each row execute function public.on_like_changed();

create or replace function public.on_comment_changed() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    update public.posts set comment_count = comment_count + 1 where id = new.post_id;
  else
    update public.posts set comment_count = greatest(comment_count - 1, 0) where id = old.post_id;
  end if;
  return null;
end $$;
create trigger comments_counter after insert or delete on public.comments
  for each row execute function public.on_comment_changed();

-- Auto-hide posts with 3+ pending reports until reviewed.
create or replace function public.on_report_inserted() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.target_type = 'post' and (
    select count(*) from public.reports where target_id = new.target_id and status = 'pending'
  ) >= 3 then
    update public.posts set is_hidden = true where id = new.target_id;
  end if;
  return new;
end $$;
create trigger reports_after_insert after insert on public.reports
  for each row execute function public.on_report_inserted();

-- Realtime publication for live feed/notifications.
alter publication supabase_realtime add table public.notifications, public.posts;
