# Visual QA — Ticket 06 (business_management + Partner narrative)

| Route / harness | Interaction | Result | Notes |
| --- | --- | --- | --- |
| `/dev/meta-invite/?scenario=portfolio-selection` (Vite evidence harness) | Confirm Business Portfolio → select Page → view selected identity summary | **Pass** | `portfolio-picker-selected-identity-desktop.png` — portfolio + asset name/ID visible; business-scoped discovery copy present |
| `/dev/meta-invite/?scenario=partial-follow-up` (harness) | Select ad account + page → Share Access → step 3 grant checklist | **Pass** | `grant-partner-narrative-desktop.png` — Partner narrative, agency Business Portfolio ID, Automatic (Pages) vs Manual (Ad accounts) |
| Live Meta OAuth / production Facebook login | — | **Skip** | Requires live Meta OAuth and disposable fixtures; not run in CI |

Evidence captured with Playwright against `evidence.vite.config.ts` preview on port 4174 (mock fetch; no live Graph).
