-- Smoke seed for engine v0 (PIZ-25): one save + 7 dummy tick_log rows.
--
-- Provides PIZ-23's determinism harness fixture with deterministic data
-- to read. Idempotent — keyed on stable UUIDs and (save_id, tick_index)
-- so re-running `supabase db reset` doesn't create duplicates.
--
-- The smoke user is intentionally created in auth.users so the FK on
-- public.saves.user_id resolves locally. In hosted environments
-- (preview/prod) this seed should not run; production saves are
-- created via the onboarding Edge Function under a real user.

insert into auth.users (id, email)
values ('aaaa0000-0000-0000-0000-000000000001', 'smoke@pizza-districts.local')
on conflict (id) do nothing;

insert into public.saves (
  id,
  user_id,
  brand_id,
  rng_seed,
  current_tick,
  engine_version
)
values (
  'aaaa0000-0000-0000-0000-000000000002',
  'aaaa0000-0000-0000-0000-000000000001',
  'aaaa0000-0000-0000-0000-000000000003',
  -- A pinned brand_seed for the smoke save. Real saves use
  -- gen_random_bytes(8); this constant keeps the harness fixture
  -- byte-identical across machines.
  4242424242,
  6,
  '0.0.0-smoke'
)
on conflict (id) do update
  set rng_seed = excluded.rng_seed,
      current_tick = excluded.current_tick,
      engine_version = excluded.engine_version;

-- Seven tick rows, indices 0..6. Each tick_hash is a 32-byte BYTEA
-- derived from a constant prefix + the tick index, so the seed is
-- byte-identical across machines without needing the real reducer.
insert into public.tick_log (
  save_id,
  tick_index,
  tick_hash,
  events_jsonb,
  engine_version
)
select
  'aaaa0000-0000-0000-0000-000000000002'::uuid,
  i,
  decode(
    'deadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbe'
      || lpad(to_hex(i), 2, '0'),
    'hex'
  ),
  jsonb_build_object(
    'tick_index', i,
    'events', jsonb_build_array(
      jsonb_build_object('kind', 'smoke', 'tick', i)
    )
  ),
  '0.0.0-smoke'
from generate_series(0, 6) as g(i)
on conflict (save_id, tick_index) do nothing;
