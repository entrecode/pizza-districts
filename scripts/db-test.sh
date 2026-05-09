#!/usr/bin/env bash
# Apply migrations and run pgTAP tests against a local Postgres.
#
# Usage:
#   PG_HOST=localhost PG_PORT=5432 PG_USER=postgres PG_PASSWORD=postgres \
#     bash scripts/db-test.sh
#
# Requirements (host or service container):
#   - Postgres 14+ with the pgtap extension files installed
#     (`postgresql-NN-pgtap` on Debian/Ubuntu).
#   - psql + pg_prove on PATH.
#
# This script targets a throwaway database `pizza_districts_test`.
# It is destructive: the database is dropped and recreated each run.

set -euo pipefail

PG_HOST="${PG_HOST:-localhost}"
PG_PORT="${PG_PORT:-5432}"
PG_USER="${PG_USER:-postgres}"
PG_PASSWORD="${PG_PASSWORD:-postgres}"
TEST_DB="${TEST_DB:-pizza_districts_test}"

export PGPASSWORD="$PG_PASSWORD"

PSQL=(psql -X -v ON_ERROR_STOP=1 -h "$PG_HOST" -p "$PG_PORT" -U "$PG_USER")

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

echo ">> Recreating database $TEST_DB on $PG_HOST:$PG_PORT"
"${PSQL[@]}" -d postgres -c "drop database if exists \"$TEST_DB\""
"${PSQL[@]}" -d postgres -c "create database \"$TEST_DB\""

echo ">> Applying Supabase test shim"
"${PSQL[@]}" -d "$TEST_DB" -f supabase/_test/00_supabase_shim.sql

echo ">> Applying migrations"
shopt -s nullglob
for f in supabase/migrations/*.sql; do
  echo "   -- $f"
  "${PSQL[@]}" -d "$TEST_DB" -f "$f"
done

echo ">> Applying smoke seed"
"${PSQL[@]}" -d "$TEST_DB" -f supabase/seed/smoke_engine_v0.sql

echo ">> Running pgTAP tests"
pg_prove --verbose -h "$PG_HOST" -p "$PG_PORT" -U "$PG_USER" -d "$TEST_DB" \
  supabase/tests/database/*.sql

echo ">> OK"
