# Manual access confirmation: decision required

## Confirmed gap

Client reports persist as pending. Request fulfillment requires each manual platform's `verificationStatus` to equal `verified`. No implemented production operation writes that field on a client connection. Beehiiv verification writes an agency platform connection, a different record. Consequently, a newly reported manual platform cannot finish its request through the implemented application.

## Proposed repair for approval

Add an authenticated agency action, **Confirm access manually**, beside each pending manual platform in the existing request detail. Require an explicit acknowledgment that the agency checked access in the native platform. Show **Confirmed by agency**, so this does not imply automated provider verification.

The operation must enforce verified actor identity, tenant ownership, requested platform membership, and existing pending evidence. Record actor identity, timestamp, and `manual_review` as the verification basis. Atomically change only that platform's verification fields and create an audit record. Preserve sibling grants, OAuth authorizations, and existing report evidence. Repeated confirmation must be idempotent. Recompute request completion using the existing fulfillment logic.

Do not grant provider permissions, create credentials, send messages, or assert provider API verification. Implement and test locally only; deployment remains a separate approval.

## Required verification

- Reject another tenant, an unrequested platform, and missing evidence.
- Confirm one platform without completing another pending platform.
- Preserve sibling updates under concurrency and repeated confirmation.
- Verify the agency action, persisted audit evidence, client refresh, and final completion in disposable local fixtures.

## Authority

Repository `AGENTS.md` requires approval before a product or scope decision that is not already authorized. This introduces the missing agency workflow and selects human confirmation as its verification basis. Existing-flow bug repairs continue independently.
