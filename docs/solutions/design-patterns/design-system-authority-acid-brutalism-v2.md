---
title: "Design System Authority: Acid Brutalism v2"
date: 2026-09-07
category: design-patterns
module: "Design system authority and product UI convention"
problem_type: documentation_gap
component: frontend
severity: medium
applies_when:
  - "Creating, editing, or reviewing product UI in this repo"
  - "Choosing between root DESIGN.md and apps/web/DESIGN_SYSTEM.md"
  - "Refactoring a surface that still uses rounded-world tokens or conventions"
  - "Writing assertions for static UI tests"
symptoms:
  - "Production UI mixes rounded-world and Acid Brutalism v2 conventions"
  - "Root DESIGN.md conflicts with DESIGN_SYSTEM.md after the v2 rebuilds"
  - "Static UI tests pass on text presence while leaving behavior unverified"
root_cause: inadequate_documentation
resolution_type: documentation_update
related_components:
  - design_system
tags:
  - design-system
  - acid-brutalism
  - documentation-authority
  - frontend
  - ui-convention
  - static-ui-tests
  - documentation-gap
---

# Acid Brutalism v2: one design system, stateful controls

## Context

The root `DESIGN.md` is stale — and now says so itself: a banner at its top marks it "do not use for product UI" and points to `apps/web/DESIGN_SYSTEM.md` as canonical (`DESIGN.md:90-92`, per DEC-008). Its body still documents Fraunces and Outfit as display/UI type roles (`DESIGN.md:19-28`), 8/10/12px radii (`DESIGN.md:47-51`), rounded buttons and cards (`DESIGN.md:59-86`), and five signal colors: coral, teal, acid, violet, and amber (`DESIGN.md:4-15`, `DESIGN.md:112-124`). That is not the production contract.

`apps/web/DESIGN_SYSTEM.md` version 2.0 names the production aesthetic Acid Brutalism v2 (`apps/web/DESIGN_SYSTEM.md:3-5`). It defines the core rules: one coral accent, binary radius, a small shadow budget, and JetBrains Mono micro-labels (`apps/web/DESIGN_SYSTEM.md:17-21`). Its philosophy is structural: ink edges separate; color marks an event; contrast is token-controlled (`apps/web/DESIGN_SYSTEM.md:25-30`).

The request-flow redesign corrected the production surface across the client invite rebuild, agency request screens, edge states, OAuth recovery, and shared primitives. The durable authority is the current tree and `apps/web/DESIGN_SYSTEM.md`, not the commit chain that produced it.

## Guidance

Treat `apps/web/DESIGN_SYSTEM.md` v2 as the design authority. Do not copy type, radius, shadow, or color choices from the root `DESIGN.md`.

Use binary radius. Square is `0`; circle is `999px` or `50%`. Cards, buttons, inputs, modals, and badges stay square. Pills, chips, status dots, avatars, and icon-only buttons may be round. Intermediate values such as `rounded-xl`, `rounded-2xl`, or arbitrary `0.75rem` radii are violations (`apps/web/DESIGN_SYSTEM.md:171-182`).

Draw structure first. Default surfaces use edges and ground color; shadow is punctuation for interaction or hero emphasis, not a resting state (`apps/web/DESIGN_SYSTEM.md:184-197`). Do not invent soft elevation. Do not exceed the shadow budget.

Keep coral scarce. `--coral` is the single brand accent for fills and borders (`apps/web/DESIGN_SYSTEM.md:72`). `--teal` is a success fill or border only (`apps/web/DESIGN_SYSTEM.md:73`). Acid survives only as the homepage hero moment and can never carry meaning (`apps/web/DESIGN_SYSTEM.md:83`).

Use the mono data layer for status and metadata. JetBrains Mono carries micro-labels, status, metadata, and terminal-style data (`apps/web/DESIGN_SYSTEM.md:120-121`). Use `.label-micro` for 11px uppercase data and `.label-nano` for 10px metadata (`apps/web/DESIGN_SYSTEM.md:137-142`).

Use status ink tokens, not raw accents, for text. Raw coral and raw teal fail AA as text on white; fills and borders may use those raw colors, but status text uses `--success-ink` or `--danger-ink` (`apps/web/DESIGN_SYSTEM.md:87-89`). The StatusBadge table makes the same split: family fill and border, semantic ink text (`apps/web/DESIGN_SYSTEM.md:244-255`).

Make controls stateful and accessible. A group-level control must expose real selection state. A collapsed/expanded control must expose real expansion state. A save action must expose real busy/disabled state. Do not let a visual chip become the only evidence that a step changed.

The v2 rules are also enforced mechanically by design-contract walker tests, not only by review. `invite.design.test.ts` walks the invite-flow sources asserting the v2 rules (`DESIGN_SYSTEM.md` is its stated binding authority), including a non-token-shadow rule, a generic-palette ban with a documented brand exception, and a per-view accent-text budget; `button-contract.design.test.ts` ratchets the legacy handler-first raw-button backlog down, never up (a frozen violation cap over a frozen file list). Treat these tests as the enforcement layer: a new v2 rule should land with a walker assertion, and a deliberate exception needs a documented entry in the test, not a silent violation.

## Why This Matters

One visual language is easier to operate, audit, and extend. The stale root document recreates rounded, shadowed, multi-accent components even when production has moved to square, drawn, low-accent components.

The ink-token split is a correctness rule, not a preference. Raw coral and teal as text are documented AA failures (`apps/web/DESIGN_SYSTEM.md:87-89`). Semantic inks preserve the status family while restoring readable contrast.

State is product truth. A title, count, checkbox, expansion control, or spinner that exists only as decoration hides the one fact the user needs: what is selected, what is open, or whether the action is working.

## When to Apply

Apply this when creating or reviewing any AuthHub web UI, especially invite, access-request, success, edit, dead-end, empty, loading, and error surfaces.

Apply it when changing shared primitives. Start at the primitive, not the consumer, when every flow routes through the same component.

Apply it when writing UI tests. Assert state and behavior, not the presence of a decorative label or step chip.

## Examples

### Card: rounded and shadowed to square and drawn

The shared Card was `rounded-lg border bg-card text-card-foreground shadow-sm`. The “fix(web): v2 primitives + labeled asset selection (P1 pair)” commit changed it to a square, heavy, drawn edge. The current implementation is `rounded-none border-2 border-black bg-card text-card-foreground` with no resting shadow (`apps/web/src/components/ui/card.tsx:9-14`). This matches the v2 rule that default cards use borders and no shadow (`apps/web/DESIGN_SYSTEM.md:237-240`).

### Button secondary: accent border, stable text

The secondary Button hover previously moved text to `text-danger-ink`. That made a cancel/alternative action read as danger on hover. The “fix(web): v2 primitives + labeled asset selection (P1 pair)” commit changed the hover text to `text-ink`; the current secondary variant keeps the card fill, uses `border-black`, moves the border toward coral, and keeps the label at ink (`apps/web/src/components/ui/button.tsx:57-60`). This is the v2 Button contract: five variants, no shadow on secondary, 2px hover lift, stable elevation (`apps/web/DESIGN_SYSTEM.md:217-232`).

### AssetGroup: title became real content

`AssetGroup` receives a required `title` in its props contract (`apps/web/src/components/client-auth/AssetGroup.tsx:29-36`), but the critique found that the component never rendered it. The “fix(web): v2 primitives + labeled asset selection (P1 pair)” commit now renders the title with `.label-micro` (`apps/web/src/components/client-auth/AssetGroup.tsx:81-84`).

It also computes three real selection states from the selected set: none, some, and all (`apps/web/src/components/client-auth/AssetGroup.tsx:49-51`). The select-all control is `role="checkbox"` and sets `aria-checked` to `false`, `'mixed'`, or `true`; its accessible name names the group (`apps/web/src/components/client-auth/AssetGroup.tsx:97-103`). The expand/collapse control sets `aria-expanded` and names the exact group (`apps/web/src/components/client-auth/AssetGroup.tsx:139-143`). The tests now assert the rendered title, count, checkbox state, and expansion state (`apps/web/src/components/client-auth/__tests__/AssetGroup.test.tsx:12-43`).

### Status: icon plus word plus ink

The invite status model maps each state to an icon, plain word, and ink token: Done uses `Check` plus `text-success-ink`; In progress uses `Play` plus `text-ink`; Needs you uses `CircleAlert` plus `text-danger-ink` (`apps/web/src/components/flow/invite-status-chip.tsx:9-28`). The rendered chip combines icon, word, and `.label-micro`; its own contract says never color alone (`apps/web/src/components/flow/invite-status-chip.tsx:34-41`).

The agency request model renders the same truth through the shared `StatusBadge` — family fill and border with semantic ink text per the StatusBadge table (`apps/web/src/components/access-request-detail/request-overview-card.tsx:50-57`; `apps/web/DESIGN_SYSTEM.md:244-255`).

### Tests: assert state, not decoration

Step indicators must not be the test target when the actual behavior is a gate. Current flow tests assert that Continue is disabled until the client is selected and becomes enabled afterward (`apps/web/src/app/(authenticated)/access-requests/new/__tests__/page.test.tsx:127-157`). The edit page exposes `aria-busy` on Save while the update is pending (`apps/web/src/app/(authenticated)/access-requests/[id]/edit/page.tsx:531-546`), and its test asserts disabled, busy, and then enabled state (`apps/web/src/app/(authenticated)/access-requests/[id]/edit/__tests__/page.test.tsx:213-244`). Manual checklist tests also assert the completion gate: Continue is disabled until the step checkbox is checked and the final action fires only after the gate clears (`apps/web/src/components/flow/__tests__/manual-checklist-wizard.test.tsx:79-94`).

A chip saying “Step 2” is not evidence that step 2 can happen. Disabled state, enabled state, selection count, expansion state, busy state, and post-action result are the evidence.

## Related

- `docs/solutions/design-patterns/single-stage-client-request-flow.md` — the flow-structure contract this authority governed (Moderate overlap by design: that doc owns structure, this one owns the visual authority and its stale rival).
- `apps/web/DESIGN_SYSTEM.md` — the authority itself.
- `DESIGN.md` (repo root) — the stale rival. Superseded; it now carries its own staleness banner naming `DESIGN_SYSTEM.md` canonical (DEC-008). Do not copy from it; regenerating or removing it remains follow-up work.

## Refresh candidates (found this run, not yet fixed)

- `docs/design-system-delta-plan.md` — says "proposed/awaiting approval"; v2.0.0 shipped.
- `docs/sprints/2026-03-09-client-invite-ui-ux-refresh.md`, `docs/sprints/2026-03-10-invite-action-first-hierarchy.md` — rail/step-chip guidance superseded by the single-stage contract.
- `docs/implementation-plans/connections-page-design-system-migration.md` — old token mappings; validate against v2 before reuse.
