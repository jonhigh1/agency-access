# Versioning policy

- v1 changes are **additive-only**: new endpoints, new optional fields,
  new event types, new error codes. Existing fields never change type
  or meaning, required inputs never appear, and no response key is
  ever removed.
- Breaking change ships as a new version (`/api/v2`), never inside v1.
- Webhook payloads carry the same promise: new keys may appear;
  consumed keys stay stable. Endpoint `preferredApiVersion` pins which
  payload shape you receive.
- The OpenAPI document is generated from the validation schemas, so the
  reference cannot drift from behavior. If the spec and a response ever
  disagree, the spec is wrong — report it.
