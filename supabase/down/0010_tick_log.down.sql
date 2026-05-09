-- Roll back 0010_tick_log.sql.
-- Apply before 0006_saves.down.sql.

drop policy if exists tick_log_service_role_insert on public.tick_log;
drop policy if exists tick_log_service_role_select on public.tick_log;
drop policy if exists tick_log_owner_select on public.tick_log;

drop index if exists public.tick_log_save_tick_desc_idx;
drop table if exists public.tick_log;
