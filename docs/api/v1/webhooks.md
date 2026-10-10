# Webhooks: verify, rotate, debug

## Receiving

Each delivery is a `POST` to your endpoint URL with headers:

- `X-AgencyAccess-Event` — the event type
- `X-AgencyAccess-Delivery-Id` — unique per attempt
- `X-AgencyAccess-Timestamp` — unix seconds
- `X-AgencyAccess-Signature` — `v1=<hex HMAC-SHA256>`

## Verification

Recompute over the raw body bytes:

```
expected = HMAC-SHA256(secret, "<timestamp>.<raw-body>")
signature == "v1=" + hex(expected)   # constant-time compare
```

Then accept only if `|now - timestamp| <= 300s`. Reject skew beyond
the window before trying secrets, and verify against the raw bytes
exactly as received — any JSON re-serialization breaks the signature.

## Rotation without loss

`POST /webhook-endpoints/{id}/rotate` issues a new signing secret while
the old one keeps verifying for a **24h overlap window** (verified
new-then-old). Deploy the new secret, then let the old one lapse.
`{"immediate": true}` replaces at once and revokes the old secret —
use it only when the old secret is compromised.

## Ordering and duplicates

- Order redeliveries by the per-endpoint `sequenceNumber` (gaps are
  normal — tolerate them, do not treat a gap as loss).
- Collapse duplicates on the global event `id`.
- Use `correlationId` as the cross-endpoint dedupe key: one logical
  occurrence fans out to each subscribed endpoint with the same
  correlation ID but distinct per-endpoint sequences.

## Debugging

`GET /webhook-endpoints/{id}/deliveries` pages every attempt with
status plus the ordering primitives (cursor pagination, same envelope).
A delivery log entry plus the event taxonomy
(`GET /webhook-event-types`) is enough to reconstruct any incident
without contacting support.

Endpoint URLs must be `https`, carry no embedded credentials, and never
target private or metadata addresses (re-checked at delivery, not just
at creation); same-host redirects only.
