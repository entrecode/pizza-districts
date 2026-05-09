-- Roll back 0001_extensions.sql.
-- Apply last; assumes 0002, 0006, 0010 have already been rolled back.
--
-- pgcrypto is left installed because other Supabase-managed objects
-- typically depend on it. Drop it manually if you really want it gone.

drop schema if exists app cascade;
drop schema if exists private cascade;
