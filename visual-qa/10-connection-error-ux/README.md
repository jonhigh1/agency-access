# Visual QA — Ticket 10 (Connection-error UX / Access Detective lite)

| Route / harness | Interaction | Result | Notes |
| --- | --- | --- | --- |
| `/dev/meta-invite/?scenario=error-incomplete-permissions` | Step 2 asset discovery (fixture API) | **Pass** | `error-incomplete-permissions-desktop.png` — re-consent next steps + `META_CONNECTION_INCOMPLETE_PERMISSIONS` |
| `/dev/meta-invite/?scenario=error-not-admin` | Step 2 asset discovery (fixture API) | **Pass** | `error-not-admin-desktop.png` — forward invite to admin + `META_CONNECTION_NOT_ADMIN` |
| `/dev/meta-invite/?scenario=error-2fa-required` | Step 2 asset discovery (fixture API) | **Pass** | `error-2fa-required-desktop.png` — enable 2FA guidance + `META_CONNECTION_2FA_REQUIRED` |
| `/dev/meta-invite/?scenario=error-page-ownership` | Step 2 asset discovery (fixture API) | **Pass** | `error-page-ownership-desktop.png` — ownership resolution + `META_CONNECTION_PAGE_OWNERSHIP` |
| `/dev/meta-invite/?scenario=error-bm-mismatch` | Step 2 asset discovery (fixture API) | **Pass** | `error-bm-mismatch-desktop.png` — portfolio alignment + `META_CONNECTION_BM_MISMATCH` |
| Live Meta OAuth / production Graph | — | **Skip** | Requires live Meta OAuth; fixture API used for automated Visual QA |

Regenerate screenshots from `apps/web`:

```bash
node ./scripts/capture-meta-connection-error-evidence.mjs
```

Evidence uses the Vite preview harness (`evidence.vite.config.ts`, port 4174) with mocked `/assets/meta_ads` error responses — no live Graph.
