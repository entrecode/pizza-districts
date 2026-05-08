-- Roll back 0011_sim_load_state.sql.
-- Apply after 0012_sim_commit_ticks.down.sql, before 0010_tick_log.down.sql.

drop function if exists public.sim_load_state(uuid);
