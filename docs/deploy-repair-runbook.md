# Deploy-repair runbook

Operator runbook for the self-healing deploy pipeline (`.github/workflows/deploy-repair.yml`
plus `apps/api/scripts/deploy-repair/` and `apps/api/scripts/deploy-status/`). It detects a
failed production deploy of `apps/web` (Vercel) or `apps/api` (Render), diagnoses build-time
failures with a bounded autonomous repair agent, and reports the outcome on a GitHub tracking
issue — no dashboard-watching required.

This document is operator-facing (setup, replay, drills, failure recovery). It does not
duplicate the module-level design notes already in `apps/api/scripts/deploy-repair/*.ts` and
`.github/workflows/deploy-repair.yml`'s own comments — read those for the "why," this for the
"what do I do."

## a. One-time setup

### Git hooks

Install the committed pre-push gate once per clone:

```bash
bash scripts/setup/install-git-hooks.sh
```

See `.githooks/README.md` for exactly what the hook does and its `git push --no-verify`
emergency bypass (also covered in section (e) below).

### GitHub secrets

The `deploy-repair` workflow's `incident` job fails fast if any of these are missing
(`Validate deploy-repair secrets` step) — set all three as repository (or environment) secrets
before relying on this pipeline for a real incident:

| Secret | Where to get it |
| --- | --- |
| `VERCEL_TOKEN` | A project-scoped access token generated from the Vercel dashboard's token settings for the account/project this repo deploys `apps/web` to. Scope it to the project if Vercel's UI offers that option, rather than an account-wide token. |
| `RENDER_API_KEY` | An API key from the Render account's account-level API key settings (the account that owns the `agency-access-api` service defined in `render.yaml`). |
| `ANTHROPIC_API_KEY` | An API key generated from the Anthropic console, used to run the bounded `claude -p --bare` repair session (see `apps/api/scripts/deploy-repair/repair-session.ts`). |

The `repair` job also needs `PERF_CLERK_SECRET_KEY` / `PERF_CLERK_PUBLISHABLE_KEY` (reused from
`dashboard-perf-gate.yml`) so the in-loop gate's `apps/web` build has valid Clerk env vars — see
the workflow's own "Validate Clerk secrets for the repair-loop gate" step.

## b. Manually replaying an incident (R12)

Dispatch the workflow by hand via `workflow_dispatch` on `deploy-repair.yml`:

```bash
gh workflow run deploy-repair.yml \
  -f platform=vercel \
  -f deployment_url=<failing-deployment-url-or-render-service-id> \
  -f mode=repair
```

- `platform`: `vercel` or `render`.
- `deployment_url`: the failing Vercel deployment URL, or the Render service identifier.
- `mode`: `repair` (default), `dry-run`, or `drill`.

A `workflow_dispatch` run carries no commit SHA input — the incident job currently resolves the
SHA only for a `repository_dispatch` (Vercel webhook) trigger; a manual replay's SHA-resolution
lookup is a documented follow-up (see `incident.ts`'s `ShaTrigger` doc comment and the
workflow's own `TODO(follow-up)` comment on the `Read trigger inputs` step). Until that lookup
is wired in, a manual replay is most useful for exercising the pipeline's classification/gate
plumbing, not for resolving a specific historical SHA automatically.

## c. Running a drill (SC1)

A drill proves the pipeline produces a correct diagnosis and fix diff without touching
production. There is no separate drill *infrastructure* — `mode: drill` threads through
`repair-session.ts` and `attempt-loop.ts` unchanged (see those modules' doc comments: mode is
observed, not branched on, at that layer). The safety of a drill comes entirely from **where**
you run it:

1. Push a deliberately broken commit to a branch named `repair-drill/*` (never `main`).
2. Dispatch the workflow against that branch/commit with `mode: drill`:

   ```bash
   gh workflow run deploy-repair.yml \
     -f platform=vercel \
     -f deployment_url=<the-drill-branch-deployment-url> \
     -f mode=drill
   ```

3. Confirm the tracking issue and any repair commits land against the drill branch, not `main`.

**Residual gap, stated plainly:** no code in `attempt-loop.ts`, `repair-session.ts`, or the
workflow YAML inspects `mode` to block a commit/push to `main`. `mode: drill` is a label the
agent and the tracking issue read back — it does not change what `runAttemptLoop` does. The
only thing that keeps a drill from touching `main` is the operator's own discipline in step 1
above: running the drill against a `repair-drill/*` branch and pointing `deployment_url` at
that branch's own deployment. Treat this runbook step as the enforcement mechanism, because the
code does not provide one.

## d. When the loop gives up (`exhausted`)

`attempt-loop.ts` spends at most 3 attempts per incident (R8) before returning `outcome:
'exhausted'`. When this happens:

1. Open the tracking issue the `incident` job created (or deduped against) — it carries a
   "Deploy-repair attempt loop finished" comment with the outcome and a collapsible per-attempt
   detail block (diagnosis, gate result, push result, deploy-verification result for each
   attempt).
2. The previous production deployment is still serving traffic (R11) — an exhausted loop never
   leaves production on a broken deploy, so there is no user-facing urgency beyond fixing the
   underlying build failure.
3. Read each attempt's diagnosis to understand what the agent tried and why it didn't stick
   (gate failure, push rejection, or a redeploy that itself failed/timed out).
4. Fix manually, or push a corrected commit yourself — either resolves the same SHA the tracking
   issue is titled with, so a subsequent deploy of that fix closes the incident in the normal
   way (a fresh `resolveIncident` call for a new SHA opens a new issue; it does not silently
   reopen the exhausted one).

`outcome: 'aborted-push-failure'` and `outcome: 'no-repair-possible'` (a CLI crash or malformed
output, never retried per `attempt-loop.ts`) follow the same recovery: read the tracking issue,
fix by hand.

## e. Emergency bypass for the local gate (U1)

The committed `pre-push` hook (`.githooks/pre-push`) blocks a push to `main` that fails
`npm run typecheck && npm run build` against the exact pushed commit. To push through a known-
broken gate (e.g. a flaky local environment issue, not a routine way to skip a real failure):

```bash
git push --no-verify
```

This skips every hook, not just the build gate. See `.githooks/README.md` for the full
rationale — CI is the backstop if you bypass the local gate this way.

## f. Two environment facts to verify before the first real incident

The plan's own assumptions/risks flag two things about this repo's actual GitHub/Vercel
configuration that this unit did not (and could not) verify from inside a repair session.
Verify both before trusting this pipeline against a real production failure:

1. **Does `main` have branch protection?**

   ```bash
   gh api repos/{owner}/{repo}/branches/main --jq '{protected: .protected}'
   ```

   (Or check the GitHub UI under repo Settings → Branches.) If `main` is protected in a way that
   blocks direct pushes from `github-actions[bot]`, the `repair` job's push step
   (`attempt-loop.ts`'s `createNodeGitPusher`) will fail every attempt with a rejection, and
   every real incident will end in `aborted-push-failure` instead of `success`.

2. **Does Vercel skip deployments for bot-authored commits?**

   Vercel projects have a "Commit Author Access" (a.k.a. deployment-skip-for-bot) setting under
   the project's Git settings in the Vercel dashboard. If it is configured to ignore commits
   authored by `github-actions[bot]`, a repair commit this pipeline pushes will never trigger a
   new Vercel deployment at all — `wait-for-deploy.ts`'s poll will time out even though the fix
   was correct. Verify this setting in the Vercel project's Git settings before relying on the
   pipeline for a real Vercel incident; this document does not assume a specific current UI path
   for it since Vercel's dashboard changes independently of this repo.
