# Errors & Known Failures

Log deterministic errors with a conclusion; infrastructure errors without one
until a pattern emerges. Newest first.

---

## 2026-09-13 — RESOLVED: 11 pre-existing web test failures (settings + success page)

**Resolution:** merging `origin/main` (commits `147867d`, `ba21068`) fixed the
10 settings failures — mock coverage for the code-split tabs landed there. The
remaining success-page test was stale against the PostHog capture
serialization (`7178a20`); fixed in this branch by asserting
`trackInviteLinkCopyAndSent` and making the copy mock run its callback.

Original record below for reference.

---

## 2026-09-13 — 11 pre-existing web test failures (settings + success page)

**Deterministic** (reproduced in isolation, no concurrent edits).

- `src/components/settings/__tests__/settings-view-counts.test.tsx` — 6 tests.
  Tabs render no ink-panels (expected 1). Root symptom: hooks inside the
  rendered tab content fail (`usePrefetchBillingData` /
  `settings-tabs.tsx:51`; settings page tests additionally fail with
  "No QueryClient set" from `useUserAgency`).
- `src/app/(authenticated)/settings/__tests__/page.test.tsx` — 4 tests, same
  QueryClient root cause.
- `src/app/(authenticated)/access-requests/[id]/success/__tests__/page.test.tsx`
  — 1 test ("tracks invite analytics when copy link is clicked").

**Proof pre-existing:** reproduced identically at base commit `86fa16a` (before
the 2026-09-13 button-sweep session) in a throwaway worktree with the same
node_modules. Not caused by the sweep.

**Conclusion (provisional):** mock setup for `@/hooks/use-user-agency` /
billing hooks does not cover a code path added by the "code-split gated UI"
work (9c474cd..0929df9). Fix by extending the test mocks or wrapping renders
in a QueryClientProvider. No product bug demonstrated.

