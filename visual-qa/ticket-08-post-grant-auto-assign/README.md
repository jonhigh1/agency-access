# Ticket 08 — Post-grant Auto-Assign Visual QA

| Route | Result | Notes |
| --- | --- | --- |
| `/visual-qa/08-post-grant-auto-assign` | Pass | Agency Auto-Assign picker + post-grant results fixture. Failed rows show **Retry failed assignments** (mock run + status message). |
| `/connections` (Meta Manage Assets) | Skip | Requires live Meta OAuth / agency BM for assignee list |
| Live Auto-Assign Graph mutation | Skip | Requires live Meta OAuth / agency BM |

Evidence: capture screenshots from `/visual-qa/08-post-grant-auto-assign` after `npm run dev:web`.
