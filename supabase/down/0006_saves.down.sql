-- Roll back 0006_saves.sql.
-- Apply after 0010_tick_log.down.sql, before 0002_helper_functions.down.sql.

drop policy if exists saves_service_role_all on public.saves;
drop policy if exists saves_owner_update on public.saves;
drop policy if exists saves_owner_select on public.saves;

drop trigger if exists saves_set_updated_at on public.saves;

drop index if exists public.saves_user_id_idx;
drop table if exists public.saves;
