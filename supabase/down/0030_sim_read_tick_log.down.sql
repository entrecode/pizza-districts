-- Roll back 0030_sim_read_tick_log.sql.
-- Apply before 0020_harness_test_role.down.sql.

drop function if exists public.sim_read_tick_log(uuid, integer, integer);
drop type if exists public.sim_tick_log_row;
