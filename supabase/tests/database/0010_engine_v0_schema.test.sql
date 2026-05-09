-- pgTAP tests for the engine v0 persistence layer (PIZ-25).
-- Run with `supabase test db` (or pg_prove against the migrated DB).
--
-- Coverage:
--   * Both tables exist with the agreed shape and RLS enabled+forced.
--   * (save_id, tick_index) primary key uniqueness on tick_log.
--   * Hash-length CHECK rejects non-32-byte tick_hash values.
--   * anon role cannot SELECT either table.
--   * Authenticated user A cannot read user B's save or tick_log row.
--   * service_role can INSERT into tick_log; authenticated cannot.
--   * tick_log INSERT/UPDATE/DELETE are denied for non-service-role
--     callers (append-only contract).

begin;

create extension if not exists pgtap;

select * from no_plan();

-- ------------------------------------------------------------------
-- Schema shape
-- ------------------------------------------------------------------

select has_table('public', 'saves', 'public.saves exists');
select has_table('public', 'tick_log', 'public.tick_log exists');

select col_is_pk('public', 'saves', array['id'], 'saves PK is (id)');
select col_is_pk(
  'public',
  'tick_log',
  array['save_id', 'tick_index'],
  'tick_log PK is (save_id, tick_index)'
);

select has_index(
  'public',
  'tick_log',
  'tick_log_save_tick_desc_idx',
  'tick_log_save_tick_desc_idx exists'
);

-- ------------------------------------------------------------------
-- RLS: enabled + forced on both tables
-- ------------------------------------------------------------------

select is(
  (select relrowsecurity from pg_class where oid = 'public.saves'::regclass),
  true,
  'saves has RLS enabled'
);
select is(
  (select relforcerowsecurity from pg_class where oid = 'public.saves'::regclass),
  true,
  'saves has RLS forced'
);
select is(
  (select relrowsecurity from pg_class where oid = 'public.tick_log'::regclass),
  true,
  'tick_log has RLS enabled'
);
select is(
  (select relforcerowsecurity from pg_class where oid = 'public.tick_log'::regclass),
  true,
  'tick_log has RLS forced'
);

-- ------------------------------------------------------------------
-- Fixtures: two users (A and B), one save each, one tick_log row each.
-- We seed via service-role-equivalent privileges (the test runs as
-- the migration role / postgres). Per-role behavior is exercised
-- below by SET ROLE.
-- ------------------------------------------------------------------

insert into auth.users (id, email)
values
  ('11111111-1111-1111-1111-111111111111', 'a@test.local'),
  ('22222222-2222-2222-2222-222222222222', 'b@test.local')
on conflict (id) do nothing;

insert into public.saves (id, user_id, brand_id, rng_seed, engine_version)
values
  (
    '33333333-3333-3333-3333-333333333333',
    '11111111-1111-1111-1111-111111111111',
    '44444444-4444-4444-4444-444444444444',
    1234567890,
    '0.0.0-test'
  ),
  (
    '55555555-5555-5555-5555-555555555555',
    '22222222-2222-2222-2222-222222222222',
    '66666666-6666-6666-6666-666666666666',
    9876543210,
    '0.0.0-test'
  );

insert into public.tick_log (save_id, tick_index, tick_hash, events_jsonb, engine_version)
values
  (
    '33333333-3333-3333-3333-333333333333',
    0,
    decode('00000000000000000000000000000000000000000000000000000000000000aa', 'hex'),
    '{"events": []}'::jsonb,
    '0.0.0-test'
  ),
  (
    '55555555-5555-5555-5555-555555555555',
    0,
    decode('00000000000000000000000000000000000000000000000000000000000000bb', 'hex'),
    '{"events": []}'::jsonb,
    '0.0.0-test'
  );

-- ------------------------------------------------------------------
-- (save_id, tick_index) uniqueness
-- ------------------------------------------------------------------

select throws_ok(
  $$insert into public.tick_log (save_id, tick_index, tick_hash, events_jsonb, engine_version)
    values (
      '33333333-3333-3333-3333-333333333333',
      0,
      decode('00000000000000000000000000000000000000000000000000000000000000cc', 'hex'),
      '{}'::jsonb,
      '0.0.0-test'
    )$$,
  '23505',
  null,
  '(save_id, tick_index) PK rejects duplicates'
);

-- ------------------------------------------------------------------
-- 32-byte tick_hash CHECK
-- ------------------------------------------------------------------

select throws_ok(
  $$insert into public.tick_log (save_id, tick_index, tick_hash, events_jsonb, engine_version)
    values (
      '33333333-3333-3333-3333-333333333333',
      99,
      decode('aabbcc', 'hex'),
      '{}'::jsonb,
      '0.0.0-test'
    )$$,
  '23514',
  null,
  'tick_hash CHECK rejects non-32-byte values'
);

-- ------------------------------------------------------------------
-- anon: zero access on either table.
-- ------------------------------------------------------------------

set local role anon;

select throws_ok(
  'select * from public.saves',
  '42501',
  null,
  'anon cannot SELECT public.saves'
);
select throws_ok(
  'select * from public.tick_log',
  '42501',
  null,
  'anon cannot SELECT public.tick_log'
);

reset role;

-- ------------------------------------------------------------------
-- authenticated user A: can see own save/tick, cannot see B's.
-- We simulate auth.uid() by setting the request.jwt.claim and the
-- authenticated role together — same pattern the Supabase test runner
-- uses for RLS coverage.
-- ------------------------------------------------------------------

set local role authenticated;
set local "request.jwt.claim.sub" = '11111111-1111-1111-1111-111111111111';

select results_eq(
  $$select id from public.saves order by id$$,
  $$values ('33333333-3333-3333-3333-333333333333'::uuid)$$,
  'auth user A only sees their own save'
);

select results_eq(
  $$select tick_index from public.tick_log order by save_id, tick_index$$,
  $$values (0)$$,
  'auth user A only sees their own tick_log row'
);

select is_empty(
  $$select 1 from public.saves where id = '55555555-5555-5555-5555-555555555555'$$,
  'auth user A cannot read user B''s save by id'
);

select is_empty(
  $$select 1 from public.tick_log where save_id = '55555555-5555-5555-5555-555555555555'$$,
  'auth user A cannot read user B''s tick_log row'
);

-- A cannot insert into tick_log directly.
select throws_ok(
  $$insert into public.tick_log (save_id, tick_index, tick_hash, events_jsonb, engine_version)
    values (
      '33333333-3333-3333-3333-333333333333',
      1,
      decode('00000000000000000000000000000000000000000000000000000000000000dd', 'hex'),
      '{}'::jsonb,
      '0.0.0-test'
    )$$,
  '42501',
  null,
  'auth user A cannot INSERT into public.tick_log'
);

-- A cannot update or delete tick_log even on their own row.
select throws_ok(
  $$update public.tick_log
      set engine_version = 'tampered'
    where save_id = '33333333-3333-3333-3333-333333333333'$$,
  '42501',
  null,
  'auth user A cannot UPDATE public.tick_log'
);

select throws_ok(
  $$delete from public.tick_log
    where save_id = '33333333-3333-3333-3333-333333333333'$$,
  '42501',
  null,
  'auth user A cannot DELETE public.tick_log'
);

-- A cannot insert a save (onboarding is service-role only).
select throws_ok(
  $$insert into public.saves (id, user_id, brand_id, rng_seed, engine_version)
    values (
      '77777777-7777-7777-7777-777777777777',
      '11111111-1111-1111-1111-111111111111',
      '88888888-8888-8888-8888-888888888888',
      42,
      '0.0.0-test'
    )$$,
  '42501',
  null,
  'auth user A cannot INSERT into public.saves'
);

-- A can update their own save (status, settings).
select lives_ok(
  $$update public.saves
      set engine_version = '0.0.0-test-touched'
    where id = '33333333-3333-3333-3333-333333333333'$$,
  'auth user A can UPDATE their own save'
);

-- A cannot update someone else's save (RLS hides it; UPDATE
-- silently affects 0 rows rather than throwing — assert via the
-- post-state).
update public.saves
  set engine_version = 'tampered-by-A'
  where id = '55555555-5555-5555-5555-555555555555';

reset role;
reset "request.jwt.claim.sub";

select is(
  (select engine_version from public.saves
   where id = '55555555-5555-5555-5555-555555555555'),
  '0.0.0-test',
  'auth user A''s UPDATE on user B''s save was silently filtered out by RLS'
);

-- ------------------------------------------------------------------
-- service_role: append works, history is durable.
-- ------------------------------------------------------------------

set local role service_role;

select lives_ok(
  $$insert into public.tick_log (save_id, tick_index, tick_hash, events_jsonb, engine_version)
    values (
      '33333333-3333-3333-3333-333333333333',
      1,
      decode('00000000000000000000000000000000000000000000000000000000000000ee', 'hex'),
      '{"events": []}'::jsonb,
      '0.0.0-test'
    )$$,
  'service_role can INSERT into public.tick_log'
);

select is(
  (select count(*)::int from public.tick_log
   where save_id = '33333333-3333-3333-3333-333333333333'),
  2,
  'service_role INSERT landed (2 rows for save A)'
);

reset role;

-- ------------------------------------------------------------------
-- Cascade: deleting a save drops its tick_log rows.
-- ------------------------------------------------------------------

delete from public.saves where id = '55555555-5555-5555-5555-555555555555';

select is(
  (select count(*)::int from public.tick_log
   where save_id = '55555555-5555-5555-5555-555555555555'),
  0,
  'tick_log rows cascade-delete with their save'
);

-- ------------------------------------------------------------------
-- updated_at trigger
-- ------------------------------------------------------------------

set local role service_role;

select isnt(
  (
    select updated_at
    from (
      update public.saves
        set engine_version = '0.0.0-trigger-check'
        where id = '33333333-3333-3333-3333-333333333333'
        returning updated_at
    ) t
  ),
  (select created_at from public.saves where id = '33333333-3333-3333-3333-333333333333'),
  'saves.updated_at trigger bumps the timestamp on UPDATE'
);

reset role;

select * from finish();

rollback;
