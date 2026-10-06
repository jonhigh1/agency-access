# Visual QA — ticket 07 (Automatic Pages partner + read-back)

| Route | Result | Notes |
| --- | --- | --- |
| `/visual-qa/07-automatic-pages-partner-readback` | **Pass** | Fixture exercises Grant Access → granted/failed states with Manual fallback copy. Use buttons to simulate read-back outcomes. |
| `/invite/[token]` live Meta Graph grant | **Skip** | Requires live Meta OAuth |

Human checklist (CEO/EL before merge): confirm production Grant Access posts assigned_users + Page agencies partner mutations and only marks success after read-back.

**BM portfolio-level Partner link** remains **Manual** (`ensureManagedBusinessRelationship` does not mutate Graph); UI labels match ticket 04/06 honesty matrix.
