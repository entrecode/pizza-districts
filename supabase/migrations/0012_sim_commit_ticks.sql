-- ADR-0003 §5.2 + PIZ-33 acceptance: sim_commit_ticks RPC.
--
-- Optimistic-lock commit used by the Edge Function `advance` endpoint:
--   1. Acquire a row-level lock on the save (FOR UPDATE).
--   2. Verify the caller-supplied `expected_current_tick` still matches
--      the persisted `current_tick`. Mismatch raises a sqlstate the
--      client can recognize as `optimistic_lock_conflict`.
--   3. Append every tick row from `ticks_payload` into `tick_log`.
--   4. Bump `saves.current_tick` to the last written index + 1 and
--      stamp `engine_version`.
--   5. Return the new `current_tick`.
--
-- Single transaction. Concurrent advances on the same save fall to
-- the optimistic-lock branch; second writer gets the conflict
-- (mapped via SQLSTATE 'PIZ01' = optimistic_lock_conflict) and the
-- client retries with a fresh sim_load_state.
--
-- ticks_payload shape (JSON array, one element per appended tick):
--   {
--     "tick_index":     int,           -- must equal expected_current_tick + i
--     "tick_hash":      "hex32",       -- 64 hex chars = 32 bytes
--     "events_jsonb":   jsonb,
--     "engine_version": text
--   }
--
-- Authorization: only service_role may call this. Authenticated has
-- no EXECUTE grant — the Edge Function holds the service_role JWT.

create or replace function public.sim_commit_ticks(
  save_id uuid,
  expected_current_tick integer,
  ticks_payload jsonb
)
returns integer
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_actual_tick integer;
  v_role text;
  v_payload_len integer;
  v_invalid_count integer;
  v_invalid_msg text;
  v_last_index integer;
  v_last_engine_version text;
begin
  if ticks_payload is null or jsonb_typeof(ticks_payload) <> 'array' then
    raise exception 'ticks_payload must be a JSON array, got %',
      coalesce(jsonb_typeof(ticks_payload), 'null')
      using errcode = '22023'; -- invalid_parameter_value
  end if;

  v_payload_len := jsonb_array_length(ticks_payload);

  if v_payload_len = 0 then
    raise exception 'ticks_payload must contain at least one tick'
      using errcode = '22023';
  end if;

  -- Service-role-only. The EXECUTE grant already gates this — no other
  -- role has it — but we re-check inside the body so the error is
  -- explicit if a future migration accidentally widens the grant.
  v_role := current_setting('role', true);
  if v_role is distinct from 'service_role' then
    raise exception 'sim_commit_ticks is service-role only (got role %)', coalesce(v_role, '<unset>')
      using errcode = '42501'; -- insufficient_privilege
  end if;

  -- Row lock + read current_tick.
  select s.current_tick
    into v_actual_tick
    from public.saves s
   where s.id = save_id
   for update;

  if not found then
    raise exception 'save not found: %', save_id
      using errcode = 'no_data_found';
  end if;

  if v_actual_tick is distinct from expected_current_tick then
    raise exception 'optimistic_lock_conflict: expected current_tick=%, actual=%',
      expected_current_tick, v_actual_tick
      using errcode = 'PIZ01';
  end if;

  -- Validate every payload row before any writes so a bad batch
  -- raises atomically without partial appends. tick_index MUST be
  -- contiguous starting at expected_current_tick.
  with payload as (
    select
      ord - 1 as ord_offset,
      (elem->>'tick_index')::integer as tick_index,
      decode(elem->>'tick_hash', 'hex') as tick_hash,
      elem->'events_jsonb' as events_jsonb,
      elem->>'engine_version' as engine_version
    from jsonb_array_elements(ticks_payload) with ordinality as t(elem, ord)
  ),
  validated as (
    select
      case
        when p.tick_index is null then 'tick_index missing'
        when p.tick_index <> expected_current_tick + p.ord_offset
          then format('tick_index %s out of order (expected %s)',
                      p.tick_index, expected_current_tick + p.ord_offset)
        when p.tick_hash is null or octet_length(p.tick_hash) <> 32
          then 'tick_hash must decode to 32 bytes'
        when p.events_jsonb is null then 'events_jsonb missing'
        when p.engine_version is null or length(p.engine_version) = 0
          then 'engine_version missing'
        else null
      end as err
    from payload p
  )
  select count(*) filter (where err is not null), max(err)
    into v_invalid_count, v_invalid_msg
    from validated;

  if v_invalid_count > 0 then
    raise exception 'invalid ticks_payload: %', v_invalid_msg
      using errcode = '22023';
  end if;

  insert into public.tick_log (save_id, tick_index, tick_hash, events_jsonb, engine_version)
  select
    sim_commit_ticks.save_id,
    (elem->>'tick_index')::integer,
    decode(elem->>'tick_hash', 'hex'),
    elem->'events_jsonb',
    elem->>'engine_version'
  from jsonb_array_elements(ticks_payload) as elem;

  v_last_index := expected_current_tick + v_payload_len - 1;

  -- saves.engine_version mirrors the most recently committed tick so
  -- the determinism harness can detect drift without scanning tick_log.
  v_last_engine_version :=
    ticks_payload -> (v_payload_len - 1) ->> 'engine_version';

  update public.saves
     set current_tick = v_last_index + 1,
         engine_version = v_last_engine_version
   where id = save_id;

  return v_last_index + 1;
end;
$$;

revoke all on function public.sim_commit_ticks(uuid, integer, jsonb) from public;
grant execute on function public.sim_commit_ticks(uuid, integer, jsonb) to service_role;

comment on function public.sim_commit_ticks(uuid, integer, jsonb) is
  'ADR-0003 §5.2 commit. Optimistic-lock append of N tick rows + advance of saves.current_tick. Raises SQLSTATE PIZ01 (optimistic_lock_conflict) when expected_current_tick mismatches. Service-role only.';
