-- Roll back 0002_helper_functions.sql.
-- Apply after 0006_saves.down.sql, before 0001_extensions.down.sql.

drop function if exists app.is_save_owner(uuid);
