# Intake persistence patch — draft for review

Prepared 2026-09-12 by Agency (card #9, "Draft persistence patch"). Nothing applied, committed, or pushed. `main` at `09a1335`.

## Re-check before drafting

- `apps/api/src/routes/client-auth/intake.routes.ts:28-34` still has the TODO and still replies `{ success: true, message: 'Intake responses saved' }` without writing anything. Bug confirmed.
- `.planning/codebase/CONCERNS.md:25-29` and `:172-175` still list it open.
- **New fact:** no first-party caller. `grep -rn "/intake" apps/web/src` returns nothing; the only references are the route itself and `client-auth/index.ts`. Both `intakeFields` consumers in `apps/web` are the agency-side builder/editor pages, not the client portal. So today the endpoint lies only to external API clients. That lowers urgency but the fix is still the honest contract for the public API.

## 1. Store choice: a `Json?` column on `AccessRequest` (not `ClientConnection`, not a TTL cache)

The intake POST already resolves an `AccessRequest` by token (`getAccessRequestByToken`, `access-request.service.ts:1165`). `AccessRequest` ↔ `ClientConnection` is 1:1 (`ClientConnection.accessRequestId @unique`, `schema.prisma:251`). The connection is created later at four separate sites (`oauth-exchange.routes.ts:147`, `manual.routes.ts:59`, `meta-finalize.routes.ts:73`, `connection.service.ts:195`). Storing on `ClientConnection` would mean either a staging store plus a copy at all four sites, or a column that cannot be written at intake time because the row does not exist yet. Storing on `AccessRequest` needs one `update` in the intake handler, zero changes at the creation sites, and the data is already reachable from any connection via `connection.accessRequest.intakeResponses`. CONCERNS.md suggests a `ClientConnection.intakeResponses` column; this is the same shape, one table earlier, and it survives the "client filled intake but never finished auth" case, which is the partial-funnel data an agency actually wants to see. A TTL cache is rejected: it discards the answers on restart and fixes nothing.

## 2. Diff

### `apps/api/prisma/schema.prisma` (model `AccessRequest`, after line 159)

```diff
   intakeFields      Json?     @map("intake_fields") // Custom form fields for client intake
+  intakeResponses   Json?     @map("intake_responses") // Client answers to intakeFields, keyed by field id
+  intakeSubmittedAt DateTime? @map("intake_submitted_at")
   branding          Json? // Custom branding (logo, colors, subdomain)
```

### New migration `apps/api/prisma/migrations/20260912_add_intake_responses/migration.sql`

```sql
ALTER TABLE "access_requests"
  ADD COLUMN "intake_responses" JSONB,
  ADD COLUMN "intake_submitted_at" TIMESTAMP(3);
```

### `apps/api/src/services/access-request.service.ts` (new function next to `getAccessRequestByToken`; add to the exported object at line ~1646)

```ts
/**
 * Persist client intake answers on the access request. Idempotent: a resubmit replaces.
 */
export async function saveIntakeResponses(
  accessRequestId: string,
  intakeResponses: Record<string, unknown>
) {
  try {
    await prisma.accessRequest.update({
      where: { id: accessRequestId },
      data: {
        intakeResponses: intakeResponses as Prisma.InputJsonValue,
        intakeSubmittedAt: new Date(),
      },
    });
    return { data: { success: true }, error: null };
  } catch (error) {
    logger.error({ err: error, accessRequestId }, 'Failed to save intake responses');
    return {
      data: null,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to save intake responses' },
    };
  }
}
```

(`Prisma` is already imported at line 9 and `logger` at line 28 of this file.)

### `apps/api/src/routes/client-auth/intake.routes.ts`

```diff
-    // TODO: Store intake responses temporarily
-    // They'll be saved to ClientConnection when connection is created
-
-    return reply.send({
+    const saved = await accessRequestService.saveIntakeResponses(
+      accessRequest.data.id,
+      validated.data.intakeResponses
+    );
+    if (saved.error) {
+      return sendError(reply, saved.error.code, saved.error.message, 500);
+    }
+
+    return reply.send({
       data: { success: true, message: 'Intake responses saved' },
       error: null,
     });
```

Verified: `getAccessRequestByToken` returns `{ ...accessRequest, agencyName, platforms, ... }` (`access-request.service.ts:~1261`), so `data.id` is the row id.

### Test to add: `apps/api/src/routes/client-auth/__tests__/intake.routes.test.ts`

Follow `manual.routes.test.ts` setup. Cases: (a) valid body → `saveIntakeResponses` called with the request id and body, 200; (b) service error → 500, no "saved" message; (c) unknown token → 404 (already true); (d) invalid body → 400 (already true).

## 3. Transfer into `ClientConnection` and expiry

- **Transfer:** none needed. Read path is `prisma.clientConnection.findUnique({ include: { accessRequest: { select: { intakeResponses: true, intakeSubmittedAt: true } } } })`. If the agency UI later wants it on the connection detail response, add the select in `connection.service.ts`; no copy at creation.
- **Expiry of stale answers:** follows the parent row. `getAccessRequestByToken` already rejects submissions after `expiresAt` (`:1181`), so nothing new can land on an expired request. `deleteExpiredRequests` (`:1607`) purges requests expired >90 days, and `ClientConnection` cascades on the request, so the answers die with the request. No extra job.
- **Optional hardening:** if the API should refuse intake after authorization, gate on `accessRequest.data.status !== 'completed'`. Not in the minimal patch.

## Open decision for Jon

Ship as above (one column + one update), or leave the endpoint as-is and delete it since nothing calls it. Recommendation: ship the patch. The public API already advertises the route; an honest 200 costs ~40 lines.
