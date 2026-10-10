# Flow spec: access request lifecycle

The agency-side flow: create a request, deliver the link, track it to
completed (or expired). The client side of the link is `client-invite.md`.

## Creation

- Wizard at `/access-requests/new`, 4 steps: **Fundamentals → Platforms →
  Customize (intake + branding) → Review**
  (`apps/web/src/app/(authenticated)/access-requests/new/page.tsx:229`).
  Docs drift (G3): `docs/APP_OVERVIEW.md` still calls them "Client Info /
  Platforms / Intake Form / Branding".
- On create (`apps/api/src/services/access-request.service.ts:314`): mints a
  12-character `uniqueToken`, sets `expiresAt = now + 7 days`, status
  `pending`.
- Templates (`AccessRequestTemplate`) pre-fill platforms, intake fields, and
  branding.

## Lifecycle statuses

`pending | partial | completed | expired | revoked`
(`apps/api/src/services/access-request.service.ts:119`).

- `partial`: some platforms connected, completion not granted.
- Expiry is **lazy**: no scheduled job flips status. Any client route checks
  `expiresAt < now` and returns `REQUEST_EXPIRED` (first check at :1497;
  repeated at :2069 and :2183). A cleanup job deletes expired requests later
  (`deleteMany` at :2373).
- Revoked removes client access; terminal for the link.

## Delivery (three ways, all live)

1. **Copy Link / Preview** — raw `authorizationUrl` on the request page;
   analytics `invite_link_copied` + `invite_sent` (channel `copy`).
2. **"Send invite"** — AuthHub emails the client
   (`apps/api/src/services/access-request-invite-email.service.ts`). Subject
   and body in `apps/api/src/lib/client-invite-email.ts:114`. Rate limits
   `INVITE_EMAIL_LIMITS` (:22 of the service): 1 send/60s, 5/request/24h,
   20/agency/hour.
3. **mailto fallback** — `buildInviteSentMailto` /
   `buildInviteReminderMailto`
   (`apps/web/src/lib/analytics/invite-events.ts:295`) prefill the agency's
   own mail client.

Reminder: "Send Reminder" button → `access-request-reminder.service.ts`;
1-hour cooldown (`REMINDER_COOLDOWN_MS`, :8), violations get
`429 REMINDER_COOLDOWN` (`apps/api/src/routes/access-requests.ts:483`).

## Agency-side truth while waiting

The request page shows: "Client invite: Needs you — The client still has steps
on the invite link (connect, share, or verify). Tokens are stored only after
they finish — not when the link is sent."

## Client completion email

On client completion, the notification queue emails the agency: subject
"Access Granted: {clientName} authorized {n} platform(s)"
(`apps/api/src/services/email.service.ts:78,116`).

## Flags

- **G1 (high): no expiry-warning email exists.** The only expiry mention in
  any email is the reminder's "This link expires on {date}." — and reminders
  are manual (G5). Clients learn of expiry by clicking a dead link and hitting
  the terminal card (`client-invite.md`).
- **G5 (medium): reminders are manual-only** — no scheduled cadence, nothing
  near expiry.

## Sources

- apps/api/src/services/access-request.service.ts:119 — "pending', 'partial', 'completed', 'expired', 'revoked'"
- apps/api/src/services/access-request.service.ts:314 — "expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)"
- apps/api/src/services/access-request.service.ts:1497 — "REQUEST_EXPIRED"
- apps/api/src/services/access-request.service.ts:2373 — "prisma.accessRequest.deleteMany"
- apps/api/src/services/access-request-invite-email.service.ts:22 — "export const INVITE_EMAIL_LIMITS"
- apps/api/src/lib/client-invite-email.ts:114 — "needs access to your"
- apps/api/src/services/access-request-reminder.service.ts:8 — "REMINDER_COOLDOWN_MS"
- apps/api/src/routes/access-requests.ts:483 — "REMINDER_COOLDOWN: 429"
- apps/web/src/lib/analytics/invite-events.ts:295 — "export function buildInviteSentMailto"
- apps/api/src/services/email.service.ts:116 — "Access Granted:"
