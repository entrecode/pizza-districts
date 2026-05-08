-- pgTAP: harness_test role contract (PIZ-33 acceptance).
--
-- Coverage:
--   * Role exists, NOLOGIN, NOINHERIT.
--   * Has USAGE on schema public (so it can resolve function names).
--   * Has zero direct DML grants on public.saves and public.tick_log
--     — same denial surface as anon. The harness reaches state through
--     test-tagged SECURITY DEFINER RPCs only (PIZ-23 lands the first).

begin;

create extension if not exists pgtap;

select * from no_plan();

-- Role shape ----------------------------------------------------------

select is(
  exists (select 1 from pg_roles where rolname = 'harness_test'),
  true,
  'harness_test role exists'
);

select is(
  (select rolcanlogin from pg_roles where rolname = 'harness_test'),
  false,
  'harness_test is NOLOGIN'
);

select is(
  (select rolinherit from pg_roles where rolname = 'harness_test'),
  false,
  'harness_test is NOINHERIT'
);

select is(
  (select rolbypassrls from pg_roles where rolname = 'harness_test'),
  false,
  'harness_test does NOT bypass RLS'
);

-- Schema USAGE --------------------------------------------------------

select is(
  has_schema_privilege('harness_test', 'public', 'USAGE'),
  true,
  'harness_test has USAGE on schema public'
);

-- No direct table grants ---------------------------------------------

select is(
  has_table_privilege('harness_test', 'public.saves', 'SELECT'),
  false,
  'harness_test has no SELECT on public.saves'
);

select is(
  has_table_privilege('harness_test', 'public.saves', 'INSERT'),
  false,
  'harness_test has no INSERT on public.saves'
);

select is(
  has_table_privilege('harness_test', 'public.saves', 'UPDATE'),
  false,
  'harness_test has no UPDATE on public.saves'
);

select is(
  has_table_privilege('harness_test', 'public.tick_log', 'SELECT'),
  false,
  'harness_test has no SELECT on public.tick_log'
);

select is(
  has_table_privilege('harness_test', 'public.tick_log', 'INSERT'),
  false,
  'harness_test has no INSERT on public.tick_log'
);

-- Direct table access from harness_test fails ------------------------
--
-- This is the foundational denial that PIZ-23's sim_read_tick_log RPC
-- relies on — the harness must NOT be able to read tick_log directly,
-- only through the SECURITY DEFINER test-tagged RPC.

set local role harness_test;

select throws_ok(
  'select * from public.tick_log',
  '42501',
  null,
  'harness_test cannot SELECT public.tick_log directly (foundational test for PIZ-23)'
);

select throws_ok(
  'select * from public.saves',
  '42501',
  null,
  'harness_test cannot SELECT public.saves directly'
);

reset role;

-- harness_test does NOT have EXECUTE on the runtime RPCs. The
-- determinism harness loads state and asserts hashes via test-tagged
-- functions only; it never calls the player- or service-role-facing
-- runtime RPCs.

select is(
  has_function_privilege('harness_test', 'public.sim_load_state(uuid)', 'EXECUTE'),
  false,
  'harness_test cannot EXECUTE sim_load_state (runtime RPC)'
);

select is(
  has_function_privilege(
    'harness_test',
    'public.sim_commit_ticks(uuid, integer, jsonb)',
    'EXECUTE'
  ),
  false,
  'harness_test cannot EXECUTE sim_commit_ticks (runtime RPC)'
);

select * from finish();

rollback;
