#!/usr/bin/env bash
# Runs the SQL tests against the local Supabase database started by
# `supabase start` (or any URL given in SUPABASE_DB_URL).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DB_URL="${SUPABASE_DB_URL:-postgresql://postgres:postgres@127.0.0.1:54322/postgres}"
for f in "$ROOT"/supabase/tests/sql/*.test.sql; do
  echo "→ $(basename "$f")"
  psql "$DB_URL" -X -q -v ON_ERROR_STOP=1 -o /dev/null -f "$f" 2>&1 | sed -e 's/^psql:[^ ]* NOTICE:  /  /'
done
