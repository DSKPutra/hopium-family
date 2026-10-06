-- Minimal stand-in for what a Supabase project provides, so the migrations,
-- seed and RLS tests run against plain PostgreSQL (CI, or a local install
-- without Docker). Not applied to real Supabase projects.

create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;

-- Supabase grants table privileges broadly and relies on RLS; mirror that so
-- the policies (and column grants) are what's actually being tested.
grant usage on schema public to anon, authenticated, service_role;
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
alter default privileges in schema public grant execute on functions to anon, authenticated, service_role;

create schema auth;
grant usage on schema auth to anon, authenticated, service_role;
create table auth.users (
  id uuid primary key default gen_random_uuid(),
  instance_id uuid,
  aud text,
  role text,
  email text,
  encrypted_password text,
  email_confirmed_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  raw_app_meta_data jsonb default '{}',
  raw_user_meta_data jsonb default '{}'
);
create function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;

-- pg_cron / pg_net / vault: just enough surface for 0005_cron.sql.
create schema cron;
create table cron.job (jobname text primary key, schedule text, command text);
create function cron.schedule(job_name text, schedule text, command text) returns bigint
language sql as $$
  insert into cron.job values (job_name, schedule, command)
  on conflict (jobname) do update set schedule = excluded.schedule, command = excluded.command;
  select 1::bigint;
$$;
create schema net;
create function net.http_post(url text, headers jsonb, body jsonb) returns bigint
language sql as $$ select 1::bigint $$;
create schema vault;
create table vault.decrypted_secrets (name text primary key, decrypted_secret text);

create publication supabase_realtime;
