<!-- Hallmark · pre-emit critique: P4 H4 E4 S5 R5 V4. Plan self-review only; no rendered-UI grade. -->
# AuthHub app craft and motion plan

Date: September 13, 2026
Status: Proposal for review. Implementation and release are not started.
Baseline: branch `jonhigh1/motion-design`; working tree clean before this document.
Authority: `apps/web/DESIGN_SYSTEM.md`, including its September 12 v2.1/v2.2 changes.

## Outcome

Make AuthHub feel precise, responsive, and complete from the first request to the last connected account. Every action should have a clear target, an immediate response, a truthful result, and an obvious next step.

Keep the current brand as the working direction: square surfaces, ink borders, Outfit typography, a mono data layer, and coral accents. Refine the detail and interaction quality within that system. A larger visual change would be a separate direction decision.

The main opportunity is consistency across real tasks. A crafted button cannot compensate for a menu that loses focus, a save that stalls, or a connection state that leaves the client unsure. Fix those gaps, then give a few important moments a distinctive finish.

## Scope and evidence

Primary scope: the agency app, request creation, client authorization, onboarding, and shared controls. Follow with account settings, billing, diagnostics, and internal tools. Public pages are an optional follow-on backlog, outside the core effort estimate.

This plan uses current source inspection and live reference documentation. It is not a completed visual audit. No authenticated journey, physical device, performance trace, or production conversion baseline was verified during planning. Phase 0 supplies that evidence before broad visual changes.

No new routes, new business capabilities, backend redesign, animation platform, or blanket component-library migration are needed. Reuse the existing `/design-system` page for the working examples. Preserve authorization and destructive-action rules throughout.

### Pre-flight findings

| Area | Current evidence | Planning consequence |
| --- | --- | --- |
| Fonts | Outfit, Dela Gothic One, JetBrains Mono in `apps/web/src/app/layout.tsx:2` | Keep font roles; refine scale, weight, line length, and alignment. |
| Palette and spacing | RGB token mappings in `apps/web/tailwind.config.ts:20`; 4px grid in `apps/web/DESIGN_SYSTEM.md` | Keep the existing token format and scale. Do not add a parallel OKLCH theme. |
| Framework | Next.js 16, React 19, Tailwind 3 in `apps/web/package.json` | Follow current component and stylesheet ownership. Versions shown are manifest ranges, not a verified installed-version inventory. |
| Motion | `framer-motion` already declared; `LazyMotion` in `apps/web/src/app/app-providers.tsx:24` | CSS first; use existing Motion for lifecycle or gestures that need it. No second motion runtime. |
| Readiness | `AnimationGate`, `animation-lifecycle.ts`, `use-animation-orchestrator.ts` already exist | Extend the real lifecycle; do not create another coordinator. |
| Reuse | Shared Button, SingleSelect, status badges, sidebar, and Settings rows exist | Improve shared controls before per-page effects. |

Hallmark supplies hierarchy, restraint, and state review. Emil supplies the purpose/frequency test, interruptibility, and timing judgment. Transitions.dev supplies specific pattern references. Project rules take precedence where those skills disagree.

## Initial code findings

These are source findings and runtime risks. They do not establish how the current app looks in the browser.

| Before | After | Why |
| --- | --- | --- |
| **P0: Focus treatment can transition.** Button uses `transition-all` at `components/ui/button.tsx:54`; form fields transition `box-shadow` at `app/globals.css:161`. | Enumerate allowed properties. Show the focus indicator immediately; verify its measured contrast on each ground. | Keyboard feedback must be immediate. Do not assume the documented low-opacity coral rings pass without measurement. |
| **P0: Custom select is incomplete.** `components/ui/single-select.tsx:50` measures only on open; `:80` mounts the list directly; there is no arrow-key, typeahead, or Escape handler. | Complete selection semantics and viewport handling before adding a trigger-origin entrance. Prefer native select where the option set needs no custom content. | This control has callers in agency settings, request creation, onboarding, and client authorization. One shared fix reaches many tasks. |
| **P0: Modal exit ownership is split.** `components/manage-assets-modal-shell.tsx:23` returns early and owns an inner presence boundary; `app/(authenticated)/connections/page.tsx:569` also owns presence. | Use one clear owner for mount/exit lifecycle. Verify close, rapid reopen, Escape, focus return, scroll lock, and background isolation. | Nested presence can prevent child exits. Fix the lifecycle, not a delay at each caller. |
| **P1: Modal style drifts.** The asset shell uses `rounded-[1.25rem]` at `components/manage-assets-modal-shell.tsx:49`. | Use the system's square modal surface and consistent header, body, footer, and borders. | This is an explicit radius override; unlike token-mapped `rounded-lg`, it bypasses the square system. |
| **P1: Loading replaces the button content.** `components/ui/button.tsx:108` swaps the label and icon for a spinner plus generic text. | Keep button geometry stable and preserve action context. Use one accessible pending announcement. Verify `asChild` behavior separately. | Avoid label jumps and duplicate announcements. Do not delay the real operation to show an animation. |
| **P1: Client cards have resting shadows and container hover motion.** `app/(authenticated)/clients/page.tsx:214`. | Use border-only static containers; put feedback on the actual link or action. | Resting shadows across a grid dilute hierarchy and exceed the documented budget as the list grows. |
| **P1: Edit success waits one second.** `components/client-detail/EditClientModal.tsx:63` schedules close after success. | Show the verified result at its destination and remove the forced success dwell. Keep failures in place with entered values. | Repeated edits should complete promptly. A celebration should not hold the user in a modal. |
| **P1: Sidebar labels scale horizontally.** `app/(authenticated)/layout.tsx:330` and `components/ui/sidebar.tsx:232`. | Keep text shape intact. Prefer a brief opacity change or an instant width change; test navigation under load. | Squeezed text adds visual noise without explaining state. |
| **P1: Reduced-motion behavior spans several layers.** `app/globals.css:544`, later readiness rules at `:571`, Motion components, and local hooks. | Test computed styles after readiness and while the OS setting changes. Define one effective contract across CSS and Motion. | A CSS duration override alone does not control every JS animation or remove all spatial states. This is a verification target, not a confirmed cascade failure. |

Secondary cleanup: `lib/motion.ts` contains a mobile duration multiplier and overlapping preference helpers, but the source search found no production callers. `FilterDropdown` is exported but had no consuming component in the search. Do not spend the first sprint polishing unused paths; verify references and remove obsolete code only within an approved implementation scope.

Hallmark classification for the taste subset: 1 critical (`transition-all`/focus transition), 4 major (radius drift, container hover, forced success dwell, text distortion), 0 minor. Functional select and modal risks are tracked as P0 separately. This is a scoped source review, not a whole-app score.

### Journey findings and prerequisites

An independent source review of request creation and client authorization found the following. Resolve the P0 items before adding final-success motion. Intake storage is a functional dependency outside a visual-only change; scope it as its own repair before claiming that journey complete.

| Before | After | Why |
| --- | --- | --- |
| **P0: Intake moves forward without saving responses.** `app/invite/[token]/client-invite-page.tsx:335` changes phase; `apps/api/src/routes/client-auth/intake.routes.ts:28` has a storage TODO and returns a saved message. | Separate persistence repair: submit, store, and read back answers before continuing. On failure, keep inputs and offer retry. | A polished saved state cannot be based on an unfinished persistence path. Verify with reload/readback, not a successful response alone. |
| **P0: Final success can appear too soon.** `app/invite/[token]/client-invite-page.tsx:310` enters complete before finalization finishes; success copy is selected at `:673` while no error is set. | Use an explicit finalizing state. Show final success only after confirmation; a failed request goes directly to recovery. | Prevent a brief false “All set” followed by an error. Test delayed success, delayed failure, and duplicate invocation. |
| **P1: Request state is held in component memory.** `contexts/access-request-context.tsx:127`; the setup link at `app/(authenticated)/access-requests/new/page.tsx:274` leaves the flow. | Preserve work across the connection detour; decide a bounded session-draft policy before adding reload recovery. Clear on explicit discard, success, sign-out, or tenant change. Never store credentials or invite tokens in draft data. | Returning to setup should not silently erase prior choices. Reload persistence has privacy and ownership implications; specify it rather than adding blanket localStorage. |
| **P1: Customize validation is bypassed.** `contexts/access-request-context.tsx:278` defines validation; `app/(authenticated)/access-requests/new/page.tsx:626` advances directly; context `:333` drops blank fields. | Validate before advancing, open the affected section, link error text to the field, and focus the first error. | Preserve the user's intent; do not silently discard incomplete custom fields. |
| **P1: Verification identity is not scoped to the active platform.** `app/invite/[token]/client-invite-page.tsx:135` builds a combined list and `:612` passes it to each stage. | Show only relevant recipient/account context beside the active task. | Access decisions require a clear account and destination. |
| **P1: Mobile action rows need render checks.** Request page `:274` and `:861`, invite page `:510` use single-row layouts. | Stack copy and long actions at narrow widths. Keep the current task and main action visible. | Source suggests overflow risk; browser evidence must establish which widths fail. |
| **P2: Client loading and creation share an error state.** `components/client-selector.tsx:53`, `:157`, `:164`, `:224`. | Keep failure messages tied to the operation; clear stale creation errors on cancel or successful retry. | A failed create must not become a misleading “Failed to load clients” message. |
| **P2: Request setup has nested step numbering.** Request page `:155` defines the main steps; `:195`–`:226` introduces another numbered sequence. | Keep one main progress model; present field groups with plain labels and advanced controls as disclosure. | Reduce the effort needed to understand where the user is. |

Source paths above are relative to `apps/web/src/` except the explicitly named API path. The persistence repair is not included in the visual effort estimate below. It needs a bounded API/storage review and its own estimate; it need not block independent control polish.

## Craft direction

### Visual design

- **Hierarchy:** one clear main action per task area. Use the existing one-brutalist-action and shadow budgets. Do not make Cancel, Done, and the task action compete.
- **Type:** retain Outfit for reading and controls. Use mono for short status, time, account metadata, and numbers. Keep instructions in readable body text. Align numeric columns with tabular figures. Tune app headings to task density rather than importing marketing display sizes.
- **Space:** align page headings, toolbars, list edges, form labels, and action rows. Use the 4px grid. Group related fields; separate task sections. Remove nested borders that do not explain a real group.
- **Surfaces:** square, calm, border-led. Reuse Settings rows where content is a label/value/action relationship. Use cards where objects are independent; do not force every page into the same structure.
- **Icons:** use the installed Lucide set with consistent sizes and strokes. Keep platform artwork distinct and square. Align icons optically with their label; reserve circular shapes for genuine circular controls and avatars.
- **Copy:** use action-specific labels, short helper text, and explicit recovery. Separate “Request created,” “Link copied,” “Client authorized,” and “Access verified.” Each describes a different event.
- **Responsive detail:** long agency names, account IDs, emails, multiple platforms, and translated-length labels must fit. Keep main actions reachable when the software keyboard opens. Reflow controls before clipping them; never hide a layout bug with global overflow clipping.

### Motion language

Three motion families are enough: **press**, **surface**, and **state change**. Most screens use only these. Rare completion moments may have one restrained accent.

| Role | Proposed timing | Shape and use |
| --- | --- | --- |
| Immediate | 0ms | Keyboard actions, focus, error text, typing, selection state, initial tab indicator position. |
| Press/hover | 100ms press; 150ms hover/release | Small press response; current brand lift only where already warranted. Fine-pointer hover only. |
| Small surface | 180ms enter; 120ms exit | Dropdown or tooltip, opacity plus at most 4px travel or scale from 0.98. Anchor to its trigger. |
| Large surface | 250ms enter; 150ms exit | Modal or mobile navigation. Modal scales from 0.98 at center; drawer moves from its edge. |
| State feedback | 150ms | Copy confirmation, changed status, small label/icon change within a stable slot. |
| Rare completion | Up to 300ms | One check or local progress accent after a confirmed milestone. No route delay. |
| Marketing reveal | Existing 450ms | Keep in the existing Reveal system. Never reuse as the default dashboard transition. |

These are proposed defaults for an update to the design-system contract, not claims about current values. Add only the semantic tokens that active components need to `globals.css`, with Tailwind mappings where useful. Use a custom ease-out such as `cubic-bezier(0.22, 1, 0.36, 1)` for surfaces and feedback. Keep the documented marketing curve for Reveal. No ease-in or overshoot for ordinary app controls.

Keyboard-initiated visual transitions finish instantly. Distinguish keyboard activation locally at the interaction boundary; do not add a global input-tracking framework. Async work can still show a static pending label. Reduced motion removes spatial animation and decorative loops; preserve the existing near-instant project policy. State changes remain clear through text and icons.

Prefer transform and opacity for motion. Small color transitions are acceptable for feedback; focus never fades. Width, grid-row, blur, and clipping effects are not automatically free or GPU-accelerated. Any necessary exception needs a local profile and browser check. Do not use a global `will-change` rule.

## App coverage and priority

| Surface | Craft work | Completion test |
| --- | --- | --- |
| **P0 shared controls** | Button states, focus, select semantics, modal lifecycle, input errors, pending labels. | Same behavior across at least one agency flow and one client flow; keyboard and reduced motion pass. |
| **P1 request creation** `/access-requests/new` | Clear progression, stable actions, preserved choices, precise validation, readable summary, link confirmation. | Complete, go back, edit, fail, retry, and copy without losing work or moving the target under the pointer. |
| **P1 client authorization** `/invite/[token]`, callbacks and manual routes | Trust context, persistent progress, provider handoff, partial success, recovery, final summary. `/client/[token]` and `/authorize/[token]` are redirect aliases; test redirects rather than creating separate designs. | OAuth return resumes the right task. A partial or manual state never looks like verified completion. |
| **P1 daily app** dashboard, connections, clients, client detail | Stable shell; aligned headers, toolbars and lists; honest refresh states; clear row actions; quiet status updates. | Search/filter/update retains context. Old results do not appear as new. No repeated count-up or list cascade. |
| **P1 onboarding** `/onboarding/unified` and its screens | Clear prerequisites, complete empty states, predictable focus, first-request finish. | First-time and returning users can complete or resume without hidden prerequisites. |
| **P2 settings and billing** | Extend the existing row system; stable tabs; inline save feedback; precise pending billing states. | Keyboard tab selection is instant; URL state and scroll position remain correct; no early payment success. |
| **P2 diagnostics** token health, request detail, agent operations | Legible status/time hierarchy; updates local to the changed row; explicit running, blocked, failed, and completed states. | UI reports actual events. No synthetic reasoning stream, fake percent, or animated status theatre. |
| **P2 auth and checkout** sign-in, sign-up, checkout return | Match shared type/control states within provider constraints; useful redirect/error states. | Real provider-hosted boundaries remain clear; callbacks do not claim completion before confirmation. |
| **P3 internal admin** existing admin routes | Adopt shared controls and dense, consistent tables. | Operator errors and destructive actions remain clear; no extra spectacle. |
| **Optional public entry** home, pricing, guides, comparison and contact | Follow-on backlog: one clear reveal sequence; calm reading; CTA parity with the app; remove excess motion. Scope and estimate after the app review. | Content visible without animation; one hero moment; no delayed reading or blocked navigation. |

## Three signature moments

These give AuthHub a recognizable finish without turning daily work into a performance.

1. **The request is ready.** After the create response succeeds, present the link in a stable field. Copy changes its own icon/label to “Copied” after clipboard success. The next useful action is already present. No confetti and no forced pause.
2. **One more platform is complete.** After verified success, the platform row changes its icon and status together. A small progress accent updates once. Completed context stays visible while the next action becomes clear. Manual submission must use a different label from verified access.
3. **The task is finished.** After the required states are complete, show one short check animation and a plain summary of what the agency can now access. Keep any unresolved work explicit. The summary remains useful with motion off and on repeat visits.

The visual cue can use a short coral line that settles beside the task, paired with semantic status ink. It must not add a new brand color, floating badge, sound, or full-screen interruption. All three moments must still work when rendered instantly.

## Reference shortlist and selection rules

Reference pages were checked on September 13, 2026. These are pattern references, not permission to copy an entire theme or assume every example is open source.

| Reference | Learn or reuse | AuthHub decision |
| --- | --- | --- |
| [Transitions.dev](https://transitions.dev/) and supplied local recipes 05/06 | Trigger-origin menus and asymmetric modal timing. | Strong fit after semantics and lifecycle are correct. Use only needed variables. |
| Local Transitions.dev recipes 09/16 | Stable icon slots and tab-indicator positioning. | Tune icon scale near 1 and blur to 0. The supplied pill shape, 30px target, and width tween are not drop-in matches for AuthHub. Retain the existing square/underline treatment. |
| [Motion AnimatePresence](https://motion.dev/docs/react-animate-presence) | Exit ownership and nested presence behavior. | Use the already installed package; verify API support against the installed version before implementation. |
| [Motion accessibility](https://motion.dev/docs/react-accessibility) | `MotionConfig reducedMotion="user"` and per-interaction preference handling. | Evaluate within current providers. CSS, custom effects, and decorative loops still need their own effective checks. |
| [Motion performance](https://motion.dev/docs/performance) | Property cost and compositor limits. | CSS/WAAPI can run eligible effects off the main thread; do not assume every CSS or Motion effect is accelerated. Profile representative interactions. |
| [21st Motion Primitives](https://21st.dev/@ibelick/library/motion-primitives) | Animated Tabs, Disclosure, Feedback Bar, and Transition Panel as comparisons. | Shortlist interaction behavior only. Avoid adopting their layout, fonts, background effects, or decorative number animation. |
| [Sonner](https://sonner.emilkowal.ski/) | Local, concise notifications; consistent placement and dismiss behavior. | Inspiration first. Consider the package only if cross-page notification needs exceed the existing inline feedback patterns. |
| [Radix Dialog](https://www.radix-ui.com/primitives/docs/components/dialog) | Established focus, keyboard, and dialog behavior. | Benchmark against a native dialog. The manifest currently has Radix Slot, not Radix Dialog; do not assume the full library is installed. |

For each chosen reference, record the exact source, the behavior being borrowed, the app target, and the reason it improves the task. Before copying code, check that specific source's license and dependencies. Free access to a gallery does not establish a code license.

Use the three named skills with explicit conflict resolution: keep project RGB tokens and fonts; use Emil's faster recurring-app timing; keep reduced motion stricter than recipes that preserve fades; treat Transitions.dev as a pattern library when its exact CSS conflicts with the project. Direct snippet installation, when suitable, retains its documented hooks and reduced-motion guard. No wholesale import of all 32 recipes.

Do not add tilt, cursor tracking, spinning numbers, input-clear particles, error shakes, animated gradients, or route-wide slides to the working app. Those are poor fits for frequent access-management tasks. Motion+ premium examples are optional references, not a required purchase.

## Delivery sequence

Effort is a planning estimate for one experienced engineer with design review. It is not a deadline or a staffing commitment. Re-estimate after Phase 0; provider-specific flow complexity is the largest uncertainty.

| Phase | Work and concrete output | Exit gate | Estimate |
| --- | --- | --- | --- |
| **0. Observe** | Record the request-to-client-to-agency loop; capture current screens and failures; list live components and callers. Reproduce intake/finalization risks and scope functional prerequisites. Add exact evidence to this plan. | Each P0/P1 item has a reproducible trigger and baseline; unknowns remain labeled. | 1–2 days |
| **1. Set the standard** | Update the existing design-system document and motion tokens. Extend `/design-system` with the real button, field, menu, modal, tab, and feedback states. | One coherent visual and motion reference works with keyboard, touch, and reduced motion. | 2–3 days |
| **2. Fix shared behavior** | Complete selects and modal lifecycle; stable loading; immediate focus; remove active-source transition drift. | Real consumers pass focused behavior tests and browser checks. | 3–5 days |
| **3. Finish the core loop** | Polish request creation, client handoff/recovery, and the three signature moments after required persistence/finalization repairs pass. | A complete request loop and its error/partial-success variants pass without fabricated completion; intake survives readback. | 3–5 days |
| **4. Carry it across the app** | Daily lists and detail views, onboarding, settings/billing, diagnostics, then admin. Re-rank these slices from Phase 0 evidence and work one flow at a time. | App coverage matrix complete for actual routes; no one-off motion systems. | 4–7 days |
| **5. Tune and release review** | Slow-motion review, browser/device checks, performance comparison, next-day taste pass, evidence package. | No functional/accessibility blockers; reviewed clips and remaining risks documented. | 1–2 days |

Visual and interaction work subtotal: **14–24 focused engineering days**, plus user review and any blocked provider testing. This is not an estimate for completing all functional prerequisites. Intake persistence needs its own estimate after the API/storage review; the total end-to-end effort remains open until then. Phase 3 cannot pass its completion gate while that dependency is unresolved. Public-page work is also excluded.

The first valuable slice is Phases 0–2 plus one real create-and-copy request interaction. Each later flow can ship independently after review; do not hold all improvements for one large rewrite.

### File ownership during implementation

- **System:** `apps/web/DESIGN_SYSTEM.md`, `apps/web/src/app/globals.css`, `apps/web/tailwind.config.ts`, and `/design-system/page.tsx`.
- **Controls:** existing files in `components/ui/`; current providers and animation lifecycle only where a real behavior requires it.
- **Overlays:** current modal shells and their callers. Choose native dialog first if it meets real nested-select, focus, and lifecycle needs. If it does not, use one established primitive rather than growing a custom focus trap. Share a shell only across confirmed repeated consumers; keep business logic in those consumers.
- **Journeys:** existing request, onboarding, client-auth, invite, and authenticated route components. Preserve ownership of data and mutations.
- **Evidence:** extend the existing scripts under `apps/web/scripts/` and current component tests. Use local fixtures or explicitly approved test accounts for flows with external effects.

Keep each change set reviewable. Never change global tokens and many unrelated journeys in the same step. When parallel work becomes useful, one worker owns shared styles/controls and another owns a separate journey after the control contract is stable. Do not let multiple workers edit the same global stylesheet.

## Verification and taste review

### Behavior and states

Test every applicable state: default, hover, focus, press, disabled, pending, error, success. For data surfaces also test empty, no results, partial results, stale data, and retry. Mark non-applicable states rather than inventing a “success” state for a tooltip.

Run the same task with fast success, slow response, failure, repeat click, close during work, and rapid reopen. Check that pending work cannot submit twice, stale responses cannot overwrite a newer choice, and closing an overlay cannot trigger a delayed callback against the next overlay.

Use focus tests for controls and overlays; use end-to-end checks for preservation across navigation and OAuth return. Do not replace irreversible access removal, billing, or authorization confirmation with optimistic success or an Undo button unless the backend actually supports reversal.

Keep existing design checks aligned with actual rules. `rounded-lg` resolves to square through the current Tailwind token mapping; an arbitrary radius does not. The stylesheet also documents a validator that mistakes `motion-reduce` for a forbidden color substring. Correct such checks when touched rather than avoiding valid accessibility utilities to satisfy a text match.

### Render and access

- Capture at 320, 375, 390, 414, 768, and 1440 CSS pixels. Include a short viewport and 200% zoom.
- Test keyboard only: Tab, Shift+Tab, arrows, Home/End where relevant, Enter, Space, and Escape. Check trigger focus return and visible focus at all times.
- Check screen-reader names, relationships, one useful async announcement, and hidden/exiting content that cannot receive focus.
- Test reduced motion before load and while the app is open. Verify after `animations-ready` is set, not only at initial render.
- Measure actual contrast and 44px touch targets. Keep status meaning in text as well as color. Test long labels and many platform rows.
- Test Chromium, Firefox, and Safari/WebKit; include one physical iOS or Android device for touch, scrolling, and keyboard behavior.
- Verify existing dark-mode surfaces touched by the work. A full dark-mode launch remains outside this plan.

### Performance

Record before/after traces on the same device, data, viewport, and network/CPU profile. Target smooth 60Hz motion on the reference device, with no new long tasks caused by the animation. This is a target, not a measured result.

Check menu open, modal close/reopen, filtering, and status changes while data loads. Do not animate all list rows or counters on refresh. Preserve layout during skeleton/content swaps and button state changes. Record route bundle deltas and require an explanation for added client code. No new motion runtime in the baseline scope.

CSS and source tests cannot prove the result looks good. Compare recorded clips at normal speed, then slow them down to inspect start/end frames and interruptions. Review once more the next day. Ask: Is the task clearer? Does the app react promptly? Does anything move without a reason? Do type, edges, and spacing look related across pages?

### Completion and measurement

Each flow is complete only when it has a passing relevant test, before/after evidence, keyboard and reduced-motion verification, and no unresolved functional/accessibility blocker. A taste score is supporting judgment, not a substitute for those checks.

Track request completion, time to create/copy a link, client completion by platform, recovery after failure, and repeated clicks during pending work using existing analytics where available. Establish a baseline first. Do not invent conversion targets or attribute any change to motion without comparable evidence. Keep diagnostic events free of credentials, client tokens, and entered form content.

No tests were run during this planning-only pass. During implementation use the current Vitest scripts for focused tests, then web typecheck and lint for touched behavior; run the production build before release review. Use `git diff --check` and inspect each change set. Deployment, commit, push, and external/provider actions retain the workspace approval requirements.

## First implementation brief

Start with a representative request flow plus shared Button, SingleSelect, and the asset modal. Capture the baseline, build their working states in `/design-system`, and make one real create-and-copy interaction feel finished. Review that result before extending the same rules across the remaining flows.

The decision still open is the degree of visual change. This proposal assumes the existing brand remains the direction. All priority ordering, effort, and timing values above are recommendations for this craft initiative, not a claim about an already approved roadmap.
