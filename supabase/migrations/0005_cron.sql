-- Scheduled edge functions (pg_cron + pg_net). Configure once per project:
--   select vault.create_secret('<project-url>', 'project_url');
--   select vault.create_secret('<service-role-key>', 'service_role_key');
create extension if not exists pg_cron;
create extension if not exists pg_net;

create or replace function public.invoke_edge(fn text) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_url text := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url');
  v_key text := (select decrypted_secret from vault.decrypted_secrets where name = 'service_role_key');
begin
  if v_url is null or v_key is null then return; end if;
  perform net.http_post(url := v_url || '/functions/v1/' || fn, headers := jsonb_build_object('Authorization', 'Bearer ' || v_key, 'Content-Type', 'application/json'), body := '{}'::jsonb);
end $$;
revoke execute on function public.invoke_edge from anon, authenticated;

select cron.schedule('resolve-theses', '*/5 * * * *', $$select public.invoke_edge('resolve-theses')$$);
select cron.schedule('compute-leaderboards', '0 * * * *', $$select public.invoke_edge('compute-leaderboards')$$);
select cron.schedule('check-price-alerts', '* * * * *', $$select public.invoke_edge('check-price-alerts')$$);
select cron.schedule('liquidation-watch', '* * * * *', $$select public.invoke_edge('liquidation-watch')$$);
