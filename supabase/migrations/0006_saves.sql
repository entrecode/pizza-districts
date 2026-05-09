-- ADR-0002 §Migration plan step 6 + PIZ-25 acceptance: public.saves.
--
-- Column shape comes from PIZ-25 acceptance + ADR-0003 §2/§4.2:
--   * id is server-generated; rng_seed is server-generated and pinned
--     for life of the save (= brand_seed).
--   * current_tick is monotonic and equals formula sheet day_index.
--   * engine_version is rewritten by runTick on every advance.
--   * brand_id is intentionally unconstrained at the FK level: the
--     brands table is not yet ticketed for engine v0. Column stays
--     NOT NULL so a save without a brand cannot exist; FK is added
--     when public.brands lands (separate Phase 2 ticket).
--   * created_at/updated_at with trigger so the harness and admin UI
--     can sort and audit save activity.

create table public.saves (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  brand_id uuid not null,
  rng_seed bigint not null,
  current_tick integer not null default 0,
  engine_version text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint saves_current_tick_nonneg check (current_tick >= 0),
  constraint saves_engine_version_nonempty check (length(engine_version) > 0)
);

create index saves_user_id_idx on public.saves (user_id);

create trigger saves_set_updated_at
before update on public.saves
for each row
execute function app.set_updated_at();

comment on table public.saves is
  'One tycoon run per row. RNG seed pinned at creation; current_tick is the only mutable simulation cursor. ADR-0003 §2.';
comment on column public.saves.brand_id is
  'FK to public.brands once that table exists. v0 keeps the column NOT NULL but unconstrained at the SQL level.';
comment on column public.saves.rng_seed is
  'brand_seed per ADR-0003 §4.2. Server-generated, never client-supplied, immutable for the life of the save.';
comment on column public.saves.current_tick is
  'Monotonic day_index. Advanced only by service-role RPC sim_commit_ticks (ADR-0003 §5.2).';
comment on column public.saves.engine_version is
  'Engine semver written by runTick on every advance. Determinism harness uses this to flag drift.';

-- RLS: enabled + forced. service_role bypasses via BYPASSRLS, so FORCE
-- only matters for the postgres role and any other table-owner-style
-- caller — defense in depth.
alter table public.saves enable row level security;
alter table public.saves force row level security;

-- Supabase's `public` schema default privileges grant full DML to
-- anon/authenticated/service_role on every new table. Revoke first,
-- then grant only what each role actually needs. RLS policies layer
-- on top of these grants — both must allow the operation.
revoke all on public.saves from public, anon, authenticated, service_role;
grant select, update on public.saves to authenticated;
grant select, insert, update, delete on public.saves to service_role;

-- Authenticated callers can read and update only their own saves.
-- INSERT and DELETE are deliberately not granted: onboarding inserts
-- the row via the service-role Edge Function; soft-end happens via an
-- UPDATE to status (added when status lands).
create policy saves_owner_select
  on public.saves
  for select
  to authenticated
  using (user_id = auth.uid());

create policy saves_owner_update
  on public.saves
  for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- service_role gets a permissive policy for completeness even though
-- BYPASSRLS makes it unnecessary at runtime — keeps the policy list
-- self-documenting.
create policy saves_service_role_all
  on public.saves
  for all
  to service_role
  using (true)
  with check (true);
