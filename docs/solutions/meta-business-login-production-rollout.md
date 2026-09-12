# Meta Business Login Production Rollout

## Problem
The Meta Business Login JS SDK cutover appeared complete in code, but production failed in multiple operational stages:

- the frontend showed `Meta Business Login is not configured. Add the Meta app ID and config ID.`
- Meta then rejected JS SDK login because `Login with the JavaScript SDK` was not enabled
- after JS SDK login succeeded, the API returned `Route POST:/agency-platforms/meta/business-login/finalize not found`
- Render deploys failed because the pushed backend code was missing the `MetaConnector.getTokenMetadata()` implementation that the new finalize route depends on

## Root Cause
- The web app requires browser-visible Meta config and reads only:
  - `NEXT_PUBLIC_META_APP_ID`
  - `NEXT_PUBLIC_META_LOGIN_FOR_BUSINESS_CONFIG_ID`
- Vercel had the config ID stored under the wrong name:
  - `META_LOGIN_FOR_BUSINESS_CONFIG_ID`
  instead of:
  - `NEXT_PUBLIC_META_LOGIN_FOR_BUSINESS_CONFIG_ID`
- Meta app configuration was incomplete for the JS SDK flow:
  - `Facebook Login -> Settings -> Login with the JavaScript SDK` was not enabled
  - allowed JavaScript SDK domains were not yet aligned with `www.authhub.co` / `authhub.co`
- The frontend deployment was ahead of the API deployment. The frontend called the new finalize route before Render had a successful build containing it.
- The Render build failure was caused by an incomplete Git commit: local changes to `MetaConnector` existed, but the pushed backend code did not yet include `getTokenMetadata()`.

## Resolution
- Verified with the Vercel CLI that `www.authhub.co` is attached to the `agency-access` Vercel project and inspected production env vars directly.
- Corrected the frontend env contract so production uses:
  - `NEXT_PUBLIC_META_APP_ID`
  - `NEXT_PUBLIC_META_LOGIN_FOR_BUSINESS_CONFIG_ID`
- Enabled Meta JavaScript SDK login in the Meta app and added the production frontend domains to the allowed JS SDK domain list.
- Confirmed the API finalize route exists in:
  - `apps/api/src/routes/agency-platforms/oauth.routes.ts`
- Reproduced the Render build locally and isolated the missing uncommitted backend changes in:
  - `apps/api/src/services/connectors/meta.ts`
  - `apps/api/src/services/connectors/__tests__/meta.connector.test.ts`
  - `apps/api/src/lib/env.ts`
  - `apps/api/.env.example`
- Pushed the missing backend subset in commit `0b25246` so Render could build the finalize route successfully.

## Prevention
- Any frontend Meta Business Login change must be treated as a dual-deploy change:
  - Vercel public env/build
  - Render backend route/build
- For browser-run integrations, distinguish public identifiers from secrets:
  - public: app ID, Business Login config ID
  - private: app secret, exchanged tokens, system-user tokens
- When using `NEXT_PUBLIC_*` variables, verify the exact production variable names in Vercel CLI before debugging application code.
- Before shipping a frontend flow that depends on a new backend route, verify the backend deploy is live by checking for route presence rather than assuming the latest commit built successfully.
- When fixing production issues from a dirty worktree, diff the exact files referenced by the failing build error before assuming the pushed commit contains all local changes.

## Verification
- `vercel env ls`
  Result: exposed the misnamed production config variable
- `vercel domains inspect www.authhub.co`
  Result: confirmed the active custom domain is attached to the expected Vercel project
- Local reproduction of the Render build command after restoring the missing connector changes:
  - `npm run build --workspace=packages/shared && cd apps/api && npm run db:generate && npm run build`
- Focused connector regression:
  - `npm run test:run --workspace=apps/api -- src/services/connectors/__tests__/meta.connector.test.ts`
- Live production validation:
  - JS SDK login launches successfully
  - frontend finalizes against the API route successfully
  - Meta Business Portfolio behavior works in production

## Affected Surfaces
- Web:
  - `apps/web/src/lib/meta-business-login.ts`
  - `apps/web/src/components/meta-business-portfolio-selector.tsx`
  - `apps/web/src/components/meta-unified-settings.tsx`
  - `apps/web/src/app/onboarding/platforms/page.tsx`
  - `apps/web/src/app/(authenticated)/connections/page.tsx`
- API:
  - `apps/api/src/routes/agency-platforms/oauth.routes.ts`
  - `apps/api/src/services/connectors/meta.ts`

## Rollout Notes
- No database migration was required.
- No token-storage model changed during the rollout; durable Meta tokens still remain backend-only in Infisical.
- The operational dependencies for this flow are now explicit:
  - Vercel production env vars with the exact `NEXT_PUBLIC_*` names
  - Meta app JS SDK login enabled
  - allowed JS SDK domains configured
  - Render build green on the finalize-route backend commit

## Related Sprints
- [`docs/sprints/2026-03-11-meta-business-login-js-sdk.md`](../sprints/2026-03-11-meta-business-login-js-sdk.md)
- [`docs/sprints/2026-03-11-meta-business-portfolio-modal.md`](../sprints/2026-03-11-meta-business-portfolio-modal.md)
