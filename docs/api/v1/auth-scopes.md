# Authentication and scopes

## The credential

Every v1 call carries an agency API key:

```http
Authorization: Bearer ah_live_<secret>
```

Keys are issued in the dashboard; the secret is shown **exactly once**
at creation. Key verification failures (missing, malformed, unknown,
revoked, expired) all return one code, `INVALID_API_KEY` (401), with
uniform `WWW-Authenticate: Bearer error="invalid_token"` and
`Cache-Control: no-store` headers. Distinct reasons stay server-side so
probes learn nothing.

Keys never work on dashboard routes and Clerk session tokens never work
on v1 — the two credential planes are mutually exclusive.

## Scopes

Each key carries an explicit scope set chosen at creation
(`clients:read`, `clients:write`, `requests:read`, `requests:write`,
`catalog:read`, `usage:read`, `webhooks:read`, `webhooks:write`).
Deny-by-default: a call beyond scope fails with `MISSING_SCOPE` (403)
naming the missing scope, e.g. `Missing required scope: webhooks:write`.

## Self-check

`GET /api/v1/self-check` needs no scope and returns the key agency,
key prefix, scopes, tier, and key-limit hints. Use it after issuance to
confirm a key before wiring it into your CRM.

## Rotation and revocation

Create a replacement key, deploy it, then revoke the old one. Rotation
keeps the old key valid through a 24h dual-active overlap (at most two
active keys per family); revocation takes effect immediately on the next
request. A family-wide revoke kills every active key in the family.

## Tier gating

API access requires a paid plan or active trial (`trialing` and
`past_due` count as entitled). Free or expired plans get
`TIER_ACCESS_DENIED` (403), checked per request — a downgrade denies the
very next call.
