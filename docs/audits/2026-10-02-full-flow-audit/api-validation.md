# API validation — 2026-10-02

## Local repairs

- OAuth state creation now rejects a platform absent from the access request. This prevents durable OAuth state for unrequested products.
- Authorization progress now reports `authorization_required` for each requested product without an OAuth authorization. Clients can receive a next action instead of an incomplete result with no unresolved products.
- Client-detail platform groups now choose the newest request for each product. An old revoked connection cannot override a newer active, partial request. Group request metadata also follows the newest request when input order is unexpected.
- Identity-only connections derive the audit actor from authenticated claims. Request bodies cannot forge `connectedBy`. Missing email claims receive `401 USER_EMAIL_REQUIRED`.

## Local checks

- Focused API validation passed: six files and 144 tests. It covered OAuth-state scope, completion, authorization progress, client detail aggregation, agency-platform identity authorization, and token-health tenancy.
- API typecheck passed.
- Full API suite passed: 157 files, 1,700 tests, and 19 explicitly skipped schema-integration tests. The skipped tests need a database integration environment.
- API lint completed with no errors. It reports 111 existing warnings.

## Examined without a code change

- Token-health routes scope reads and mutations through the resolved principal agency. Their security tests cover cross-tenant refresh and revoke rejection, caller-supplied agency suppression, audit actor attribution, and missing-email denial.
- Dashboard `pendingRequests` counts only access requests whose lifecycle status is `pending`. Client product groups can remain pending or need follow-up while the request lifecycle is `partial`. The observed production labels need a UI and product-language decision.
- `PUT /agency-platforms/:id/verify` marks an identity connection verified without a provider check. Its comment claims a platform API check, but this route has no provider verification authority. This is an actionable truthfulness issue. It needs a supported provider-verification design before changing behavior.

## Explicit validation boundaries

- Provider OAuth exchange, Meta grants, Google grants, and token refresh were skipped. This audit used mocked local service boundaries and did not use provider credentials or sandboxes.
- Postgres persistence, transaction races, and row ordering were skipped. Service tests mock Prisma. The reducer regression supplies deliberately unordered records locally.
- Infisical and other secret-vault reads were skipped. No secrets were read.
- Browser, deployed API, and production database checks were skipped by this API audit. The production observation that prompted the reducer repair is evidence of the symptom, not deployment proof of this local fix.
