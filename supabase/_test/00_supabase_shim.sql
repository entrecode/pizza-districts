-- Minimal stand-in for the Supabase-managed bits our migrations and
-- pgTAP tests rely on. Local dev and CI run against a vanilla Postgres
-- container, so we recreate just enough surface for migrations to
-- apply and RLS policies to behave like production.
--
-- Hosted Supabase already provides all of this. Never apply this file
-- against a Supabase project — it would clobber the real auth schema.

create extension if not exists pgcrypto;
create extension if not exists pgtap;

-- Roles. service_role gets BYPASSRLS to mirror the hosted JWT flow
-- where service-role tokens skip RLS entirely. authenticated/anon
-- intentionally do not.
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin noinherit;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin noinherit;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then
    create role service_role nologin noinherit bypassrls;
  end if;
end
$$;

-- Mirror Supabase's default-grant behaviour on the public schema so
-- the migrations have something meaningful to revoke. Without these
-- the `revoke all from anon, authenticated` lines in 0002/0003 would
-- be no-ops and the RLS tests wouldn't reflect production grants.
grant usage on schema public to anon, authenticated, service_role;
alter default privileges in schema public
  grant select, insert, update, delete, truncate, references, trigger
  on tables to anon, authenticated, service_role;

-- auth schema with just enough for foreign keys + auth.uid().
create schema if not exists auth;
grant usage on schema auth to anon, authenticated, service_role;

create table if not exists auth.users (
  id uuid primary key default gen_random_uuid(),
  email text,
  created_at timestamptz not null default now()
);

-- auth.uid() resolves the JWT-claim sub, both via the legacy single
-- claim setting and the modern claims-blob form. Tests use
-- `set local "request.jwt.claim.sub" = '<uuid>'` to impersonate.
create or replace function auth.uid()
returns uuid
language sql
stable
as $$
  select coalesce(
    nullif(current_setting('request.jwt.claim.sub', true), ''),
    nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub'
  )::uuid;
$$;

grant execute on function auth.uid() to anon, authenticated, service_role;
