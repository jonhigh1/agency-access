# Errors and envelope

## Envelope

Every v1 response carries all three keys:

```json
// success
{ "data": { "...": "..." }, "error": null, "meta": { "requestId": "uuid" } }
// denial
{ "data": null, "error": { "code": "VALIDATION_ERROR", "message": "..." }, "meta": { "requestId": "uuid" } }
```

List endpoints extend `meta` with `pagination`; idempotent creates
extend it with `replayed: true` on a replay. Include `requestId` when
contacting support.

## Stable codes

`error.code` is always one of the registered codes below. Clients
should branch on `code`, not on message text or status alone.

| Code | Status | Meaning |
|---|---|---|
| `INVALID_API_KEY` | 401 | Missing, unknown, revoked, or expired key |
| `MISSING_SCOPE` | 403 | Key lacks the route scope; message names it |
| `TIER_ACCESS_DENIED` | 403 | Plan has no API access |
| `TIER_CHECK_UNAVAILABLE` | 503 | Entitlement could not be verified; retry later |
| `RATE_LIMIT_EXCEEDED` | 429 | Over budget; honor `Retry-After` |
| `VALIDATION_ERROR` | 400 | Body/query failed validation; message names the field |
| `NOT_FOUND` | 404 | Webhook endpoint or resource not found |
| `CLIENT_NOT_FOUND` | 404 | No client for the id or external ID |
| `CLIENT_EMAIL_EXISTS` | 409 | A client with this email already exists |
| `EXTERNAL_ID_CONFLICT` | 409 | External client ID already used in this agency |
| `IDEMPOTENCY_KEY_REQUIRED` | 400 | Create arrived without the header |
| `IDEMPOTENCY_CONFLICT` | 409 | Same key, different body |
| `IDEMPOTENCY_IN_PROGRESS` | 409 | First call with this key still running |
| `IDEMPOTENCY_KEY_EXPIRED` | 410 | Key older than 72h; retry with a fresh key |
| `WEBHOOK_ENDPOINT_CAP_EXCEEDED` | 409 | More than 10 endpoints for the agency |
| `WEBHOOK_ENDPOINT_URL_EXISTS` | 409 | This URL is already registered |
| `UNSAFE_ENDPOINT_URL` | 400 | URL failed the SSRF screen (https-only, no private/metadata targets) |
| `INTERNAL_ERROR` | 500 | Unexpected failure; retry with a fresh idempotency key |

## Strict validation

Unknown fields and parameters are rejected, never ignored. A stray
field fails with `VALIDATION_ERROR` naming it
(e.g. `Unknown field: bogusField`), so a typo can never silently change
what you created.
