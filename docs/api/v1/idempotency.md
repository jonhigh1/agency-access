# Idempotency and safe retries

All creating endpoints (`POST /clients`, `POST /requests`,
`POST /webhook-endpoints`) require an `Idempotency-Key` header.
Without it the call fails with `IDEMPOTENCY_KEY_REQUIRED` (400) and
nothing is written.

## Retry rule

Generate one key per logical create (a UUID is fine) and reuse it on
every retry of that create:

```http
POST /api/v1/clients
Idempotency-Key: 7f3a2c1e-9b4d-4f6a-8c2e-1a5d9b3f7e11
Content-Type: application/json

{ "name": "June", "company": "Acme", "email": "june@acme.co" }
```

- Same key + same body → the original result returns (with its original
  status code and `meta.replayed: true`). No duplicate is created and no
  usage allowance is consumed twice.
- Same key + different body → `IDEMPOTENCY_CONFLICT` (409). The key is
  bound to the first body it saw.
- Same key while the first call is still running →
  `IDEMPOTENCY_IN_PROGRESS` (409). Wait, then retry with the same key.
- Key older than the **72h retention window** →
  `IDEMPOTENCY_KEY_EXPIRED` (410). Retry the business operation with a
  fresh key.

## Guarantees

- Validation runs before the key is claimed: a `400` never consumes
  your key.
- Records isolate by agency plus key identity: one key can never replay
  another key's stored result.
- Replays re-check scope and tier, so a revoked scope or a downgraded
  plan denies the retry instead of leaking the original.
- Pair with external client IDs (`externalClientId`, immutable once set)
  so CRM-side retries converge even if the idempotency key is lost:
  re-creating with the same external ID returns `EXTERNAL_ID_CONFLICT`
  instead of a duplicate.
