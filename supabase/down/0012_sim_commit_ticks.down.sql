-- Roll back 0012_sim_commit_ticks.sql.
-- Apply after 0020_harness_test_role.down.sql, before 0011_sim_load_state.down.sql.

drop function if exists public.sim_commit_ticks(uuid, integer, jsonb);
