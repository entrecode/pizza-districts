-- pgTAP: sim_read_tick_log RPC contract (PIZ-23 acceptance).
--
-- Coverage matrix (every line in PIZ-23's "Acceptance" + "Hardening tests"):
--   * Function exists with the agreed (uuid, integer, integer) signature
--     and returns SETOF public.sim_tick_log_row.
--   * SECURITY DEFINER + pinned search_path.
--   * EXECUTE grants: harness_test only. anon, authenticated and
--     service_role all lack EXECUTE.
--   * Anon cannot EXECUTE (insufficient_privilege at runtime).
--   * Authenticated player cannot EXECUTE (insufficient_privilege).
--   * harness_test:
--       - Returns rows ordered ascending by tick_index.
--       - Range filter excludes rows outside [from_tick, to_tick].
--       - Cross-save isolation: requesting save A never returns save B
--         rows (intentional read across saves is fine — but only the
--         requested save_id's rows).
--       - tick_hash is returned as 64-char lowercase hex.

begin;

create extension if not exists pgtap;

select * from no_plan();

-- Function shape ------------------------------------------------------

select has_function(
  'public', 'sim_read_tick_log', array['uuid', 'integer', 'integer'],
  'public.sim_read_tick_log(uuid, integer, integer) exists'
);

select is(
  (
    select prosecdef
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.proname = 'sim_read_tick_log'
  ),
  true,
  'sim_read_tick_log is SECURITY DEFINER'
);

select ok(
  exists (
    select 1
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace,
           unnest(p.proconfig) as cfg(s)
     where n.nspname = 'public'
       and p.proname = 'sim_read_tick_log'
       and cfg.s like 'search_path=%'
  ),
  'sim_read_tick_log pins search_path'
);

-- Return type is the test-tagged composite, not the table row. Keeps
-- the harness's TS shape stable even if engine schema columns drift.
select is(
  (
    select pg_catalog.format_type(p.prorettype, null)
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.proname = 'sim_read_tick_log'
  ),
  'SETOF sim_tick_log_row',
  'sim_read_tick_log returns SETOF public.sim_tick_log_row'
);

-- EXECUTE grants ------------------------------------------------------

select is(
  has_function_privilege(
    'harness_test', 'public.sim_read_tick_log(uuid, integer, integer)', 'EXECUTE'
  ),
  true,
  'harness_test has EXECUTE on sim_read_tick_log'
);

select is(
  has_function_privilege(
    'anon', 'public.sim_read_tick_log(uuid, integer, integer)', 'EXECUTE'
  ),
  false,
  'anon has no EXECUTE on sim_read_tick_log'
);

select is(
  has_function_privilege(
    'authenticated', 'public.sim_read_tick_log(uuid, integer, integer)', 'EXECUTE'
  ),
  false,
  'authenticated has no EXECUTE on sim_read_tick_log'
);

select is(
  has_function_privilege(
    'service_role', 'public.sim_read_tick_log(uuid, integer, integer)', 'EXECUTE'
  ),
  false,
  'service_role has no EXECUTE on sim_read_tick_log (test-tagged, not a runtime RPC)'
);

-- Runtime denial: anon cannot execute -------------------------------

set local role anon;

select throws_ok(
  $$select * from public.sim_read_tick_log(
      '00000000-0000-0000-0000-000000000001'::uuid, 0, 100
  )$$,
  '42501',
  null,
  'anon EXECUTE raises insufficient_privilege'
);

reset role;

-- Runtime denial: authenticated player cannot execute --------------

set local role authenticated;
set local "request.jwt.claim.sub" = '11111111-1111-1111-1111-111111111111';

select throws_ok(
  $$select * from public.sim_read_tick_log(
      '00000000-0000-0000-0000-000000000001'::uuid, 0, 100
  )$$,
  '42501',
  null,
  'authenticated EXECUTE raises insufficient_privilege'
);

reset role;
reset "request.jwt.claim.sub";

-- Fixtures: two synthetic saves with overlapping tick_index ranges --
--
-- Save B's tick rows use distinct hashes so the cross-save leak test
-- can detect any bleed-through from save B into a save A query.

insert into auth.users (id, email)
values
  ('aa000000-0000-0000-0000-000000000001', 'piz23-a@test.local'),
  ('aa000000-0000-0000-0000-000000000002', 'piz23-b@test.local')
on conflict (id) do nothing;

insert into public.saves (id, user_id, brand_id, rng_seed, current_tick, engine_version)
values
  (
    'a1111111-1111-1111-1111-111111111111',
    'aa000000-0000-0000-0000-000000000001',
    'b1111111-1111-1111-1111-111111111111',
    1,
    3,
    '0.0.0-test'
  ),
  (
    'a2222222-2222-2222-2222-222222222222',
    'aa000000-0000-0000-0000-000000000002',
    'b2222222-2222-2222-2222-222222222222',
    2,
    3,
    '0.0.0-test'
  )
on conflict (id) do nothing;

-- Save A: tick_index 0..2 with hashes prefixed 'a1...'.
-- Save B: tick_index 0..1 with hashes prefixed 'b2...' (distinct so a
-- cross-save leak shows up as a hash-prefix mismatch in save A's result).
insert into public.tick_log (save_id, tick_index, tick_hash, events_jsonb, engine_version)
select
  'a1111111-1111-1111-1111-111111111111'::uuid,
  i,
  decode(
    'a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1'
      || lpad(to_hex(i), 2, '0'),
    'hex'
  ),
  jsonb_build_object('save', 'a', 'tick', i),
  '0.0.0-test'
from generate_series(0, 2) as g(i)
on conflict (save_id, tick_index) do nothing;

insert into public.tick_log (save_id, tick_index, tick_hash, events_jsonb, engine_version)
select
  'a2222222-2222-2222-2222-222222222222'::uuid,
  i,
  decode(
    'b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2'
      || lpad(to_hex(i), 2, '0'),
    'hex'
  ),
  jsonb_build_object('save', 'b', 'tick', i),
  '0.0.0-test'
from generate_series(0, 1) as g(i)
on conflict (save_id, tick_index) do nothing;

-- Positive: harness_test can read save A's chain --------------------

set local role harness_test;

-- Range [0,1]: 2 rows, ordered ascending, tick_index 0 then 1.
select results_eq(
  $$select tick_index from public.sim_read_tick_log(
      'a1111111-1111-1111-1111-111111111111'::uuid, 0, 1
  )$$,
  $$values (0), (1)$$,
  'harness_test gets rows in [0,1] ordered ascending'
);

-- Range [1,2]: range filter excludes tick 0.
select results_eq(
  $$select tick_index from public.sim_read_tick_log(
      'a1111111-1111-1111-1111-111111111111'::uuid, 1, 2
  )$$,
  $$values (1), (2)$$,
  'harness_test range filter excludes ticks below from_tick'
);

-- tick_hash is encoded as 64-char lowercase hex.
select is(
  (
    select tick_hash
      from public.sim_read_tick_log(
        'a1111111-1111-1111-1111-111111111111'::uuid, 0, 0
      )
  ),
  'a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a100',
  'tick_hash returned as 64-char lowercase hex'
);

-- Empty range: no rows returned (range above tick_log contents).
select is(
  (
    select count(*)::integer
      from public.sim_read_tick_log(
        'a1111111-1111-1111-1111-111111111111'::uuid, 100, 200
      )
  ),
  0,
  'empty range returns no rows'
);

-- Cross-save isolation: requesting save A returns ONLY save A's hashes.
-- Save B's hashes start with 'b2'; if any leak into save A's result,
-- this assertion fires. Counts the rows that have the wrong prefix.
select is(
  (
    select count(*)::integer
      from public.sim_read_tick_log(
        'a1111111-1111-1111-1111-111111111111'::uuid, 0, 100
      )
     where tick_hash not like 'a1%'
  ),
  0,
  'cross-save isolation: save A query returns no save B rows'
);

-- Symmetric check from save B's side.
select is(
  (
    select count(*)::integer
      from public.sim_read_tick_log(
        'a2222222-2222-2222-2222-222222222222'::uuid, 0, 100
      )
     where tick_hash not like 'b2%'
  ),
  0,
  'cross-save isolation: save B query returns no save A rows'
);

-- Unknown save: returns zero rows (not an error). The harness uses
-- this to detect "save was wiped" without a special-cased exception.
select is(
  (
    select count(*)::integer
      from public.sim_read_tick_log(
        '00000000-0000-0000-0000-000000000099'::uuid, 0, 100
      )
  ),
  0,
  'unknown save returns zero rows (no error)'
);

reset role;

select * from finish();

rollback;
