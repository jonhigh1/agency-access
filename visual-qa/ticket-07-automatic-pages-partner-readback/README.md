# Visual QA — ticket 07 (Automatic Pages partner + read-back)

| Route | Result | Notes |
| --- | --- | --- |
| `/visual-qa/07-automatic-pages-partner-readback` | **Pass** | Simulate granted/failed auto-runs mocked Grant Access and shows read-back success/failure banners. Page chips show names (full ID in tooltip). |
| `/invite/[token]` live Meta Graph grant | **Skip** | Requires live Meta OAuth |

Human checklist (CEO/EL before merge): confirm production Grant Access posts assigned_users + Page agencies partner mutations and only marks success after read-back.

**BM portfolio-level Partner link** remains **Manual** (`ensureManagedBusinessRelationship` does not mutate Graph); UI labels match ticket 04/06 honesty matrix.
