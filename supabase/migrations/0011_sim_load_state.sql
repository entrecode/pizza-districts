-- ADR-0003 §5.2 + PIZ-33 acceptance: sim_load_state RPC.
--
-- Single-call snapshot used by the Edge Function `advance` endpoint:
--   1. Resolve ownership (auth.uid() must match saves.user_id).
--   2. Return the full input bundle (RNG seeds, current_tick, engine
--      version) as a JSONB object the Deno reducer can hydrate without
--      a second round-trip.
--
-- Cross-player access raises `42501 insufficient_privilege`. Service
-- role is allowed to load any save (Edge Function path).
--
-- The function is SECURITY DEFINER + owner-locked and pins
-- `search_path = public, pg_temp` (no `app` lookups happen here, but
-- pinning the search path is the standard Supabase guard against
-- search-path-poisoning when a SECURITY DEFINER function reads tables
-- by unqualified name).

create or replace function public.sim_load_state(save_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_save public.saves%rowtype;
  v_role text;
begin
  v_role := current_setting('role', true);

  select * into v_save from public.saves where id = save_id;

  if not found then
    raise exception 'save not found: %', save_id
      using errcode = 'no_data_found';
  end if;

  -- Ownership check. service_role bypasses RLS via BYPASSRLS, so it
  -- also bypasses the auth.uid() match here — the Edge Function loads
  -- arbitrary saves under its server-side service-role JWT.
  if v_role is distinct from 'service_role'
     and v_save.user_id is distinct from auth.uid() then
    raise exception 'access denied for save %', save_id
      using errcode = 'insufficient_privilege';
  end if;

  -- rng_seed is BIGINT; cast to text so JSON.parse on the Deno side
  -- preserves the full 64-bit value (Number.MAX_SAFE_INTEGER is 2^53-1).
  return jsonb_build_object(
    'save_id', v_save.id,
    'user_id', v_save.user_id,
    'brand_id', v_save.brand_id,
    'rng_seed', v_save.rng_seed::text,
    'current_tick', v_save.current_tick,
    'engine_version', v_save.engine_version,
    'created_at', v_save.created_at,
    'updated_at', v_save.updated_at
  );
end;
$$;

revoke all on function public.sim_load_state(uuid) from public;
grant execute on function public.sim_load_state(uuid) to authenticated, service_role;

comment on function public.sim_load_state(uuid) is
  'ADR-0003 §5.2 snapshot loader. Returns the JSONB input bundle the Edge Function hydrates before running runTick. Cross-player access raises insufficient_privilege.';
