-- pgTAP: sim_load_state RPC contract (PIZ-33 acceptance).
--
-- Coverage:
--   * Function exists with the agreed (uuid -> jsonb) signature and
--     SECURITY DEFINER + pinned search_path.
--   * EXECUTE granted to authenticated and service_role only.
--   * Authenticated owner gets the snapshot.
--   * Authenticated cross-player call raises insufficient_privilege.
--   * Service role gets the snapshot for any save.
--   * Missing save raises no_data_found.

begin;

create extension if not exists pgtap;

select * from no_plan();

-- Function shape ------------------------------------------------------

select has_function(
  'public', 'sim_load_state', array['uuid'],
  'public.sim_load_state(uuid) exists'
);

select function_returns(
  'public', 'sim_load_state', array['uuid'], 'jsonb',
  'sim_load_state returns jsonb'
);

select is(
  (
    select prosecdef
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.proname = 'sim_load_state'
  ),
  true,
  'sim_load_state is SECURITY DEFINER'
);

select ok(
  exists (
    select 1
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace,
           unnest(p.proconfig) as cfg(s)
     where n.nspname = 'public'
       and p.proname = 'sim_load_state'
       and cfg.s like 'search_path=%'
  ),
  'sim_load_state pins search_path'
);

-- EXECUTE grants ------------------------------------------------------

select is(
  has_function_privilege('authenticated', 'public.sim_load_state(uuid)', 'EXECUTE'),
  true,
  'authenticated has EXECUTE on sim_load_state'
);

select is(
  has_function_privilege('service_role', 'public.sim_load_state(uuid)', 'EXECUTE'),
  true,
  'service_role has EXECUTE on sim_load_state'
);

select is(
  has_function_privilege('anon', 'public.sim_load_state(uuid)', 'EXECUTE'),
  false,
  'anon cannot EXECUTE sim_load_state'
);

-- Fixtures ------------------------------------------------------------

insert into auth.users (id, email)
values
  ('11111111-1111-1111-1111-111111111111', 'a@test.local'),
  ('22222222-2222-2222-2222-222222222222', 'b@test.local')
on conflict (id) do nothing;

insert into public.saves (id, user_id, brand_id, rng_seed, current_tick, engine_version)
values
  (
    '33333333-3333-3333-3333-333333333333',
    '11111111-1111-1111-1111-111111111111',
    '44444444-4444-4444-4444-444444444444',
    1234567890,
    3,
    '0.0.0-test'
  ),
  (
    '55555555-5555-5555-5555-555555555555',
    '22222222-2222-2222-2222-222222222222',
    '66666666-6666-6666-6666-666666666666',
    9876543210,
    7,
    '0.0.0-test'
  )
on conflict (id) do nothing;

-- Authenticated owner: gets snapshot ---------------------------------

set local role authenticated;
set local "request.jwt.claim.sub" = '11111111-1111-1111-1111-111111111111';

select is(
  (
    public.sim_load_state('33333333-3333-3333-3333-333333333333')->>'save_id'
  ),
  '33333333-3333-3333-3333-333333333333',
  'authenticated owner gets save_id back'
);

select is(
  (
    public.sim_load_state('33333333-3333-3333-3333-333333333333')->>'rng_seed'
  ),
  '1234567890',
  'authenticated owner gets rng_seed back'
);

select is(
  (
    (public.sim_load_state('33333333-3333-3333-3333-333333333333')->>'current_tick')::int
  ),
  3,
  'authenticated owner gets current_tick back'
);

-- Authenticated cross-player: raises insufficient_privilege ----------

select throws_ok(
  $$select public.sim_load_state('55555555-5555-5555-5555-555555555555')$$,
  '42501',
  null,
  'cross-player sim_load_state raises insufficient_privilege'
);

reset role;
reset "request.jwt.claim.sub";

-- Service role: any save ---------------------------------------------

set local role service_role;

select is(
  (
    public.sim_load_state('55555555-5555-5555-5555-555555555555')->>'rng_seed'
  ),
  '9876543210',
  'service_role can load any save'
);

-- Missing save: no_data_found ----------------------------------------

select throws_ok(
  $$select public.sim_load_state('99999999-9999-9999-9999-999999999999')$$,
  '02000',
  null,
  'unknown save raises no_data_found'
);

reset role;

select * from finish();

rollback;
