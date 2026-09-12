# Grouped OAuth Product Expansion With Truthful Fulfillment

## Problem
Adding a new product under an existing grouped OAuth platform can look deceptively small: add a product ID, fetch some assets, and render a selector. In practice, that routinely creates false completion states because the platform was originally modeled as "OAuth complete" rather than "requested product fulfilled."

The LinkedIn Pages sprint exposed the full version of that problem. The repo already supported LinkedIn Ads under the `linkedin` group, but adding `linkedin_pages` required distinct scopes, distinct discovery endpoints, distinct Step 2 selection behavior, and truthful partial completion when the user connected LinkedIn successfully but had no selectable pages or selected none.

## Root Cause
- The grouped-platform model was originally ads-focused for LinkedIn, so OAuth scope resolution was not request-aware for pages.
- Completion semantics were already moving toward product-level fulfillment, but a new grouped product still needed explicit participation in:
  - shared product modeling
  - OAuth scope union
  - asset discovery routing
  - saved zero-assets metadata
  - fulfillment evaluation
  - invite and agency-side unresolved-product rendering
- LinkedIn Pages are organization entities discovered through `organizationAcls` plus organization hydration, not through the existing ad-account surface.

## Resolution
- Added `linkedin_pages` as a first-class product under the existing `linkedin` platform group across shared contracts and labels.
- Made LinkedIn OAuth scope resolution product-aware:
  - ads-only requests stay on `rw_ads` + `r_ads_reporting`
  - page requests add `rw_organization_admin`
  - mixed requests use the additive union
- Implemented a separate LinkedIn page discovery path using the organization admin surfaces:
  - enumerate administered organizations from `organizationAcls`
  - hydrate organization details from `organizations/{id}`
  - normalize selector-ready page records with stable IDs, URNs, and display names
- Extended the LinkedIn selector and wizard Step 2 flow so `linkedin_pages` behaves like other asset-selecting products instead of being treated as fulfilled by OAuth alone.
- Persisted `availableAssetCount` for `linkedin_pages` so the backend can distinguish:
  - assets existed but none were selected
  - no assets were discoverable
- Routed `linkedin_pages` through the shared fulfillment evaluator so final request state resolves truthfully as `completed` or `partial`, and agencies can see unresolved follow-up on request detail.
- Added repeatable browser-evidence capture for the changed invite and request-detail states.

## Prevention
- When adding a product beneath an existing OAuth platform group, treat it as a six-surface change by default:
  - product model
  - OAuth scopes
  - asset discovery
  - saved selection metadata
  - fulfillment evaluator
  - UI/runtime status rendering
- Never assume platform-level OAuth success fulfills a grouped product that still requires downstream asset selection.
- Persist empty-inventory truth explicitly. `availableAssetCount` or an equivalent additive field is required if redirects, refreshes, or delayed completion can happen after discovery.
- Keep vendor-specific discovery isolated per product. Reusing an adjacent product's endpoint is usually wrong once the vendor splits ads, organizations, pages, or business entities across separate APIs.
- For UI-heavy invite changes, keep screenshot capture reproducible. A stable preview harness is more durable than relying on an interactive dev session.

## Verification
- Shared types expose `linkedin_pages` and its LinkedIn group membership.
- OAuth route tests prove LinkedIn scope union for ads-only, pages-only, and mixed requests.
- Client asset route tests cover selector-ready LinkedIn Page discovery, pinned version headers, and token-read audit logging.
- Service tests prove `linkedin_pages` remains unresolved when zero pages are available and is not fulfilled by OAuth alone.
- Wizard tests cover Step 2 page selection, zero-page follow-up, and mixed LinkedIn Ads + Pages states.
- Agency request-detail tests cover unresolved LinkedIn Pages visibility.
- Browser evidence was regenerated through the scripted preview harness for desktop and mobile invite/request-detail states.

## Affected Surfaces
- Shared contracts: `packages/shared/src/types.ts`
- OAuth scope resolution: `apps/api/src/routes/client-auth/oauth-state.routes.ts`
- LinkedIn asset discovery: `apps/api/src/services/client-assets.service.ts`
- Client asset route + persistence: `apps/api/src/routes/client-auth/assets.routes.ts`
- Fulfillment evaluation: `apps/api/src/services/access-request.service.ts`
- Client/runtime aggregation: `apps/api/src/services/client.service.ts`
- Invite wizard + selector UI: `apps/web/src/components/client-auth/PlatformAuthWizard.tsx`, `apps/web/src/components/client-auth/LinkedInAssetSelector.tsx`
- Agency request detail: `apps/web/src/components/access-request-detail/request-platforms-card.tsx`
- Browser evidence harness: `apps/web/scripts/capture-linkedin-page-support-evidence.mjs`, `apps/web/evidence/linkedin-page-support-preview.tsx`

## Rollout Notes
- This solution is selection-first only. It does not automate LinkedIn Page role assignment for the agency.
- Discovery intentionally stays scoped to organizations the OAuth user can administer through the approved LinkedIn organization-admin surface.
- The same pattern should be reused for future grouped-platform expansion where a new product needs:
  - narrower or broader scopes than adjacent products
  - a different vendor discovery surface
  - truthful `partial` completion when zero assets exist

## Related Sprints
- [`docs/sprints/2026-03-10-cross-platform-post-oauth-fulfillment.md`](../sprints/2026-03-10-cross-platform-post-oauth-fulfillment.md)
- [`docs/sprints/2026-03-10-linkedin-page-support.md`](../sprints/2026-03-10-linkedin-page-support.md)
