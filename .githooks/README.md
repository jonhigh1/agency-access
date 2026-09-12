# .githooks/

Committed, versioned git hooks for this repo. Unlike `.git/hooks/`, this
directory survives clone/re-clone and is reviewed like any other source
file.

## Setup (one time per clone)

```bash
bash scripts/setup/install-git-hooks.sh
```

This runs `git config core.hooksPath .githooks` (idempotent — safe to
re-run). From then on, git reads hooks from here instead of `.git/hooks/`.

## What `pre-push` does

1. **Delegates to the Entire CLI hook first, unchanged.** The hook this file
   replaces (`.git/hooks/pre-push`) is a guarded call to
   `entire hooks git pre-push "$1"`. This file makes the identical call
   first, forwarding it the same stdin git gave us, and propagates its exit
   code as-is. If Entire blocks the push, our gate never runs.
2. **Only then gates pushes to `refs/heads/main`.** It parses the
   `<local-ref> <local-sha> <remote-ref> <remote-sha>` lines git passes on
   stdin. Any push that does not update `refs/heads/main` (feature branches,
   tags, etc.) — and a deletion of `main` (all-zero local sha) — skips the
   build gate entirely and exits 0 immediately after the Entire delegate
   call.
3. **Builds the pushed commit, not your working tree.** For a push to
   `main`, it creates a temporary `git worktree` checked out at the exact
   SHA being pushed, runs the gate there, and removes the worktree on exit
   (success or failure) via a trap. This is deliberate: a past production
   incident shipped a broken Render deploy because the pushed commit was
   missing local-only changes that only existed in the working tree — a
   gate that built the working tree instead of the pushed ref would not
   have caught it. See
   `docs/solutions/meta-business-login-production-rollout.md`.
4. **Runs the same checks CI/Render care about:** `npm run typecheck` then
   `npm run build`, with `packages/shared` built and `apps/api`'s Prisma
   client generated first (see "Dependency provisioning" below) — mirroring
   the shared → api → web sequence in `render.yaml`'s `buildCommand`.
   Tests are intentionally **not** run here (mixed runners, a vitest
   watch-mode entry point) — they run in the CI gate instead.
5. **Blocks the push on failure** with a one-line message naming the
   failure and reminding you of the bypass below. Exits non-zero.

## Dependency provisioning: why `npm ci`, not a symlink

The worktree needs its own `node_modules` to run `tsc`/`next build`. Two
options were considered:

- **Symlink the host's hoisted root `node_modules` in.** Fast, but wrong
  here: this repo's npm workspaces hoist local packages
  (`@agency-platform/shared`, `@agency-platform/api`, `@agency-platform/web`)
  into `node_modules/@agency-platform/*` as symlinks that point at the
  *host checkout's* `packages/shared` / `apps/api` / `apps/web`, not the
  worktree's. Reusing that symlink farm would silently validate whatever
  `packages/shared` happens to look like in your working tree — exactly the
  failure mode this gate exists to catch (see incident note above). It also
  risks `prisma generate` writing into a symlinked `node_modules/.prisma`
  and mutating the *host's* generated Prisma client as a side effect of a
  push.
- **`npm ci` inside the worktree (chosen).** Slower — expect the gate to
  add roughly one to a few minutes to a push to `main`, depending on npm
  cache warmth — but fully isolated: it installs from the pushed
  `package-lock.json`, npm sets up the workspace symlinks to point at the
  worktree's own copies, and nothing outside the temporary worktree
  directory is ever written to.

If this becomes a bottleneck, the next lever is a shared npm cache
directory (`npm ci --cache <persistent-dir>`) rather than reintroducing a
symlink into the host tree.

## Emergency bypass

```bash
git push --no-verify
```

This skips **all** hooks, including the Entire CLI delegate and this build
gate. Use it when you need to push through a known-broken gate (e.g. a
flaky/slow environment issue) — not to routinely skip failing typecheck or
build errors. The gate re-runs on your next normal push either way; CI is
the backstop if you bypass it here.
