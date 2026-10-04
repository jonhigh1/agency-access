#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
AUDIT_DIR="$REPO_ROOT/docs/audits/2026-10-02-full-flow-audit"
PGDATA="$(mktemp -d -t authhub-granted-assets.XXXXXX)"
PORT=55440

cleanup() {
  if [ -f "$PGDATA/postmaster.pid" ]; then
    pg_ctl -D "$PGDATA" -m fast stop >/dev/null 2>&1 || true
  fi
  rm -rf "$PGDATA"
}
trap cleanup EXIT

if lsof -nP -iTCP:"$PORT" -sTCP:LISTEN >/dev/null 2>&1; then
  echo "Local concurrency port $PORT is already in use" >&2
  exit 1
fi

initdb -D "$PGDATA" --auth=trust --username=postgres >/dev/null
pg_ctl -D "$PGDATA" -o "-h 127.0.0.1 -p $PORT" -w start >/dev/null
psql -h 127.0.0.1 -p "$PORT" -U postgres -d postgres -v ON_ERROR_STOP=1 \
  -c 'CREATE DATABASE authhub_granted_assets' >/dev/null

export DATABASE_URL="postgresql://postgres@127.0.0.1:$PORT/authhub_granted_assets?schema=public"
export GRANTED_ASSETS_CONCURRENCY_REPORT_PATH="$AUDIT_DIR/granted-assets-concurrency.json"
cp "$REPO_ROOT/apps/api/prisma/schema.prisma" "$PGDATA/schema.prisma"
(
  cd "$PGDATA"
  "$REPO_ROOT/apps/api/node_modules/.bin/prisma" db push --schema "$PGDATA/schema.prisma" --skip-generate >/dev/null
)
"$REPO_ROOT/node_modules/.bin/tsx" --tsconfig "$REPO_ROOT/apps/api/tsconfig.json" \
  "$AUDIT_DIR/granted-assets-concurrency-harness.ts"
