-- ADR-0002 §Migration plan step 1: extensions + helper schemas.
--
-- Introduces:
--   * pgcrypto in public (for gen_random_uuid / gen_random_bytes)
--   * schema `private` — service-role-only admin/raw-POI tables; defaults
--     locked down so a missing GRANT can never accidentally expose data.
--   * schema `app` — helper functions used by RLS policies and triggers.

create extension if not exists pgcrypto with schema public;

create schema if not exists private;
create schema if not exists app;

-- `private` is service-role only. Revoke the default PUBLIC grants and
-- block future objects from inheriting any anon/authenticated access.
revoke all on schema private from public;
revoke all on all tables in schema private from public, anon, authenticated;
revoke all on all sequences in schema private from public, anon, authenticated;
revoke all on all functions in schema private from public, anon, authenticated;

alter default privileges in schema private revoke all on tables from public, anon, authenticated;
alter default privileges in schema private revoke all on sequences from public, anon, authenticated;
alter default privileges in schema private revoke all on functions from public, anon, authenticated;

grant usage on schema private to service_role;
alter default privileges in schema private grant all on tables to service_role;
alter default privileges in schema private grant all on sequences to service_role;
alter default privileges in schema private grant execute on functions to service_role;

-- `app` holds helper functions only. Tables never live here. Authenticated
-- callers need USAGE so RLS policies that call app.is_save_owner work.
revoke all on schema app from public;
grant usage on schema app to authenticated, service_role;

comment on schema private is 'Service-role-only tables (admin, raw POI). Not exposed via PostgREST.';
comment on schema app is 'Helper functions used by RLS policies and triggers. Not exposed via PostgREST.';
