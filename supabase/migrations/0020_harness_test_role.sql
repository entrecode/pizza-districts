-- PIZ-33 acceptance: harness_test Postgres role.
--
-- The determinism harness ([PIZ-9](/PIZ/issues/PIZ-9), [PIZ-31](/PIZ/issues/PIZ-31))
-- needs a SQL identity that is NOT service_role and NOT a real player,
-- but can call test-tagged SECURITY DEFINER RPCs (PIZ-23 lands the
-- first one: sim_read_tick_log). Giving the harness service_role
-- credentials would bypass RLS in tests and hide regressions.
--
-- Contract per ADR-0002:
--   * NOLOGIN — no password / JWT path. Tests acquire it via SET ROLE
--     under a privileged connection (or a Postgres login role granted
--     INHERIT/SET on harness_test).
--   * EXECUTE-only — no table-level DML grants. Direct SELECT/INSERT
--     on public.* tables stays denied; the role is gated to whatever
--     test-tagged functions explicitly grant EXECUTE.
--   * INHERIT off — the role does not auto-pick up grants from
--     authenticated/anon. Membership has to be granted explicitly.
--
-- Per-function EXECUTE grants happen inside the migration that
-- creates each test-tagged function (PIZ-23 will grant
-- sim_read_tick_log).

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'harness_test') then
    create role harness_test nologin noinherit;
  end if;
end
$$;

-- Schema USAGE so the role can resolve `public.fn_name(...)`. Not a
-- DML grant — the role still needs an explicit EXECUTE on each
-- function. SELECT on `public.*` tables stays denied at the table
-- level (table grants were revoked from public/anon/authenticated/
-- service_role explicitly in 0006_saves and 0010_tick_log).
grant usage on schema public to harness_test;

comment on role harness_test is
  'Determinism-harness role. NOLOGIN. EXECUTE-only on test-tagged SECURITY DEFINER functions. Never used at runtime by players or the Edge Function. Per PIZ-33 acceptance and PIZ-9 §4.';
