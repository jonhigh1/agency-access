# Google Authorization Fulfillment Truthfulness

## Problem
The client invite flow treated Google OAuth success as if the requested Google access had been fully granted. That was incorrect for grouped Google requests because a client could authenticate successfully without selecting any Google Ads accounts, GA4 properties, or other requested Google assets.

## Root Cause
- Invite/runtime progress used platform-group authorization presence as the completion signal.
- Google asset-selection state existed in the UI, but completion semantics did not require it.
- The backend had no durable way to distinguish:
  - assets existed but the client selected none
  - no assets were discoverable for the requested Google product

## Resolution
- Added additive product-level fulfillment detail to `authorizationProgress`:
  - `fulfilledProducts`
  - `unresolvedProducts`
- Introduced backend fulfillment evaluation that treats Google as fulfilled only when each requested Google product has at least one selected asset.
- Added `availableAssetCount` to saved Google asset selections so the backend can distinguish `selection_required` from `no_assets`.
- Updated `POST /client/:token/complete` to finalize as:
  - `completed` when all requested products are fulfilled
  - `partial` when unresolved requested Google products remain
- Updated invite success UI and agency request-detail UI to surface follow-up-needed states truthfully.

## Prevention
- For grouped OAuth platforms, never use raw OAuth authorization as the only completion signal when downstream product/account selection exists.
- Persist enough discovery metadata to separate empty inventory from empty user choice.
- Keep completion semantics centralized in the service layer so invite runtime, agency views, and lifecycle webhooks do not drift.

## Verification
- API service tests cover:
  - Google not complete from OAuth alone
  - Google complete only after saved product selections
  - zero-assets Google products remaining unresolved
- Client-auth route tests cover `partial` vs `completed` finalization.
- Invite page test covers partial success messaging.
- Request-detail component test covers unresolved-product visibility for agencies.

## Related Sprint
- [`docs/sprints/2026-03-10-google-post-oauth-account-selection.md`](../sprints/2026-03-10-google-post-oauth-account-selection.md)
