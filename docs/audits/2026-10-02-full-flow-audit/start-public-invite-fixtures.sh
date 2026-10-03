#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
AUDIT_DIR="$REPO_ROOT/docs/audits/2026-10-02-full-flow-audit"
STATE_PATH="$AUDIT_DIR/api-public-invite-runtime.json"
FIXTURE_PATH="$AUDIT_DIR/api-public-invite-fixtures.json"
LOG_PATH="$AUDIT_DIR/api-public-invite-server.log"
PGDATA="$(mktemp -d -t authhub-public-invites.XXXXXX)"
PGPORT=55439
APIPORT=3101

cleanup_on_failure() {
  if [ -f "$PGDATA/postmaster.pid" ]; then
    pg_ctl -D "$PGDATA" -m fast stop >/dev/null 2>&1 || true
  fi
  rm -rf "$PGDATA"
}
trap cleanup_on_failure ERR

for port in "$PGPORT" "$APIPORT"; do
  if lsof -nP -iTCP:"$port" -sTCP:LISTEN >/dev/null 2>&1; then
    echo "Required local fixture port $port is already in use" >&2
    exit 1
  fi
done

initdb -D "$PGDATA" --auth=trust --username=postgres >/dev/null
pg_ctl -D "$PGDATA" -o "-h 127.0.0.1 -p $PGPORT" -w start >/dev/null
psql -h 127.0.0.1 -p "$PGPORT" -U postgres -d postgres -v ON_ERROR_STOP=1 \
  -c 'CREATE DATABASE authhub_public_invites' >/dev/null
cp "$REPO_ROOT/apps/api/prisma/schema.prisma" "$PGDATA/schema.prisma"

export DATABASE_URL="postgresql://postgres@127.0.0.1:$PGPORT/authhub_public_invites?schema=public"
export PUBLIC_INVITE_FIXTURE_PATH="$FIXTURE_PATH"
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

(
  cd "$PGDATA"
  "$REPO_ROOT/apps/api/node_modules/.bin/prisma" db push --schema "$PGDATA/schema.prisma" --skip-generate >/dev/null
  nohup "$REPO_ROOT/node_modules/.bin/tsx" --tsconfig "$REPO_ROOT/apps/api/tsconfig.json" \
    "$AUDIT_DIR/api-public-invite-server.ts" >"$LOG_PATH" 2>&1 < /dev/null &
  API_PID=$!
  for _ in $(seq 1 30); do
    if curl --noproxy '*' --fail --silent "http://127.0.0.1:$APIPORT/api/health/local-invite-fixture" >/dev/null; then
      node -e "const fs=require('fs'); fs.writeFileSync(process.argv[1], JSON.stringify({apiHost:'127.0.0.1',apiPort:$APIPORT,apiPid:$API_PID,postgresHost:'127.0.0.1',postgresPort:$PGPORT,postgresDataDir:process.argv[2],fixtureFile:process.argv[3]}, null, 2)+'\\n')" "$STATE_PATH" "$PGDATA" "$FIXTURE_PATH"
      cat "$STATE_PATH"
      wait "$API_PID"
      exit 0
    fi
    sleep 1
  done
  kill "$API_PID" 2>/dev/null || true
  exit 1
)
trap - ERR
cat "$STATE_PATH"
