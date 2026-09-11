#!/usr/bin/env bash
# One-time setup: point this clone's git hooks at the committed .githooks/
# directory instead of the machine-local (and un-versioned) .git/hooks/.
#
# Safe to re-run — `git config core.hooksPath` is idempotent.
#
# Usage: bash scripts/setup/install-git-hooks.sh
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

if ! git -C "$REPO_ROOT" rev-parse --git-dir >/dev/null 2>&1; then
  echo "[install-git-hooks] Not inside a git repository: $REPO_ROOT" >&2
  exit 1
fi

git -C "$REPO_ROOT" config core.hooksPath .githooks

chmod +x "$REPO_ROOT/.githooks"/* 2>/dev/null || true

CONFIGURED="$(git -C "$REPO_ROOT" config core.hooksPath)"
echo "[install-git-hooks] core.hooksPath = $CONFIGURED"
echo "[install-git-hooks] Git hooks installed. Pushes to main now run 'npm run typecheck && npm run build'"
echo "[install-git-hooks] against a clean worktree checkout of the pushed commit before leaving this machine."
echo "[install-git-hooks] Emergency bypass: git push --no-verify. See .githooks/README.md for details."
