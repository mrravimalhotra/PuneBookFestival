#!/usr/bin/env bash
# Runs the migrations and database tests against a throwaway plain Postgres
# cluster, with minimal Supabase stand-ins (roles, auth.uid(), storage tables).
# Use this when Docker / `supabase start` is not available. With the Supabase
# CLI running, prefer `pnpm test:db`, which uses the real Supabase stack.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PG_BIN="${PG_BIN:-$(dirname "$(command -v pg_ctl 2>/dev/null || ls /usr/lib/postgresql/*/bin/pg_ctl | tail -1)")}"
WORK="$(mktemp -d)"
PORT="${PGTEST_PORT:-55432}"

cleanup() {
  "$PG_BIN/pg_ctl" -D "$WORK/data" -m immediate stop >/dev/null 2>&1 || true
  rm -rf "$WORK"
}
trap cleanup EXIT

RUN_AS=()
if [ "$(id -u)" = "0" ]; then
  # initdb refuses to run as root; use the postgres OS user when available.
  chown -R postgres "$WORK" 2>/dev/null || true
  RUN_AS=(su postgres -s /bin/bash -c)
fi

run() {
  if [ ${#RUN_AS[@]} -gt 0 ]; then "${RUN_AS[@]}" "$*"; else bash -c "$*"; fi
}

run "'$PG_BIN/initdb' -D '$WORK/data' -U postgres --auth=trust >/dev/null"
run "'$PG_BIN/pg_ctl' -D '$WORK/data' -o \"-p $PORT -k $WORK -c timezone=UTC -c listen_addresses=''\" -l '$WORK/log' -w start >/dev/null" || { cat "$WORK/log"; exit 1; }

PSQL=(psql -X -q -v ON_ERROR_STOP=1 -h "$WORK" -p "$PORT" -U postgres -d postgres)

echo "→ applying Supabase stand-ins"
"${PSQL[@]}" -f "$ROOT/supabase/tests/harness/supabase_stubs.sql"

for f in "$ROOT"/supabase/migrations/*.sql; do
  echo "→ migration $(basename "$f")"
  PGOPTIONS='-c client_min_messages=warning' "${PSQL[@]}" -f "$f"
done

# Migrations run once each, as on Supabase (later ones may move objects that
# earlier ones create, e.g. 0009 moves definer functions into `private`).

for f in "$ROOT"/supabase/tests/sql/*.test.sql; do
  echo "→ test $(basename "$f")"
  "${PSQL[@]}" -o /dev/null -f "$f" 2>&1 | sed -e 's/^psql:[^ ]* NOTICE:  /  /'
done
