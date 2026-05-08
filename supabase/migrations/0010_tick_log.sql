-- ADR-0003 §4.3 + PIZ-25 acceptance: append-only per-tick determinism log.
--
-- Each row stores a 32-byte hash of (prev_hash || canonical events ||
-- canonical state delta), the canonical event log, and the engine
-- version that produced it. The PIZ-9 / PIZ-23 harness replays from a
-- snapshot and asserts the produced tick_hash chain matches what is
-- stored.
--
-- Append-only contract: only service_role gets INSERT. UPDATE/DELETE
-- are denied to every role via missing grants and missing policies,
-- so even an accidental service-role mutation can't rewrite history.
-- The PIZ-23 harness reaches this table only through a SECURITY
-- DEFINER RPC, never via direct grants.

create table public.tick_log (
  save_id uuid not null references public.saves(id) on delete cascade,
  tick_index integer not null,
  tick_hash bytea not null,
  events_jsonb jsonb not null,
  engine_version text not null,
  created_at timestamptz not null default now(),
  constraint tick_log_pkey primary key (save_id, tick_index),
  constraint tick_log_tick_index_nonneg check (tick_index >= 0),
  constraint tick_log_hash_is_32_bytes check (octet_length(tick_hash) = 32),
  constraint tick_log_engine_version_nonempty check (length(engine_version) > 0)
);

-- Latest-tick reads (resume / harness chain replay) hit
-- (save_id, tick_index DESC). The PK is ascending; this index backs
-- the descending lookup explicitly.
create index tick_log_save_tick_desc_idx
  on public.tick_log (save_id, tick_index desc);

comment on table public.tick_log is
  'Append-only per-tick determinism log. Hash chain per ADR-0003 §4.3.';
comment on column public.tick_log.tick_index is
  'saves.current_tick at the start of this tick (current_tick + i semantics from ADR-0003 §3).';
comment on column public.tick_log.tick_hash is
  '32-byte canonical hash of (prev_hash || canonical events || canonical state delta).';
comment on column public.tick_log.events_jsonb is
  'Canonical-key-order event log emitted during this tick.';
comment on column public.tick_log.engine_version is
  'Engine semver that produced this row. Determinism harness uses it to flag drift.';

alter table public.tick_log enable row level security;
alter table public.tick_log force row level security;

-- Lock down default Supabase grants. authenticated may only SELECT
-- (and even then, only their own rows via the policy below).
-- service_role gets SELECT + INSERT only — UPDATE/DELETE intentionally
-- absent so service_role itself cannot rewrite history.
revoke all on public.tick_log from public, anon, authenticated, service_role;
grant select on public.tick_log to authenticated;
grant select, insert on public.tick_log to service_role;

create policy tick_log_owner_select
  on public.tick_log
  for select
  to authenticated
  using (app.is_save_owner(save_id));

-- service_role policies: SELECT + INSERT only. BYPASSRLS makes the
-- SELECT policy redundant at runtime; we keep it explicit so the
-- policy list is self-documenting.
create policy tick_log_service_role_select
  on public.tick_log
  for select
  to service_role
  using (true);

create policy tick_log_service_role_insert
  on public.tick_log
  for insert
  to service_role
  with check (true);
