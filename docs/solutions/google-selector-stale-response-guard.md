# Google Selector Stale Response Guard

## Problem
The Google invite selector could accept an older in-flight asset response after the client had already moved to a different Google product or a different OAuth session. Once `availableAssetCount` started driving zero-assets truthfulness, that race could publish the wrong inventory state and incorrectly unlock the Step 2 continue path.

## Root Cause
- `GoogleAssetSelector` fetched assets in an effect keyed by `sessionId`, `product`, and `accessRequestToken`, but it did not cancel or ignore earlier requests when those inputs changed.
- The selector now emits `availableAssetCount` immediately after load, so any stale response could overwrite the active product/session state instead of being a harmless late render.
- The UI had no request sequencing guard to ensure only the latest fetch could mutate `assets`, `error`, or `isLoading`.

## Resolution
- Added a monotonically increasing request token in `GoogleAssetSelector` and captured it per fetch attempt.
- Guarded every state write in the fetch lifecycle so only the latest request can update:
  - `assets`
  - `error`
  - `isLoading`
- Invalidated outstanding requests on unmount so late responses from a previous selector instance are ignored.

## Prevention
- Any selector or invite surface that derives readiness from async inventory must treat stale responses as correctness bugs, not just UX noise.
- When effect inputs can change while a request is in flight, either:
  - cancel the request with an abort signal, or
  - sequence requests and ignore any response that is no longer current
- If loaded metadata influences gating or completion semantics, add a focused race test before changing the fetch lifecycle.

## Verification
- Added `GoogleAssetSelector` coverage proving a stale Google Ads response cannot overwrite a newer Business Profile zero-assets load.
- Re-ran adjacent invite truthfulness coverage to confirm the guard did not regress follow-up messaging or request-detail rendering.

## Affected Surfaces
- Web component: `apps/web/src/components/client-auth/GoogleAssetSelector.tsx`
- Invite flow behavior: `apps/web/src/components/client-auth/PlatformAuthWizard.tsx`
- Agency request detail visibility remained covered through `request-platforms-card` regression checks

## Rollout Notes
- No API, migration, or token-storage changes.
- No screenshot evidence was needed because this was a race-condition fix with no visual delta.

## Related Sprints
- [`docs/sprints/2026-03-10-google-account-discovery-hardening.md`](../sprints/2026-03-10-google-account-discovery-hardening.md)
- [`docs/sprints/2026-03-10-google-post-oauth-account-selection.md`](../sprints/2026-03-10-google-post-oauth-account-selection.md)
