---
type: concept
title: Clerk session tokens carry no email claims
ingested_via: put_page
ingested_at: '2026-10-03T17:07:58.214Z'
source_kind: put_page
---

# Clerk session tokens carry no email claims

**Type:** concept · **Project:** agency-access · **Set:** 2026-10-03

## The fact
Clerk session JWTs in the Agency Access deployment do not include email
claims. `resolveUserEmail(request.user)` returns undefined for real
production sessions.

## Why it matters
PR #72 (b7ed78e1, 2026-09-26) keyed hard 401 `USER_EMAIL_REQUIRED` guards on
those claims. Result: platform disconnect, client delete, and both
token-health revokes 401'd for every real user, while GETs worked (agency
resolution uses sub/orgId and has its own Clerk fallback). Found via jam
76b5f94c (Disconnect button on /connections → DELETE
/agency-platforms/meta → 401, empty body).

## The rule
Never key authorization or audit identity off JWT email claims. Use
`resolveAuthenticatedUserEmail` (apps/api/src/lib/authorization.ts): JWT
claims first, then the verified Clerk record via `users.getUser`. It runs
only after agency-ownership checks so cross-agency requests never pay the
Clerk call. Verified emails only — unverified addresses must not be
inherited.

## Related
- Logged in docs/ERRORS.md (2026-10-03 entry)
- Fix + tests on the 2026-10-03 working tree (uncommitted at time of writing)
