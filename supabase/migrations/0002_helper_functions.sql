-- ADR-0002 §Migration plan step 2: app helper functions.
--
-- Two helpers used across per-save tables:
--   * app.is_save_owner(uuid) — RLS predicate that resolves ownership
--     through the saves.user_id chain. SECURITY DEFINER + locked
--     search_path so it can read public.saves regardless of caller
--     grants. The body references public.saves which is created later
--     in 0006_saves.sql, so we disable check_function_bodies for the
--     CREATE; the function is fully validated at first call.
--   * app.set_updated_at() — generic BEFORE UPDATE trigger that bumps
--     updated_at to now(). Reused by saves and any future table that
--     opts in.

set check_function_bodies = off;

create or replace function app.is_save_owner(s uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.saves
    where id = s
      and user_id = auth.uid()
  );
$$;

revoke all on function app.is_save_owner(uuid) from public;
grant execute on function app.is_save_owner(uuid) to authenticated, service_role;

comment on function app.is_save_owner(uuid) is
  'Returns true when auth.uid() owns the given save. Used by RLS policies on per-save child tables.';

create or replace function app.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

revoke all on function app.set_updated_at() from public;
-- Triggers run with the privileges of the role executing the
-- triggering statement, so authenticated needs EXECUTE here for the
-- saves.updated_at trigger to fire on player-initiated UPDATEs.
grant execute on function app.set_updated_at() to authenticated, service_role;

comment on function app.set_updated_at() is
  'BEFORE UPDATE trigger that bumps updated_at to now().';
