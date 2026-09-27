---
target: full client request flow (agency + client sides)
total_score: 20
max_score: 40
na_heuristics:
p0_count: 2
p1_count: 2
timestamp: 2026-09-06T04-06-46Z
slug: src-app-authenticated-access-requests-invite-flow
---
# Impeccable Critique — Client Request Flow (Agency + Client sides)

Dual assessment: independent design-review agent + separate detector/browser-evidence agent. Target: `apps/web/src/app/(authenticated)/access-requests/**`, `apps/web/src/app/invite/**`, `apps/web/src/components/{flow,access-request-detail,client-auth}`.

## Design Specificity Verdict

**LLM assessment:** The design-system doc is sharply authored, but the flow only half-inhabits it. OAuth wizards, checklist, and step progress follow Acid Brutalism v2 (black borders, hard shadows, coral/teal discipline). The invite shell, stage chrome, sticky rail, action dock, and agency cards use generic soft SaaS: `rounded-[1.5rem]`, resting `shadow-sm`/`shadow-lg`, gradient rail header, `backdrop-blur` glass dock — all banned by v2. Status, the product's core promise, renders as raw enum text with no designed vocabulary. Two design worlds share one flow.

**Deterministic scan:** CLI detector: exit 0, 0 findings — the rule set does not catch the off-system rounded/glass patterns. In-page overlay injection (2 pages) found real rendered issues: invite-core 3 findings (`low-contrast`, `flat-type-hierarchy`, `nested-cards`); beehiiv manual 16 findings (`low-contrast`, `line-length`, `nested-cards`). No false positives verified. A recurring `TypeError: Cannot read properties of null (reading 'classList')` pageerror fired on all 6 fresh captures — worth a bug ticket.

## Overall Impression

The logic of truthful status exists; the visual system does not. Half the flow proves the redesign direction already (the wizards), half works against it (shell, rail, dock, agency cards). The single biggest opportunity: extend the proven wizard world to every surface and build a designed status vocabulary instead of enum strings.

## What's Working

1. **Truthful-status logic is real:** platform queue states, TikTok partial-share fallback, `legacy_unreadable` re-confirmation, finalize retry. The product promise is built, not styled.
2. **A repeatable reassurance system:** StepHelpText sequences + trust notes ("You stay in control", "Passwords are never requested") are transferable product character.
3. **The brutalist islands work:** PlatformAuthWizard, checklist wizard, and step progress are coherent, authored, and can anchor the redesign without invention from zero.

## Priority Issues

1. **[P0] Contrast + semantic-color failures at the highest-stakes moments.** Raw `--coral`/`--teal` used as error/success *text*; white text on teal/coral step boxes (~2.9:1); the active step chip styled with the danger-ink token. This violates the system's own AA contract exactly where clients authorize access. Fix: use `--success-ink`/`--danger-ink` for status text; active = ink text on paper + coral marker. `$impeccable audit apps/web/src/components/client-auth`
2. **[P0] Two design systems in one flow.** Rounded stage/dock, gradient rail, glass `backdrop-blur` dock, resting soft shadows coexist with on-system wizards — on both agency and client sides. Fix: consolidate all chrome on Acid Brutalism v2; square, border-drawn; shadow only as press/hover punctuation; delete dock blur. `$impeccable craft apps/web/src/components/flow`
3. **[P1] Success/dead-end decision overload.** Agency success screen shows 5 near-equal CTAs; "send it" (Email Client) is indistinguishable from navigation. Fix: one primary action, Copy Link inline beside the URL, the rest as quiet links. `$impeccable distill apps/web/src/app/(authenticated)/access-requests/[id]/success`
4. **[P1] Reassurance hidden at the exact anxiety peak.** Help panels default-closed; the agency identity a client must verify hides behind a collapsed `<details>`; no "we'll bring you back" promise on OAuth exit; mobile rail buried below content. Fix: open help by default on connect steps; surface identity inline; state the round-trip in the CTA. `$impeccable harden apps/web/src/app/invite`
5. **[P2] Machine-state leakage + IA inversion.** Raw `{accessRequest.status}` badge; snake_case product fallbacks; `window.confirm` for unsaved changes; actions bar above content; hardcoded `/contact`; off-palette `#6366f1` branding placeholder; malformed `dark:bg-muted/60/50`. Fix: designed status vocabulary (icon + word + ink color), actions below context, designed modal instead of OS dialog. `$impeccable clarify apps/web/src`

## Persona Red Flags

**Jordan (first-timer client):** The invite email/Business ID she must type into Meta/beehiiv is collapsed under "View invite details". Step-2 gate text assumes she saw step numbering she never saw. "Finalize failed" + coral-on-coral error text is unreadable jargon at her worst moment.

**Sam (screen reader / keyboard):** CancelRequestModal closes on backdrop click with no visible Escape/focus-trap handling. `window.confirm` bypasses the designed dialog. Raw-teal step-label text (~3:1) fails low-vision contrast; `text-[var(--teal)]` violates the system's own ink contract.

**Casey (distracted mobile):** The fixed glass `InvitePrimaryActionDock` covers the page bottom and collides with form footers. The mobile rail (security note + support) renders below the flow inside a `<details>`. Agency success stacks four 44px+ buttons in a cramped 2-col grid.

## Minor Observations

- Edit flow has 4 steps; create flow has 3 — same object, two vocabularies.
- Session progress merges server truth and sessionStorage by union; UI can show "complete" the server never confirmed.
- Mono micro-label system (`.label-micro`/`.label-nano`) — v2's signature — used nowhere in this flow.
- Two loading idioms: LogoSpinner vs raw coral spinner.
- Branding preview heading renders in client-chosen color with no contrast guard.

## Questions to Consider

1. When session progress and server truth disagree, which screen does the client see — and does the agency ever learn the UI lied?
2. Active steps borrow danger ink; errors borrow brand coral. After those trades, what does either color still mean?
3. Would you ship the current five-equal-action success screen to your best client's onboarding?
4. AuthHub sells truthful status. Where is the designed status language (pending/partial/revoked/unknown) on both sides of the same request?
5. If Acid Brutalism v2 is the real system, why do the two highest-traffic client surfaces still live in the old rounded world?

## Evidence Notes

- Heuristic scores: 20/40 (all 10 applied, no n/a). P0=2, P1=2, P2=1.
- Browser evidence: 6 fresh captures (desktop+mobile, light) at /tmp/impeccable-b/. All 200s; one repeating pageerror (see scan section).
- Overlay injection succeeded on 2 pages; console findings as listed.
- Rendered evidence in docs/images/client-request-flow/2026-02-27 and 2026-03-10 is ~6 months old and predates DESIGN_SYSTEM v2.0 (2026-09-03) — treat as historical.
- Authenticated agency pages could not be rendered live (Clerk gate, no bypass on the running dev server); agency-side findings come from source + stale screenshots.
