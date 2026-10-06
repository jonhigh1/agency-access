# Visual QA aggregate — Meta App Review P0 (ticket 12)

**Purpose:** Single Pass / Fail / Skip table across P0 invite-related routes for CEO merge review.  
**Rule:** Human-gated Meta OAuth / live Graph rows stay **Skip** in automation until the [human Visual QA checklist](../../../visual-qa/README.md) (EL package) is checked.

| Ticket | Route / harness | Interaction | Result | Notes / artifact |
| --- | --- | --- | --- | --- |
| 01 | `/invite/[token]` → Meta OAuth consent (production/staging) | Confirm v25.0 + four scopes | **Skip** | Requires live Meta OAuth — [ticket-01-production-oauth-dialog-verification.md](./ticket-01-production-oauth-dialog-verification.md) |
| 01 | OAuth URL builder (automated) | Inspect `scope` + dialog path | **Pass** | Connector + shared contract tests; smoke suite |
| 02 | Server Graph ops (no UI route) | Caption envelope on API calls | **Pass** | `meta-graph-instrumentation.test.ts` |
| 03 | `/test/asset-creation` (section 5 — invite-equivalent) | Empty portfolio → Page list → primary → BM unlock | **Pass** | [ticket-03-zero-portfolio-pages-show-list.md](../../visual-qa/ticket-03-zero-portfolio-pages-show-list.md) |
| 03 | `/invite/[token]` live zero-portfolio fixture | Full OAuth + `/me/accounts` | **Skip** | Requires disposable zero-portfolio Facebook identity |
| 04 | `/visual-qa/04-ads-management-honesty` | Manual badges, Business ID, Check access | **Pass** | [ticket-04-ads-management-honesty/README.md](../../visual-qa/ticket-04-ads-management-honesty/README.md) |
| 04 | `/invite/[token]` grant step (live Meta partner share) | Manual AA + verify | **Skip** | Requires live Meta OAuth |
| 05 | `visual-qa/05-harden-validate-page-engagement/success-state.html` | Validate Page success card | **Pass** | Dates only — [README](../../visual-qa/05-harden-validate-page-engagement/README.md) |
| 05 | `/dev/meta-page-proof` | Click Validate Page access | **Skip** | Clerk client init blocks headless CI VM |
| 05 | `/invite/[token]` live Validate Page | Real Page token | **Skip** | Requires live Meta OAuth |
| 06 | `/dev/meta-invite/?scenario=portfolio-selection` | Portfolio + asset identity | **Pass** | [06-business-management-partner-narrative/README.md](../../visual-qa/06-business-management-partner-narrative/README.md) |
| 06 | `/dev/meta-invite/?scenario=partial-follow-up` | Grant checklist Partner narrative | **Pass** | Automatic (Pages) vs Manual (Ad accounts) |
| 06 | Live Meta OAuth / production Facebook login | — | **Skip** | Requires live Meta OAuth and disposable fixtures |
| 10 | `/dev/meta-invite` connection-error harness | Error panels (5 codes) | **Pass** | [10-connection-error-ux/README.md](../../visual-qa/10-connection-error-ux/README.md) |
| 10 | Live Meta Graph error surfaces | — | **Skip** | Requires live Meta failures |

## Aggregate counts (P0 invite scope)

| Result | Count |
| --- | ---: |
| **Pass** | 8 |
| **Fail** | 0 |
| **Skip** | 7 |

**Overall:** **PARTIAL** — automated harnesses **Pass**; live Meta / CEO fixture rows **Skip** until human checklist before merge/deploy.

## Result

**PASS (engineering Visual QA aggregate)** with documented **Skip** rows — not a substitute for CEO live OAuth verification before App Review recording.
