# Visual QA — Meta access parity package

Human-gated checklist (CEO/EL before merge when automation Skipped live Meta):

- Fresh production or staging invite loads; Meta (not Google) success copy
- OAuth consent shows Graph **v25.0** and exactly: `ads_management`, `business_management`, `pages_read_engagement`, `pages_show_list`
- Zero-portfolio fixture: no BM → Page name+ID list → primary select → BM create enabled
- Validate Page: dates only; no post text; no engager profiles
- Portfolio path: portfolio + asset name/ID visible; Partner steps labeled Manual unless live auto proven
- Ad accounts: Manual partner share + Check access **or** assigned_users read-back — labels match path
- Captions/receipts: method, edge, token class only — no tokens
- Agency-side beat planned for App Review videos (separate identity)

Per-ticket reports live in subfolders (`03`, `04`, `05`, `06`, `10`, …). P0 aggregate: [docs/app-review/meta/visual-qa-aggregate-p0.md](../docs/app-review/meta/visual-qa-aggregate-p0.md).

Report template: see EL package `TEMPLATE.md` (Visual QA report format).
