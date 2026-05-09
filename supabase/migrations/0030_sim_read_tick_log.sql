-- PIZ-23 acceptance: test-only RPC for the determinism harness.
--
-- The harness ([PIZ-9 §4](/PIZ/issues/PIZ-9#document-determinism-harness)) needs
-- to read committed tick_log rows for a save and compare them against a
-- fresh replay() chain. Direct SELECT on public.tick_log is denied to
-- harness_test (foundational test in 0020_harness_test_role.test.sql),
-- so the harness reaches the table through this SECURITY DEFINER RPC.
--
-- Why test-only and not part of the runtime RPC surface:
--   * The runtime never replays history — only the harness does.
--   * Returning tick_log rows for a foreign save would be a privacy
--     leak through the runtime path; gating the function to a NOLOGIN
--     test role keeps the leak surface inside the test runner.
--
-- Authorization:
--   * SECURITY DEFINER + owner-locked, so it executes with the
--     definer's privileges and the EXECUTE grant is the only access
--     gate. EXECUTE is granted to harness_test only; revoked from
--     public/anon/authenticated/service_role.
--   * harness_test is NOLOGIN/NOINHERIT (per 0020_harness_test_role.sql),
--     so production app paths cannot reach this function — only the
--     test runner with `SET ROLE harness_test` from a privileged
--     connection.
--
-- Determinism contract:
--   * save_id is the only filter inside the function body; there is no
--     `select * from tick_log` wildcard path that could leak across saves.
--   * Rows are returned ordered ascending by tick_index so the harness
--     can fold the chain without an extra sort.
--   * Returns a stable composite type so the TS harness imports the row
--     shape from packages/schema/sim-rpc.d.ts instead of hand-rolling it.
--
-- tick_hash encoding:
--   * Stored as bytea (raw 32 bytes) per 0010_tick_log.sql.
--   * Returned as a 64-character lowercase hex string to match the
--     SimCommitTicksRow.tick_hash convention in packages/schema/sim-rpc.d.ts
--     — keeps both sides of the chain (commit + read) on the same
--     wire-format string, which the JS-side harness can compare with
--     `===` instead of byte-array helpers.

create type public.sim_tick_log_row as (
  tick_index integer,
  tick_hash text,
  events_jsonb jsonb,
  engine_version text
);

comment on type public.sim_tick_log_row is
  'Return row for public.sim_read_tick_log. tick_hash is lowercase hex (64 chars = 32 bytes).';

create or replace function public.sim_read_tick_log(
  save_id uuid,
  from_tick integer,
  to_tick integer
)
returns setof public.sim_tick_log_row
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    t.tick_index,
    encode(t.tick_hash, 'hex') as tick_hash,
    t.events_jsonb,
    t.engine_version
  from public.tick_log as t
  where t.save_id = sim_read_tick_log.save_id
    and t.tick_index between sim_read_tick_log.from_tick
                         and sim_read_tick_log.to_tick
  order by t.tick_index asc;
$$;

revoke all on function public.sim_read_tick_log(uuid, integer, integer) from public;
revoke all on function public.sim_read_tick_log(uuid, integer, integer) from anon;
revoke all on function public.sim_read_tick_log(uuid, integer, integer) from authenticated;
revoke all on function public.sim_read_tick_log(uuid, integer, integer) from service_role;

grant execute on function public.sim_read_tick_log(uuid, integer, integer) to harness_test;

comment on function public.sim_read_tick_log(uuid, integer, integer) is
  'Test-only RPC for the determinism harness (PIZ-23). Returns ordered tick_log rows for a single save. SECURITY DEFINER bypasses the per-save SELECT policy on tick_log so synthetic test fixtures spanning multiple saves can be replayed. EXECUTE granted to harness_test only — production app roles MUST NOT be granted.';
