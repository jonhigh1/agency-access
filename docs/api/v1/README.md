# AuthHub Public API v1

Stable, versioned contract for agency developers wiring their CRM or
portal into AuthHub. Machine-readable reference:
[`../../../apps/api/openapi/v1.openapi.json`](../../../apps/api/openapi/v1.openapi.json)
(generated from the same zod schemas that validate requests — see
`apps/api/src/openapi/`).

Guides:

- [Authentication and scopes](auth-scopes.md)
- [Errors and envelope](errors.md)
- [Idempotency and safe retries](idempotency.md)
- [Pagination](pagination.md)
- [Rate limits](rate-limits.md)
- [Webhooks: verify, rotate, debug](webhooks.md)
- [Versioning policy](versioning.md)

Base path: `/api/v1`. All requests and responses are JSON.
