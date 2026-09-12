---
title: OAuth state must use durable Postgres storage in production
date: 2026-09-08
category: security-issues
module: OAuth state service
problem_type: security_issue
component: authentication
symptoms:
  - OAuth initiation failed for multiple providers at the shared state-token step.
  - Redis TLS or URL configuration errors stopped OAuth state writes.
  - Redis quota exhaustion rejected state writes while connectivity checks passed.
  - A stateless fallback token was not durable or single-use.
root_cause: external_state_store_dependency
resolution_type: migration
severity: high
tags: [oauth-state, postgres, fail-closed, csrf]
supersedes:
  - oauth-state-redis-protocol-hardening.md
  - oauth-state-redis-quota-fallback.md
---

# OAuth state must use durable Postgres storage in production

## Problem

OAuth state creation previously depended on a separate Redis store. Redis protocol configuration and later quota/write-availability failures stopped agency OAuth initiation across providers. A stateless fallback kept the flow available, but it did not provide durable single-use state in production.

## Symptoms

- OAuth initiation failed at the shared state-token step, not in provider connector code.
- Redis TLS or URL configuration errors caused state writes to fail.
- Redis quota exhaustion rejected writes although connectivity checks passed.
- Stateless fallback tokens were signed and time-limited, but they were not consumed once.

## What Didn't Work

- Redis URL and TLS validation fixed only the protocol-configuration failure class. That guidance is historical and does not apply to the current OAuth path.
- A production stateless fallback restored write availability but weakened the state guarantee: a valid fallback token could be replayed within its lifetime.
- Treating Redis as an optional dependency made startup more available, but it did not make OAuth state durable and single-use.

## Solution

The current service stores each random state token and its HMAC signature in Postgres through Prisma, with an expiry time ([oauth-state.service.ts:95-125](../../../apps/api/src/services/oauth-state.service.ts#L95-L125)). The `OAuthStateToken` model has a unique token, signature, expiry, and consumption time ([schema.prisma:823-858](../../../apps/api/prisma/schema.prisma#L823-L858)).

Production now fails closed. If durable storage is unavailable, creation returns `STATE_STORAGE_UNAVAILABLE` rather than issuing a weaker token ([oauth-state.service.ts:146-154](../../../apps/api/src/services/oauth-state.service.ts#L146-L154)). A stateless token is permitted only outside production ([oauth-state.service.ts:156-163](../../../apps/api/src/services/oauth-state.service.ts#L156-L163)), and production validation rejects it with `STATE_STORAGE_REQUIRED` ([oauth-state.service.ts:193-204](../../../apps/api/src/services/oauth-state.service.ts#L193-L204)).

Durable validation checks the stored record, rejects an already-consumed or expired token, verifies the HMAC, and atomically consumes the token only when `consumedAt` is null ([oauth-state.service.ts:221-285](../../../apps/api/src/services/oauth-state.service.ts#L221-L285)). Focused tests cover production fail-closed creation, durable validation and consumption, already-consumed rejection, and production rejection of stateless tokens ([oauth-state.service.test.ts:229-244](../../../apps/api/src/services/__tests__/oauth-state.service.test.ts#L229-L244), [oauth-state.service.test.ts:247-295](../../../apps/api/src/services/__tests__/oauth-state.service.test.ts#L247-L295), [oauth-state.service.test.ts:352-383](../../../apps/api/src/services/__tests__/oauth-state.service.test.ts#L352-L383), [oauth-state.service.test.ts:455-474](../../../apps/api/src/services/__tests__/oauth-state.service.test.ts#L455-L474)).

## Why This Works

Postgres is the durable authority for OAuth state. The unique stored token, expiry, signature, and conditional consumption provide one-time use even when two validations race. In production, unavailable durable storage stops state creation; it does not silently downgrade CSRF protection. This removes Redis protocol and quota behavior from the security decision.

## Prevention

- Do not reintroduce a stateless OAuth-state fallback in production.
- Keep OAuth state durable, signed, time-limited, and single-use.
- Keep the production tests for `STATE_STORAGE_UNAVAILABLE` and `STATE_STORAGE_REQUIRED`.
- Keep atomic consumption conditional on `consumedAt` being null.

## Related Issues

- Supersedes `oauth-state-redis-protocol-hardening.md` and `oauth-state-redis-quota-fallback.md`.
