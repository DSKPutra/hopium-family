#!/usr/bin/env bash
# Applies every migration and the demo seed to a scratch PostgreSQL database,
# then runs the RLS / column-privilege assertions in supabase/tests/rls_test.sql.
#
#   DATABASE_URL=postgres://postgres@localhost:5432/postgres npm run test:db
#
# Uses plain PostgreSQL plus supabase/tests/supabase_shim.sql (auth schema,
# roles, pg_cron/pg_net stubs), so no Docker or Supabase CLI is needed.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ADMIN_URL="${DATABASE_URL:-postgres://postgres@localhost:5432/postgres}"
DB="hopium_test_$$"
TEST_URL="${ADMIN_URL%/*}/$DB"
PSQL=(psql -X -q -v ON_ERROR_STOP=1)
# Setup output (notices from idempotent DDL, wal_level hints) is noise here.
export PGOPTIONS="-c client_min_messages=warning"

# KEEP_DB=1 leaves the scratch database in place for debugging.
cleanup() {
  [ -n "${KEEP_DB:-}" ] && { echo "kept $DB"; return; }
  "${PSQL[@]}" "$ADMIN_URL" -c "drop database if exists $DB" >/dev/null 2>&1 || true
}
trap cleanup EXIT

"${PSQL[@]}" "$ADMIN_URL" -c "create database $DB" >/dev/null
# Roles are cluster-wide: tolerate them already existing from an earlier run.
"${PSQL[@]}" "$ADMIN_URL" -c "do \$\$ begin
  if not exists (select from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
  if not exists (select from pg_roles where rolname = 'service_role') then create role service_role nologin bypassrls; end if;
end \$\$" >/dev/null
sed -E '/^create role /d' "$ROOT/supabase/tests/supabase_shim.sql" | "${PSQL[@]}" "$TEST_URL" >/dev/null
echo "✓ supabase shim"

for f in "$ROOT"/supabase/migrations/*.sql; do
  # pg_cron / pg_net are provided by the shim.
  sed -E '/create extension if not exists (pg_cron|pg_net);/d' "$f" | "${PSQL[@]}" "$TEST_URL" >/dev/null
  echo "✓ $(basename "$f")"
done

"${PSQL[@]}" "$TEST_URL" -f "$ROOT/supabase/seed.sql" >/dev/null
echo "✓ seed.sql"

PGOPTIONS="-c client_min_messages=notice" "${PSQL[@]}" "$TEST_URL" -f "$ROOT/supabase/tests/rls_test.sql" 2>&1 |
  sed -E 's/^.*NOTICE: +/  /'
test "${PIPESTATUS[0]}" -eq 0
echo "✓ RLS and column-privilege tests"
