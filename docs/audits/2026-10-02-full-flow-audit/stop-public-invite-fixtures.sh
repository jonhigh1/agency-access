#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
STATE_PATH="$REPO_ROOT/docs/audits/2026-10-02-full-flow-audit/api-public-invite-runtime.json"

node - "$STATE_PATH" <<'NODE'
const fs = require('fs');
const { execFileSync } = require('child_process');
const state = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
try { process.kill(state.apiPid, 'SIGTERM'); } catch {}
try { execFileSync('pg_ctl', ['-D', state.postgresDataDir, '-m', 'fast', 'stop'], { stdio: 'ignore' }); } catch {}
fs.rmSync(state.postgresDataDir, { recursive: true, force: true });
fs.unlinkSync(process.argv[2]);
NODE
