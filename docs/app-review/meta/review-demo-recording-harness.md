# Meta App Review — Playwright recording harness

Agent-owned screencast capture for `/review-demo` (issue **#132**, build spec **#135** §D). The screencast **verifier** is issue **#133** / §E.

## Outputs

| Item | Location |
|------|----------|
| Run folder | `artifacts/meta-app-review/screencasts/<run-id>/` (override with `META_REVIEW_RECORDING_OUT_DIR`) |
| Per-permission video | `<permission>.webm` — `pages_show_list`, `pages_read_engagement`, `ads_management`, `business_management` |
| Run manifest | `manifest.json` — permission → file, width/height, 1080p flag, burned-in `captionPrimary`, optional duration/hash |
| Verification report | `verification-report.txt` — human-readable pass/fail (written by verifier) |
| Submit pack marker | `submit-pack-ready.json` — only when verify passes with `--mark-submit-pack-ready` |

Videos are recorded at **1920×1080** viewport with a **burned-in caption bar** (`data-testid="review-demo-recording-caption"`) naming the permission and action. Step driving uses stable `/review-demo` test ids (see `apps/web/scripts/review-demo-recording/manifest.mjs`).

## Prerequisites

- Node 24 + repo `npm ci`
- Playwright Chromium: from `apps/web`, run `npx playwright install chromium`
- Optional: `ffprobe` (ffmpeg) for post-run resolution checks in the harness log

### Web + API (local mock path — CI wiring / dry run)

**API (`apps/api/.env`)**

- `META_REVIEW_DEMO_ENABLED=true`
- `META_REVIEW_DEMO_MOCK_GRAPH=true` — fixture Graph payloads; session reports connected without live Meta tokens
- `META_REVIEW_LAB_USER_IDS` — include the lab Clerk user id

**Web (`apps/web/.env.local`)**

- `NEXT_PUBLIC_META_REVIEW_DEMO_ENABLED=true`
- `NEXT_PUBLIC_META_REVIEW_LAB_USER_IDS` — same Clerk id(s)
- `NEXT_PUBLIC_API_URL=http://127.0.0.1:3001`

Start stack from repo root: `npm run dev`.

### Live review host (production Meta app `1215220247221414`)

- Host: **https://review.authhub.co**
- `META_REVIEW_DEMO_MOCK_GRAPH=false` on API; real Meta OAuth + Infisical token storage
- Lab reviewer Clerk user (example from ops): `jon.highmu+lab-reviewer@gmail.com` / `user_3KLeCX4cZ6OTWYjNm8Y9Z5dqdnC`
- Clerk `public_metadata`: `labRole: reviewer` or `lab: true`
- Meta reviewer credentials in vault/env only — **never commit**

## Clerk auth for automation

The harness must arrive at `/review-demo` as a lab user.

**Recommended:** sign in once headfully, save Playwright storage state:

```bash
export META_REVIEW_CLERK_STORAGE_STATE="$HOME/.authhub/review-demo-clerk.json"
export META_REVIEW_CLERK_EMAIL="jon.highmu+lab-reviewer@gmail.com"
export META_REVIEW_CLERK_PASSWORD="…from vault…"
# First run saves storage state; later runs reuse it.
```

**Alternative:** set only `META_REVIEW_CLERK_STORAGE_STATE` to an existing state file.

Set `META_REVIEW_LAB_CLERK_USER_ID` (or `NEXT_PUBLIC_META_REVIEW_LAB_USER_IDS`) to the lab reviewer Clerk id. Backend `CLERK_SECRET_KEY` is required when minting sessions from scripts under `apps/api/.env`.

## Run recordings

From `apps/web`:

```bash
# Headful on agent desktop (default for capture — set headless only for smoke)
export META_REVIEW_RECORDING_HEADLESS=false
export META_REVIEW_RECORDING_BASE_URL=http://127.0.0.1:3000   # or https://review.authhub.co

npm run review-demo:record
```

### Verify screencasts (blocks submit pack when red)

From `apps/web`:

```bash
# After recording — pass the run folder or latest run under artifacts/
npm run review-demo:verify -- --run-dir ../../artifacts/meta-app-review/screencasts/<run-id>

# Or pin run id (same env as recording)
export META_REVIEW_RECORDING_RUN_ID=<run-id>
npm run review-demo:verify

# Latest run folder that contains manifest.json
npm run review-demo:verify -- --latest

# Optional: write submit-pack-ready.json when green (never submits to Meta)
npm run review-demo:verify -- --latest --mark-submit-pack-ready
```

**Green verifier exit = submit pack may be marked ready for CEO Meta Submit.** Red exit = do not mark ready; fix recordings and re-run. The verifier checks all four permissions (or one with `--smoke`), file presence, ≥1080p (ffprobe or harness manifest), and caption metadata (`captionPrimary` / sidecar) — not Meta upload.

Smoke (first permission only, shorter CI/agent check when stack + auth are up):

```bash
npm run review-demo:record -- --smoke
```

Optional env:

| Variable | Purpose |
|----------|---------|
| `META_REVIEW_RECORDING_RUN_ID` | Stable folder name under artifacts root |
| `META_REVIEW_RECORDING_OUT_DIR` | Override artifacts root |
| `META_REVIEW_RECORDING_HEADLESS=false` | Headful capture (recommended for Meta submission) |
| `META_REVIEW_MIN_VIDEO_DURATION_SEC` | Minimum seconds per clip (default `3`; requires ffprobe or manifest `durationSec`) |

## Headful on box / CI agent desktop

- Set `META_REVIEW_RECORDING_HEADLESS=false` and run under a display (local desktop or cloud agent with GUI).
- Launch Chromium non-headless so Meta OAuth popups remain visible when not using mock Graph.
- For mock Graph CI wiring, keep headless `true` and use saved Clerk storage state.

## Re-running after fixture refresh

Shot list is **data-driven** in `manifest.mjs` (aligned with `REVIEW_DEMO_STEP_ORDER` in `@agency-platform/shared`). Updating sandbox IDs or copy in API fixtures does not require editing the recorder—re-run the script after fixtures change.

## Related docs

- `/review-demo` route flags: [review-demo-route.md](./review-demo-route.md)
- Build spec: GitHub issue #135 §D
