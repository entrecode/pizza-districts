-- pgTAP: sim_commit_ticks RPC contract (PIZ-33 acceptance).
--
-- Coverage:
--   * Function exists, SECURITY DEFINER, pinned search_path.
--   * EXECUTE granted to service_role only (not authenticated/anon).
--   * Authenticated calling raises insufficient_privilege.
--   * Service role can append a contiguous batch and saves.current_tick
--     advances by N.
--   * tick_log rows are persisted with the right columns.
--   * Mismatched expected_current_tick raises SQLSTATE PIZ01
--     (= optimistic_lock_conflict).
--   * Out-of-order tick_index in payload raises invalid_parameter_value.

begin;

create extension if not exists pgtap;

select * from no_plan();

-- Function shape ------------------------------------------------------

select has_function(
  'public', 'sim_commit_ticks', array['uuid', 'integer', 'jsonb'],
  'public.sim_commit_ticks(uuid, integer, jsonb) exists'
);

select function_returns(
  'public', 'sim_commit_ticks', array['uuid', 'integer', 'jsonb'], 'integer',
  'sim_commit_ticks returns integer'
);

select is(
  (
    select prosecdef
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.proname = 'sim_commit_ticks'
  ),
  true,
  'sim_commit_ticks is SECURITY DEFINER'
);

select ok(
  exists (
    select 1
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace,
           unnest(p.proconfig) as cfg(s)
     where n.nspname = 'public'
       and p.proname = 'sim_commit_ticks'
       and cfg.s like 'search_path=%'
  ),
  'sim_commit_ticks pins search_path'
);

select is(
  has_function_privilege(
    'service_role',
    'public.sim_commit_ticks(uuid, integer, jsonb)',
    'EXECUTE'
  ),
  true,
  'service_role has EXECUTE on sim_commit_ticks'
);

select is(
  has_function_privilege(
    'authenticated',
    'public.sim_commit_ticks(uuid, integer, jsonb)',
    'EXECUTE'
  ),
  false,
  'authenticated cannot EXECUTE sim_commit_ticks'
);

select is(
  has_function_privilege(
    'anon',
    'public.sim_commit_ticks(uuid, integer, jsonb)',
    'EXECUTE'
  ),
  false,
  'anon cannot EXECUTE sim_commit_ticks'
);

-- Fixtures ------------------------------------------------------------

insert into auth.users (id, email)
values ('11111111-1111-1111-1111-111111111111', 'a@test.local')
on conflict (id) do nothing;

insert into public.saves (id, user_id, brand_id, rng_seed, current_tick, engine_version)
values (
  '33333333-3333-3333-3333-333333333333',
  '11111111-1111-1111-1111-111111111111',
  '44444444-4444-4444-4444-444444444444',
  1234567890,
  0,
  '0.0.0-test'
)
on conflict (id) do nothing;

-- Service role: happy path -------------------------------------------

set local role service_role;

-- Append 3 ticks (indices 0, 1, 2). New current_tick = 3.
select is(
  public.sim_commit_ticks(
    '33333333-3333-3333-3333-333333333333',
    0,
    jsonb_build_array(
      jsonb_build_object(
        'tick_index', 0,
        'tick_hash', repeat('aa', 32),
        'events_jsonb', '{"events": []}'::jsonb,
        'engine_version', '0.0.0-test'
      ),
      jsonb_build_object(
        'tick_index', 1,
        'tick_hash', repeat('bb', 32),
        'events_jsonb', '{"events": []}'::jsonb,
        'engine_version', '0.0.0-test'
      ),
      jsonb_build_object(
        'tick_index', 2,
        'tick_hash', repeat('cc', 32),
        'events_jsonb', '{"events": []}'::jsonb,
        'engine_version', '0.0.0-test+adv'
      )
    )
  ),
  3,
  'sim_commit_ticks returns the new current_tick (3 after appending 3 ticks)'
);

select is(
  (select current_tick from public.saves where id = '33333333-3333-3333-3333-333333333333'),
  3,
  'saves.current_tick advanced to 3'
);

select is(
  (select engine_version from public.saves where id = '33333333-3333-3333-3333-333333333333'),
  '0.0.0-test+adv',
  'saves.engine_version was rewritten from the last tick'
);

select is(
  (select count(*)::int from public.tick_log where save_id = '33333333-3333-3333-3333-333333333333'),
  3,
  'three tick_log rows persisted'
);

-- Optimistic-lock conflict -------------------------------------------

select throws_ok(
  $$select public.sim_commit_ticks(
      '33333333-3333-3333-3333-333333333333',
      0, -- stale; actual current_tick is 3
      jsonb_build_array(
        jsonb_build_object(
          'tick_index', 0,
          'tick_hash', repeat('dd', 32),
          'events_jsonb', '{}'::jsonb,
          'engine_version', '0.0.0-test'
        )
      )
    )$$,
  'PIZ01',
  null,
  'stale expected_current_tick raises optimistic_lock_conflict (PIZ01)'
);

-- Out-of-order tick_index --------------------------------------------

select throws_ok(
  $$select public.sim_commit_ticks(
      '33333333-3333-3333-3333-333333333333',
      3,
      jsonb_build_array(
        jsonb_build_object(
          'tick_index', 99,
          'tick_hash', repeat('dd', 32),
          'events_jsonb', '{}'::jsonb,
          'engine_version', '0.0.0-test'
        )
      )
    )$$,
  '22023',
  null,
  'non-contiguous tick_index raises invalid_parameter_value'
);

-- Empty payload ------------------------------------------------------

select throws_ok(
  $$select public.sim_commit_ticks(
      '33333333-3333-3333-3333-333333333333',
      3,
      '[]'::jsonb
    )$$,
  '22023',
  null,
  'empty ticks_payload raises invalid_parameter_value'
);

reset role;

-- Authenticated: cannot call (insufficient_privilege) ----------------

set local role authenticated;
set local "request.jwt.claim.sub" = '11111111-1111-1111-1111-111111111111';

select throws_ok(
  $$select public.sim_commit_ticks(
      '33333333-3333-3333-3333-333333333333',
      3,
      jsonb_build_array(
        jsonb_build_object(
          'tick_index', 3,
          'tick_hash', repeat('dd', 32),
          'events_jsonb', '{}'::jsonb,
          'engine_version', '0.0.0-test'
        )
      )
    )$$,
  '42501',
  null,
  'authenticated cannot EXECUTE sim_commit_ticks (no grant)'
);

reset role;
reset "request.jwt.claim.sub";

select * from finish();

rollback;
