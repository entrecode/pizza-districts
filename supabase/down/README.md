# Down migrations

Supabase CLI applies migrations forward only. These `*.down.sql` files
are the reversible counterparts to the forward migrations under
`supabase/migrations/` — apply them by hand (e.g. `psql -f
supabase/down/0003_tick_log.down.sql`) when you need to roll back in
dev.

Apply in **reverse numeric order**: drop `0010` before `0006` before
`0002` before `0001`.

The Supabase CLI does not scan this directory.
