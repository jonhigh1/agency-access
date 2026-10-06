#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
AUDIT_DIR="$REPO_ROOT/docs/audits/2026-10-02-full-flow-audit"
PGDATA="$(mktemp -d -t authhub-manual-confirmation.XXXXXX)"
PORT=55441
REPORT_PATH="$AUDIT_DIR/manual-confirmation-persistence.json"

cleanup() {
  if [ -f "$PGDATA/postmaster.pid" ]; then
    pg_ctl -D "$PGDATA" -m fast stop >/dev/null 2>&1 || true
  fi
  rm -rf "$PGDATA"
}
trap cleanup EXIT

if lsof -nP -iTCP:"$PORT" -sTCP:LISTEN >/dev/null 2>&1; then
  echo "Local manual confirmation port $PORT is already in use" >&2
  exit 1
fi

initdb -D "$PGDATA" --auth=trust --username=postgres >/dev/null
pg_ctl -D "$PGDATA" -o "-h 127.0.0.1 -p $PORT" -w start >/dev/null
psql -h 127.0.0.1 -p "$PORT" -U postgres -d postgres -v ON_ERROR_STOP=1 \
  -c 'CREATE DATABASE authhub_manual_confirmation' >/dev/null

cp "$REPO_ROOT/apps/api/prisma/schema.prisma" "$PGDATA/schema.prisma"
export DATABASE_URL="postgresql://postgres@127.0.0.1:$PORT/authhub_manual_confirmation?schema=public"
export MANUAL_CONFIRMATION_REPORT_PATH="$REPORT_PATH"
export NODE_ENV=test
export BACKGROUND_WORKERS_ENABLED=false
export CLERK_PUBLISHABLE_KEY=local-placeholder
export CLERK_SECRET_KEY=local-placeholder
export INFISICAL_CLIENT_ID=local-placeholder
export INFISICAL_CLIENT_SECRET=local-placeholder
export INFISICAL_PROJECT_ID=local-placeholder
export META_APP_ID=local-placeholder
export META_APP_SECRET=local-placeholder
export CREEM_API_KEY=local-placeholder
export CREEM_WEBHOOK_SECRET=local-placeholder
export FRONTEND_URL=http://127.0.0.1:3000

(
  cd "$PGDATA"
  "$REPO_ROOT/apps/api/node_modules/.bin/prisma" db push --schema "$PGDATA/schema.prisma" --skip-generate >/dev/null
  "$REPO_ROOT/node_modules/.bin/tsx" --tsconfig "$REPO_ROOT/apps/api/tsconfig.json" \
    "$AUDIT_DIR/manual-confirmation-harness.ts"
)
