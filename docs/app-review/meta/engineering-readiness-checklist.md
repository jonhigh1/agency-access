# Meta App Review — engineering readiness (ticket 12)

**Status:** Engineering go/no-go for CEO screencast recording (not Meta submission)  
**Base commit:** `main` @ `cdba634` (P0 tickets 01–06 + ticket 10 merged; ticket 07 not required)  
**Draft submission:** `1424442432965860` · App ID `1215220247221414` · Graph **v25.0**

Engineering “done” means automated gates and documented Visual QA artifacts support CEO recording. It does **not** mean App Review is submitted, MP4s are uploaded, or production OAuth was re-verified on a live invite.

## Go / no-go summary

| Verdict | When |
| --- | --- |
| **GO (engineering)** | Every P0 row below is **Pass** or an documented **Skip** with human checklist pending; `npm run typecheck`, `npm run test`, and `npm run test:meta-app-review-p0-smoke` green on the release branch. |
| **NO-GO** | Any P0 **Fail**; smoke suite red; or CEO human Visual QA checklist incomplete for Skipped live-Meta rows before merge/deploy. |

## P0 gates

| ID | Gate | Pass criteria | Automated evidence | Visual QA | Result |
| --- | --- | --- | --- | --- | --- |
| 01 | Production OAuth lock (v25.0 + four scopes) | Dialog URL uses Graph v25.0; `scope` is exactly the core four; sanitizer strips `ads_read` / `catalog_management` | `packages/shared/src/__tests__/meta-app-review-p0-smoke.test.ts`; `packages/shared/src/__tests__/types.test.ts`; `apps/api/src/__tests__/meta-app-review-p0-smoke.test.ts`; `apps/api/src/services/connectors/__tests__/meta.connector.test.ts` (`getAuthUrl`) | Live consent: **Skip** — [ticket-01-production-oauth-dialog-verification.md](./ticket-01-production-oauth-dialog-verification.md) | **Pass** (automated) / **Skip** (live) |
| 02 | Caption-safe Graph op instrumentation | `{ method, edge, tokenClass, outcome }` recorded; no token material in serialized ops | `apps/api/src/lib/__tests__/meta-graph-instrumentation.test.ts`; `packages/shared` graph-op helpers | No dedicated route harness; validated via API tests + grant caption fields | **Pass** |
| 03 | Zero-portfolio `pages_show_list` branch | Empty BM → user Pages list → primary select → BM create unlock; `/me/accounts` on v25.0 | `npm run test:meta-app-review-p0-smoke` (MetaAssetSelector + `getUserPages`); `ZeroPortfolioPageDiscovery.test.tsx`; `meta.connector.test.ts` (`getUserPages`) | [visual-qa/ticket-03-zero-portfolio-pages-show-list.md](../../visual-qa/ticket-03-zero-portfolio-pages-show-list.md) | **Pass** (harness) / **Skip** (live invite) |
| 04 | `ads_management` honesty (Manual AA + Check access) | Ad accounts labeled Manual; Check access + agency Business ID visible | `AdAccountSharingInstructions.test.tsx`; `MetaGrantChecklist.test.tsx`; `meta-ad-account-instructions.test.ts` | [visual-qa/ticket-04-ads-management-honesty/README.md](../../visual-qa/ticket-04-ads-management-honesty/README.md) | **Pass** (fixture) / **Skip** (live partner share) |
| 05 | Validate Page (`pages_read_engagement`) | Dates-only feed; no post text; sanitized display | `MetaPageEngagementProof.test.tsx`; `sanitize-page-engagement-proof.test.ts`; `assets.meta.test.ts` (page engagement proof) | [visual-qa/05-harden-validate-page-engagement/README.md](../../visual-qa/05-harden-validate-page-engagement/README.md) | **Pass** (fixture) / **Skip** (live OAuth + `/dev/meta-page-proof` in CI VM) |
| 06 | `business_management` discovery + Partner narrative | Portfolio/asset IDs visible; Partner copy; Automatic (Pages) vs Manual (Ad accounts) | `meta-partner-grant-narrative.test.ts`; invite design tests | [visual-qa/06-business-management-partner-narrative/README.md](../../visual-qa/06-business-management-partner-narrative/README.md) | **Pass** (harness) / **Skip** (live Meta) |
| 10 | Connection-error UX (P1, merged) | Stable codes for incomplete permissions, not admin, 2FA, ownership, BM mismatch | `packages/shared/src/__tests__/meta-connection-error.test.ts`; `MetaConnectionErrorPanel.test.tsx` | [visual-qa/10-connection-error-ux/README.md](../../visual-qa/10-connection-error-ux/README.md) | **Pass** (fixtures) / **Skip** (live Graph errors) |
| 12 | P0 smoke suite wired to CI | Smoke fails on OAuth contract or zero-portfolio regressions | `scripts/meta-app-review-p0-smoke.mjs` in `npm run test:run` | N/A | **Pass** when green |

## CEO handoff — what remains after engineering

### Fixtures (CEO / ops)

| Fixture | Used for | Status |
| --- | --- | --- |
| Client with **no Business Portfolio** (Page manager only) | `pages_show_list.mp4` — must hit `GET /me/accounts`, not business-scoped Page pickers | **Required before that video** |
| Client with Business Portfolio + controlled Page / ad account | `business_management.mp4`, `pages_read_engagement.mp4`, `ads_management.mp4` | Required per shot list |
| Separate **agency** Business Portfolio identity | Partner share / Check access beats | Required for Manual AA screencast |
| Fresh non-expired invite URL per take | All four videos | CEO generates per recording plan |

### Videos (CEO only — not in this ticket)

Record four separate MP4s and attach to draft submission `1424442432965860`. Scene-by-scene requirements:

**[Meta screencast shot list](../../../docs/plans/2026-09-25-1224-meta-codex-browser-recording-plan.md#four-shot-lists)** (`pages_show_list`, `pages_read_engagement`, `business_management`, `ads_management`).

Also complete Allowed usage text, reviewer instructions, and API test-call checklists in the Meta developer dashboard. Upload and submit remain **CEO-gated**.

### Human Visual QA before merge/deploy

Complete the checklist in the EL package README (OAuth v25 + four scopes, zero-portfolio path, Validate Page dates-only, Manual AA labels, caption/receipt hygiene). Automated rows marked **Skip** above stay **Skip** in CI until Jon checks them on staging/production.

## Commands (release branch)

```bash
npm run typecheck
npm run test
npm run test:meta-app-review-p0-smoke   # scoped P0 smoke only
```

## References

- Decision record: Meta access parity spec (uploaded package / merged research)
- Permission matrix: [permission-matrix.md](./permission-matrix.md)
- Production acceptance (live run record): [production-acceptance.md](./production-acceptance.md)
- Visual QA aggregate: [visual-qa-aggregate-p0.md](./visual-qa-aggregate-p0.md)
