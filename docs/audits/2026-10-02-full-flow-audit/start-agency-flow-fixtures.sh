#!/usr/bin/env bash
set -euo pipefail
REPO_ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
AUDIT_DIR="$REPO_ROOT/docs/audits/2026-10-02-full-flow-audit"
TASK_DIR="$(mktemp -d -t authhub-agency-runtime.XXXXXX)"
trap 'rm -rf "$TASK_DIR"' EXIT
export DATABASE_URL='postgresql://postgres@127.0.0.1:55439/authhub_public_invites?schema=public'
export AGENCY_FIXTURE_MANIFEST="$AUDIT_DIR/agency-flow-fixtures.json"
export NODE_ENV=development
export BACKGROUND_WORKERS_ENABLED=false
export CLERK_PUBLISHABLE_KEY=local-placeholder CLERK_SECRET_KEY=local-placeholder
export INFISICAL_CLIENT_ID=local-placeholder INFISICAL_CLIENT_SECRET=local-placeholder INFISICAL_PROJECT_ID=local-placeholder
export META_APP_ID=local-placeholder META_APP_SECRET=local-placeholder
export CREEM_API_KEY=local-placeholder CREEM_WEBHOOK_SECRET=local-placeholder
export FRONTEND_URL=http://localhost:3100
cd "$TASK_DIR"
"$REPO_ROOT/node_modules/.bin/tsx" --tsconfig "$REPO_ROOT/apps/api/tsconfig.json" "$AUDIT_DIR/api-agency-flow-server.ts"
