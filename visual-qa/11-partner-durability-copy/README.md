# Visual QA — Ticket 11 (Partner durability + Allowed usage alignment)

| Route / surface | Interaction | Result | Notes |
| --- | --- | --- | --- |
| `/visual-qa/11-partner-durability-copy` | Review agency Partner panel + grant checklist narrative | **Pass** | `grant-partner-durability-desktop.png`, `agency-meta-settings-partner-copy-desktop.png` — OAuth orchestration, revoke = remove Partner, Automatic (Pages) vs Manual (Ad accounts) |
| `/invite/[token]` live Meta OAuth | — | **Skip** | Requires live Meta OAuth |

Evidence captured with Playwright against local Next dev (mock checklist; no live Graph).
