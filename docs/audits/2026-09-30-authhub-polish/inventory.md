# AuthHub polish inventory — 30 September 2026

**68 actionable findings: 17 P1, 45 P2, 6 P3.** Every one of the 57 page route patterns is mapped below. This is an evidence-led inventory and proposed repair sequence, not an implementation or release claim.

The app needs work on workflow truth, shared controls and small-screen readability before decorative refinement. Both supplied examples are tracked: **S01** identifies the exact Facebook mark; **O01** traces the final navigation path behind the duplicate-name error. The final production POST/PATCH branch has not been reproduced.

[Open the searchable inventory](./index.html) · [Machine-readable findings](./findings.json) · [Route coverage](./route-coverage.json)

## Scope and evidence

Three agents reviewed separate areas: onboarding/requests/invites; daily work/settings/connections; shared/public/partner/admin. The parent validated and consolidated their notes. Compound Engineering CE Plan provided the research/planning scaffold; Better Interface provided review categories. Caveman and Ponytail governed execution and communication.

The visual authority is [DESIGN_SYSTEM.md](/Users/jon.high/agency-access/apps/web/DESIGN_SYSTEM.md), Acid Brutalism v2.3. Linear-level polish means coherent hierarchy, predictable controls, readable data, truthful states and complete recovery. It does not authorize replacing AuthHub's visual identity.

- **SOURCE:** current local source establishes behavior/style. It is not runtime reproduction.
- **USER_SCREENSHOT:** supplied image/report confirms the visible symptom.
- **LOCAL_PREVIEW:** actual source components with synthetic data and mocked auth/API/router. This is a temporary Vite preview, not native Next or production verification.
- **LIVE_PUBLIC:** signed-out production browser inspection at 1440, 390 and 320px, with reduced motion. Public content was scrolled to reveal lazy sections before final captures.
- **LIVE_AUTHENTICATED:** a signed-in Codex browser session was discovered after Chrome reached security verification. Read-only checks covered dashboard, clients/create form/detail, request detail/new-request draft (all four steps), settings (all four tabs), token health and Google/Meta management dialogs. Widths included 1440, 758 and 320px. No production changes were submitted. The new-request draft was walked without creating a request. Native screenshots appear in the conversation; sanitized receipts are saved below.

Local capture matrix: 34 scenarios at three widths, plus focused actual client-detail, scrolling and keyboard probes. Six base captures (onboarding and Clients error, across three widths) hit the source development strict-motion exception and are not successful visual passes. Mobile content captures close the initially open menu; separate evidence preserves the initial obstruction. Protected pages scroll within the shell, so selected bottom captures supplement their initial viewport.

Live public matrix: 13 representative URLs at three widths. Eleven render page content; both guide URLs redirect to authentication. Blog and comparison slug families are sampled, not every generated page. Article hydration errors remain recorded. Full-page screenshots show layout; they are not proof that every action works.

Native Next development startup failed because an installed Sentry/OpenTelemetry dependency was missing. Existing Vite preview configuration also had a dependency mismatch; only temporary preview files were adapted. No dependency or application edits were made. Production OAuth, grants, client invitations, payments, offboarding, partner payouts, and admin mutations were not performed.

Baseline: `main` at `c80037d57841fff2155911461e99702838ffb6d5`, plus existing dirty files. Concurrent Meta selector/settings edits appeared during inspection. Source and deployed public markup differ in places. Recheck touched lines against the implementation branch before fixing.

## Priority and suggested repair order

P1 blocks a task, risks losing work, makes a consequential false claim, or fails a central accessibility requirement. P2 materially harms readability, interaction, recovery or consistency. P3 is isolated polish. Pure stylistic deviations are not automatically P1.

| Batch | Work | Dependencies | Exit criterion |
| --- | --- | --- | --- |
| 1. Workflow truth | O01–O06/O11, R03/R10, C02, T03, M06 | Observe final CTA request; use current persisted contracts | Final navigation works; edits survive cancellation; all clients are reachable; status claims are verified |
| 2. Shared controls | S01–S09, S12–S15, T02 | Accessible button pairing must update the visual contract; fix Slot before converting nested links | Correct logos, contrast, full hit areas, one interactive element, usable navigation/focus and landmarks |
| 3. Narrow screens | C04, T01, then full view review | Shared controls and stable populated fixtures | 320/390px and 200% zoom show complete labels/actions without collision or unintended scrolling |
| 4. Recovery and forms | R01–R02, R04, R08–R09, C03/C05/C07, T04–T06, A01–A03 | Reuse existing error/query patterns; unify accessible dialog behavior | Keyboard and simulated failure/retry retain work and explain the next action |
| 5. Consistency and public finish | S10–S11, T07–T10, M01–M05/M07–M08, remaining P3 | First four batches | Whole views meet palette, hierarchy, shadow and motion contracts; visible conversion actions work |
| 6. Final coverage | All rows with unverified states below | Signed-in/role-specific access and safe fixtures | Native and live journey coverage is explicit; no source-only finding is labeled visually verified |

These batches propose order, not feature approval. No commits, pushes, PRs, deployments or production data changes occurred.

## Acceptance standard for polish

- One clear primary action per visible task state; accurate progress, status and destination wording.
- Shared control sizes, product icons, borders, typography roles and semantic colors follow the documented system.
- Text contrast meets [WCAG contrast minimum](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html): 4.5:1 for ordinary text and 3:1 for qualifying large text. S02 uses computed source colors, not pixel estimates.
- 320px, 390px and desktop remain readable with realistic long names, emails, identifiers, statuses and empty data.
- Keyboard order, labels, selected states, dialog containment/return focus, skip links and announced validation are complete.
- Loading, empty, permission-denied, offline/transient failure, terminal expiration, partial authorization, success and retry remain truthful.
- Reduced-motion views remain static where requested; app motion uses existing tokens and does not hide required content.

## Findings

### Shared system

#### S01 · P2 · Facebook Pages uses a typed f instead of its logo

**Evidence:** SOURCE + USER_SCREENSHOT + LOCAL_PREVIEW.

The exact grant component renders <span>f</span>. Shared meta_pages mapping separately resolves to meta.com, mixing product and corporate identity.

**Smallest repair:** Use an existing local Facebook product asset through one shared icon mapping. Keep Meta corporate identity where appropriate.

**Accept when:** Pages, Ads and Meta labels each show the intended asset at 16–48px, including fallback.

**Source:** [AutomaticPagesGrant.tsx:214](/Users/jon.high/agency-access/apps/web/src/components/client-auth/AutomaticPagesGrant.tsx:214), [platform-icon.tsx:45](/Users/jon.high/agency-access/apps/web/src/components/ui/platform-icon.tsx:45), [types.ts:619](/Users/jon.high/agency-access/packages/shared/src/types.ts:619).

**Screenshots:** [1440-facebook-grant.png](./evidence/1440-facebook-grant.png), [320-facebook-grant.png](./evidence/320-facebook-grant.png).

#### S02 · P1 · Primary button text fails contrast

**Evidence:** SOURCE + LOCAL_PREVIEW + LIVE_AUTHENTICATED.

Grant Access computes white text on rgb(255,107,53), 18px/600: contrast 2.835:1. Shared primary/brutalist variants repeat this combination. This also exposes a contradiction in the documented button contract.

**Smallest repair:** Correct the shared foreground/fill pair and document the accessible pairing. Ink text on coral is a candidate; verify before choosing.

**Accept when:** All enabled shared variants pass 4.5:1 for ordinary text, or 3:1 where text meets the large-text definition, including hover.

**Source:** [button.tsx:58](/Users/jon.high/agency-access/apps/web/src/components/ui/button.tsx:58), [globals.css:38](/Users/jon.high/agency-access/apps/web/src/app/globals.css:38).

**Screenshots:** [1440-facebook-grant.png](./evidence/1440-facebook-grant.png).

#### S03 · P1 · Button asChild discards the styled interactive element

**Evidence:** SOURCE + LOCAL_PREVIEW.

Button passes a Fragment containing a span into Radix Slot. Callback links render as adjacent unstyled anchors, each only 24px high. Source consumers include marketing, comparison and callback controls.

**Smallest repair:** Pass the actual interactive child to Slot. Preserve icon/loading content inside that child using the existing dependency.

**Accept when:** Each asChild consumer has one styled, focusable anchor. Its full visible area activates navigation and retains a 44px target.

**Source:** [button.tsx:78](/Users/jon.high/agency-access/apps/web/src/components/ui/button.tsx:78), [page.tsx:394](/Users/jon.high/agency-access/apps/web/src/app/platforms/callback/page.tsx:394).

**Screenshots:** [1440-platform-callback-error.png](./evidence/1440-platform-callback-error.png).

#### S04 · P1 · Mobile navigation covers each page on first load

**Evidence:** SOURCE + LOCAL_PREVIEW + LIVE_AUTHENTICATED.

The authenticated layout initializes open=true for desktop and mobile. At 320/390px a full-screen navigation dialog obscures the destination until dismissed.

**Smallest repair:** Keep desktop expansion independent from mobile menu visibility. Start the mobile menu closed.

**Accept when:** Direct visits and navigation show page content first; the menu opens only from its trigger.

**Source:** [layout.tsx:90](/Users/jon.high/agency-access/apps/web/src/app/(authenticated)/layout.tsx:90), [sidebar.tsx:124](/Users/jon.high/agency-access/apps/web/src/components/ui/sidebar.tsx:124).

**Screenshots:** [390-mobile-menu-initially-open.png](./evidence/390-mobile-menu-initially-open.png).

#### S05 · P2 · Mobile menu lacks complete keyboard behavior

**Evidence:** SOURCE + LOCAL_PREVIEW.

The panel declares a modal dialog without focus containment, return focus or Escape handling. Local Escape testing leaves the dialog open at both mobile widths.

**Smallest repair:** Use native dialog behavior or a verified accessible primitive for keyboard handling. Restore focus to the menu trigger.

**Accept when:** Escape closes the panel, Tab stays inside it, background controls cannot receive focus, and focus returns to the opener.

**Source:** [sidebar.tsx:150](/Users/jon.high/agency-access/apps/web/src/components/ui/sidebar.tsx:150).

#### S06 · P2 · Primary content landmarks are inconsistent

**Evidence:** SOURCE + LOCAL_PREVIEW + LIVE_PUBLIC + LIVE_AUTHENTICATED.

Core authenticated previews expose no main landmark. Live home/pricing/about/contact expose two nested main elements; live home also exposes two h1 headings.

**Smallest repair:** Give each page one main region and one clear primary heading. Correct ownership at shared layout boundaries.

**Accept when:** Landmark navigation exposes one named main region on every route; headings reflect the document hierarchy.

**Source:** [layout.tsx:296](/Users/jon.high/agency-access/apps/web/src/app/(authenticated)/layout.tsx:296), [layout.tsx:30](/Users/jon.high/agency-access/apps/web/src/app/(marketing)/layout.tsx:30), [page.tsx:61](/Users/jon.high/agency-access/apps/web/src/app/(marketing)/page.tsx:61).

#### S07 · P2 · Recurring navigation has no skip-to-content route

**Evidence:** SOURCE.

Marketing and authenticated shells have no first-focus skip link. Keyboard users traverse recurring navigation before reaching each destination.

**Smallest repair:** Add a visible-on-focus skip link to the unique main region.

**Accept when:** The first Tab exposes Skip to content; activation moves keyboard focus to the content.

**Source:** [layout.tsx:25](/Users/jon.high/agency-access/apps/web/src/app/(marketing)/layout.tsx:25), [layout.tsx:296](/Users/jon.high/agency-access/apps/web/src/app/(authenticated)/layout.tsx:296).

#### S08 · P2 · Small icon targets remain outside shared sizing

**Evidence:** SOURCE + LOCAL_PREVIEW.

Selected Facebook page removal targets measure 16×16px. Token refresh controls and desktop sidebar collapse use undersized hit areas. Internal filters use 40px heights.

**Smallest repair:** Apply the documented 44px hit area through shared icon/button patterns. Preserve visual icon size.

**Accept when:** Pointer targets meet the project 44px contract without overlapping adjacent controls.

**Source:** [AutomaticPagesGrant.tsx:240](/Users/jon.high/agency-access/apps/web/src/components/client-auth/AutomaticPagesGrant.tsx:240), [sidebar.tsx:100](/Users/jon.high/agency-access/apps/web/src/components/ui/sidebar.tsx:100), [page.tsx:208](/Users/jon.high/agency-access/apps/web/src/app/(authenticated)/token-health/page.tsx:208), [page.tsx:80](/Users/jon.high/agency-access/apps/web/src/app/(authenticated)/internal/admin/agencies/page.tsx:80).

#### S09 · P2 · Explicit corner radii bypass the square-or-circle rule

**Evidence:** SOURCE + LIVE_AUTHENTICATED.

Provider groups use rounded-[1rem]. Clerk CSS specifies 8px, .5rem and .75rem. Ordinary rounded-lg/xl utilities already resolve to zero and are excluded.

**Smallest repair:** Replace explicit rectangular radii with zero; retain circles for avatars and circular icon controls.

**Accept when:** Computed styles follow the binary radius contract in provider dialogs and real Clerk widgets.

**Source:** [meta-unified-settings.tsx:272](/Users/jon.high/agency-access/apps/web/src/components/meta-unified-settings.tsx:272), [google-unified-settings.tsx:491](/Users/jon.high/agency-access/apps/web/src/components/google-unified-settings.tsx:491), [globals.css:707](/Users/jon.high/agency-access/apps/web/src/app/globals.css:707).

#### S10 · P2 · Static cards retain excessive or misleading elevation

**Evidence:** SOURCE + LOCAL_PREVIEW + LIVE_AUTHENTICATED.

Client statistics, headers, request edit cards, partner tables and manual dialogs retain resting soft/hard shadows. Several non-clickable cards gain hover elevation. Live Connections also shows more than three resting filled Connect action shadows in one view.

**Smallest repair:** Use existing border-led surfaces. Reserve the three-shadow budget for intentional emphasis and interactive affordances.

**Accept when:** Review full views, not individual components: <=3 intended shadows; static cards do not imply click behavior.

**Source:** [ClientStats.tsx:54](/Users/jon.high/agency-access/apps/web/src/components/client-detail/ClientStats.tsx:54), [page.tsx:379](/Users/jon.high/agency-access/apps/web/src/app/(authenticated)/access-requests/[id]/edit/page.tsx:379), [affiliate-ledger-table.tsx:26](/Users/jon.high/agency-access/apps/web/src/components/affiliate/affiliate-ledger-table.tsx:26), [manual-invitation-modal.tsx:146](/Users/jon.high/agency-access/apps/web/src/components/manual-invitation-modal.tsx:146).

#### S11 · P2 · Danger color appears on neutral operations

**Evidence:** SOURCE.

Onboarding section headings, partner links, admin navigation and ordinary token refresh actions use danger-ink. Warning meaning becomes inconsistent.

**Smallest repair:** Use neutral ink for routine operations. Keep danger ink for destructive actions and actual errors.

**Accept when:** Normal headings/links/refresh actions do not resemble failures; semantic status colors remain consistent.

**Source:** [agency-profile-screen.tsx:87](/Users/jon.high/agency-access/apps/web/src/components/onboarding/screens/agency-profile-screen.tsx:87), [page.tsx:99](/Users/jon.high/agency-access/apps/web/src/app/(partner)/partners/page.tsx:99), [page.tsx:391](/Users/jon.high/agency-access/apps/web/src/app/(authenticated)/token-health/page.tsx:391).

#### S12 · P2 · Strict LazyMotion rejects raw motion components in development

**Evidence:** SOURCE + LOCAL_PREVIEW.

The actual AppProviders uses LazyMotion strict. Onboarding and the Clients error branch render raw motion components, causing a development runtime error in the source preview. The development error is not proof of a production outage.

**Smallest repair:** Use the existing m primitives inside LazyMotion. Apply existing app motion durations and reduced-motion behavior.

**Accept when:** Native development routes and error states render without the strict-mode exception; reduced motion remains functional.

**Source:** [app-providers.tsx:24](/Users/jon.high/agency-access/apps/web/src/app/app-providers.tsx:24), [unified-wizard.tsx:228](/Users/jon.high/agency-access/apps/web/src/components/onboarding/unified-wizard.tsx:228), [page.tsx:130](/Users/jon.high/agency-access/apps/web/src/app/(authenticated)/clients/page.tsx:130).

#### S13 · P1 · Provider dialogs allow focus behind the overlay

**Evidence:** SOURCE + LIVE_AUTHENTICATED.

ManageAssetsModalShell supplies dialog semantics and Escape but no initial/return focus or Tab containment. In live Google settings, Shift+Tab from Done twice focuses the background Connect button.

**Smallest repair:** Use native dialog behavior or a verified installed accessible primitive for the shared shell. Keep the existing provider bodies.

**Accept when:** Tab/Shift+Tab remain in the modal; background controls cannot activate; dismissal restores the Manage assets opener.

**Source:** [manage-assets-modal-shell.tsx:31](/Users/jon.high/agency-access/apps/web/src/components/manage-assets-modal-shell.tsx:31), [manage-assets-modal-shell.tsx:69](/Users/jon.high/agency-access/apps/web/src/components/manage-assets-modal-shell.tsx:69).

#### S14 · P1 · Meta asset toggles have no accessible names

**Evidence:** SOURCE + LIVE_AUTHENTICATED.

Five top-level Meta asset checkboxes expose no label in the live dialog. Source renders inputs beside paragraph labels without association. Google already names its equivalent toggles.

**Smallest repair:** Associate each checkbox with its asset name/description and use the existing named checkbox pattern.

**Accept when:** Screen readers announce Enable Ad Account, Page, Catalog, Dataset and Instagram Account, plus checked state.

**Source:** [meta-unified-settings.tsx:474](/Users/jon.high/agency-access/apps/web/src/components/meta-unified-settings.tsx:474), [google-unified-settings.tsx:501](/Users/jon.high/agency-access/apps/web/src/components/google-unified-settings.tsx:501).

#### S15 · P2 · Request customization has an unnamed removal action

**Evidence:** SOURCE + LIVE_AUTHENTICATED.

Live Customize exposes an icon-only field removal button with no accessible name. Source confirms the Trash2 button has no aria-label or text. Repeated Review Edit buttons also lack section-specific names.

**Smallest repair:** Name removal with its field label and each edit action with its section. Use the existing shared icon-button sizing contract.

**Accept when:** Screen readers distinguish Remove Company Website, Edit client, Edit platforms, Edit access level and Edit form fields; removal has a 44px target.

**Source:** [page.tsx:566](/Users/jon.high/agency-access/apps/web/src/app/(authenticated)/access-requests/new/page.tsx:566), [page.tsx:767](/Users/jon.high/agency-access/apps/web/src/app/(authenticated)/access-requests/new/page.tsx:767).

### Onboarding

#### O01 · P1 · Go to Dashboard repeats agency creation/update

**Evidence:** SOURCE + USER_SCREENSHOT.

Final navigation invokes completeOnboarding, which calls resolveAgency again. That helper can POST or PATCH an agency. Agency resolution can encounter duplicate-name rejection; the API create path returns the exact duplicate-name error in the user screenshot. The failing production branch remains unverified.

**Smallest repair:** Use the persisted agencyId from link creation for final completion/navigation. Recover missing state explicitly rather than repeating agency mutation.

**Accept when:** Existing agency, duplicate name, reload/resume and repeated-click cases reach the dashboard once. Confirm the actual failing production network request.

**Source:** [final-success-screen.tsx:73](/Users/jon.high/agency-access/apps/web/src/components/onboarding/screens/final-success-screen.tsx:73), [unified-onboarding-context.tsx:942](/Users/jon.high/agency-access/apps/web/src/contexts/unified-onboarding-context.tsx:942), [unified-onboarding-context.tsx:623](/Users/jon.high/agency-access/apps/web/src/contexts/unified-onboarding-context.tsx:623), [agency.service.ts:149](/Users/jon.high/agency-access/apps/api/src/services/agency.service.ts:149).

#### O02 · P1 · Resume restores the step without required request data

**Evidence:** SOURCE.

Hydration restores agencyId and currentStep but leaves link, request, client, platform and invite data at in-memory defaults. Lifecycle can resume directly at steps 4–6.

**Smallest repair:** Hydrate data required by the resumed step from persisted state, or resume at an existing stable request/dashboard destination.

**Accept when:** Refreshing each post-link step retains the exact request/link/client and truthful invitation state.

**Source:** [unified-onboarding-context.tsx:1036](/Users/jon.high/agency-access/apps/web/src/contexts/unified-onboarding-context.tsx:1036), [unified-onboarding-context.tsx:287](/Users/jon.high/agency-access/apps/web/src/contexts/unified-onboarding-context.tsx:287), [onboarding.ts:44](/Users/jon.high/agency-access/apps/web/src/lib/query/onboarding.ts:44).

#### O03 · P2 · Final screen shows competing completion controls

**Evidence:** SOURCE + USER_SCREENSHOT.

The final screen offers Go to Dashboard while the shared footer renders a disabled Complete button. The screenshot confirms the contradiction.

**Smallest repair:** Use one completion action. Remove the duplicate final footer control.

**Accept when:** The final screen presents one enabled, clear completion path on pointer and keyboard.

**Source:** [unified-wizard.tsx:301](/Users/jon.high/agency-access/apps/web/src/components/onboarding/unified-wizard.tsx:301), [unified-onboarding-context.tsx:458](/Users/jon.high/agency-access/apps/web/src/contexts/unified-onboarding-context.tsx:458).

#### O04 · P2 · 100% Complete appears before persistence succeeds

**Evidence:** SOURCE + USER_SCREENSHOT.

Percentage depends on step index, reaching 100% at the final screen before completion API calls succeed.

**Smallest repair:** Show Step 7 of 7 until completion is confirmed, or calculate completion from persisted lifecycle.

**Accept when:** Failed finalization never displays a completed state.

**Source:** [unified-wizard.tsx:166](/Users/jon.high/agency-access/apps/web/src/components/onboarding/unified-wizard.tsx:166), [unified-onboarding-context.tsx:942](/Users/jon.high/agency-access/apps/web/src/contexts/unified-onboarding-context.tsx:942).

#### O05 · P2 · Final completion lacks busy state and duplicate-click guard

**Evidence:** SOURCE.

The raw final button has no disabled/loading state, and the completion handler does not set loading before resolve/persist.

**Smallest repair:** Guard the shared completion handler and reflect its pending state in the one final button.

**Accept when:** Two rapid activations produce one completion operation and an announced pending state.

**Source:** [final-success-screen.tsx:73](/Users/jon.high/agency-access/apps/web/src/components/onboarding/screens/final-success-screen.tsx:73), [unified-onboarding-context.tsx:942](/Users/jon.high/agency-access/apps/web/src/contexts/unified-onboarding-context.tsx:942).

#### O06 · P2 · Pending copy assumes Google for every request

**Evidence:** SOURCE.

Platform selection permits Meta-only and other selections, but generated-link/final/request-success copy says the client must finish Google.

**Smallest repair:** Derive copy from requested platforms and actual completion status. Use neutral wording for multi-platform requests.

**Accept when:** Meta-only, Google-only and multi-platform requests all show accurate next-step instructions.

**Source:** [success-link-screen.tsx:63](/Users/jon.high/agency-access/apps/web/src/components/onboarding/screens/success-link-screen.tsx:63), [final-success-screen.tsx:41](/Users/jon.high/agency-access/apps/web/src/components/onboarding/screens/final-success-screen.tsx:41), [page.tsx:128](/Users/jon.high/agency-access/apps/web/src/app/(authenticated)/access-requests/[id]/success/page.tsx:128).

#### O07 · P3 · Clipboard promise does not match the action

**Evidence:** SOURCE.

Platform selection promises automatic clipboard copying. The following screen copies only after explicit activation.

**Smallest repair:** Change the promise to match the existing Copy link action; show its actual success/failure.

**Accept when:** Visible instructions and clipboard behavior match when permissions allow and when copying fails.

**Source:** [platform-selection-screen.tsx:137](/Users/jon.high/agency-access/apps/web/src/components/onboarding/screens/platform-selection-screen.tsx:137), [success-link-screen.tsx:46](/Users/jon.high/agency-access/apps/web/src/components/onboarding/screens/success-link-screen.tsx:46).

#### O08 · P2 · Team invitations allow duplicate addresses

**Evidence:** SOURCE.

The context appends without normalization/deduplication. UI keys rows by email. Role buttons also lack selected-state semantics.

**Smallest repair:** Normalize and reject duplicate addresses. Use native radios or explicit selected-state semantics for roles.

**Accept when:** Repeated case-variant email produces one invitation; keyboard/screen reader announces the selected role.

**Source:** [unified-onboarding-context.tsx:518](/Users/jon.high/agency-access/apps/web/src/contexts/unified-onboarding-context.tsx:518), [team-invite-screen.tsx:137](/Users/jon.high/agency-access/apps/web/src/components/onboarding/screens/team-invite-screen.tsx:137).

#### O09 · P2 · Agency validation waits until later steps

**Evidence:** SOURCE.

The profile permits any nonempty name despite a two-character hint. Server collision errors arrive at create/update, including final navigation.

**Smallest repair:** Apply the agreed local name rule at the profile field. Attach server collision feedback to that field at the initial agency operation.

**Accept when:** Short/duplicate names produce a clear field error with preserved data, before link generation.

**Source:** [unified-onboarding-context.tsx:458](/Users/jon.high/agency-access/apps/web/src/contexts/unified-onboarding-context.tsx:458), [agency-profile-screen.tsx:96](/Users/jon.high/agency-access/apps/web/src/components/onboarding/screens/agency-profile-screen.tsx:96), [agency.service.ts:149](/Users/jon.high/agency-access/apps/api/src/services/agency.service.ts:149).

#### O10 · P3 · Team completion wording and counts are unverified

**Evidence:** SOURCE.

The displayed sent count uses invite-list length. Team-screen copy promises dashboard navigation, but Continue advances to another final screen.

**Smallest repair:** Use confirmed invitation results for sent counts and describe the actual next destination.

**Accept when:** Skip, successful invite, partial failure and resume each display accurate counts and destination copy.

**Source:** [page.tsx:258](/Users/jon.high/agency-access/apps/web/src/app/onboarding/unified/page.tsx:258), [team-invite-screen.tsx:244](/Users/jon.high/agency-access/apps/web/src/components/onboarding/screens/team-invite-screen.tsx:244).

#### O11 · P1 · An established workspace intermittently opens first-time setup

**Evidence:** SOURCE + LIVE_AUTHENTICATED.

From a live dashboard with 12 requests and 12 active connections, the first Clients navigation redirected to onboarding Step 1. Later Clients/Settings visits loaded the existing agency. The triggering lookup/cache/guard branch is unconfirmed.

**Smallest repair:** Trace the cold-navigation agency/status lookup and redirect cache. Keep transient lookup failure distinct from a confirmed absent/incomplete agency.

**Accept when:** Cold and warm navigation to every protected route consistently preserves the existing workspace; genuine new agencies still enter onboarding.

**Source:** [layout.tsx:141](/Users/jon.high/agency-access/apps/web/src/app/(authenticated)/layout.tsx:141), [use-user-agency.ts:45](/Users/jon.high/agency-access/apps/web/src/hooks/use-user-agency.ts:45).

### Requests and invites

#### R01 · P2 · Missing request and service failure share one dead end

**Evidence:** SOURCE.

Request detail labels every fetch failure Request Not Found, without retry/back actions. Success route has a different recovery pattern.

**Smallest repair:** Distinguish missing/expired data from transient failures. Reuse one recovery pattern with retry or a clear destination.

**Accept when:** 404 and 503 produce different guidance; a recovered service can reload the same request.

**Source:** [page.tsx:229](/Users/jon.high/agency-access/apps/web/src/app/(authenticated)/access-requests/[id]/page.tsx:229), [page.tsx:114](/Users/jon.high/agency-access/apps/web/src/app/(authenticated)/access-requests/[id]/success/page.tsx:114).

#### R02 · P2 · Missing-platform submission error disappears

**Evidence:** SOURCE.

The context moves PLATFORMS_NOT_CONNECTED failures back to step 2; the page only displays state.error in step 4.

**Smallest repair:** Render the error at the shared wizard level or at the destination step, with the required connection action.

**Accept when:** Simulated missing-platform response shows an explanation on Platforms, preserves the draft and allows recovery.

**Source:** [access-request-context.tsx:544](/Users/jon.high/agency-access/apps/web/src/contexts/access-request-context.tsx:544), [page.tsx:932](/Users/jon.high/agency-access/apps/web/src/app/(authenticated)/access-requests/new/page.tsx:932).

#### R03 · P1 · Edit Back bypasses the discard confirmation

**Evidence:** SOURCE.

The prominent Back control calls router.back. Only beforeunload is guarded; footer discard already uses a confirmation.

**Smallest repair:** Route the Back control through the existing discard dialog.

**Accept when:** Dirty form + Back offers Keep editing/Discard; keeping retains every value. Clean forms navigate directly.

**Source:** [page.tsx:200](/Users/jon.high/agency-access/apps/web/src/app/(authenticated)/access-requests/[id]/edit/page.tsx:200), [page.tsx:365](/Users/jon.high/agency-access/apps/web/src/app/(authenticated)/access-requests/[id]/edit/page.tsx:365).

#### R04 · P2 · Cancel request failure has no user feedback

**Evidence:** SOURCE.

The cancellation handler has try/finally without catch. A rejected mutation cannot show a useful recovery message in the dialog.

**Smallest repair:** Display the error in the existing confirmation and allow retry. Preserve the active request when cancellation fails.

**Accept when:** A simulated 503 keeps request state accurate and presents a clear retry path.

**Source:** [request-actions-bar.tsx:42](/Users/jon.high/agency-access/apps/web/src/components/access-request-detail/request-actions-bar.tsx:42).

#### R05 · P2 · Request actions nest buttons inside links

**Evidence:** SOURCE.

Action-bar Link elements wrap Button components, creating nested interactive controls.

**Smallest repair:** Use a single styled link after fixing S03, or the established link styling.

**Accept when:** Each action exposes exactly one keyboard focus target and one accessible role.

**Source:** [request-actions-bar.tsx:60](/Users/jon.high/agency-access/apps/web/src/components/access-request-detail/request-actions-bar.tsx:60).

#### R06 · P3 · Request review exposes raw platform group identifiers

**Evidence:** SOURCE + LIVE_AUTHENTICATED.

The new-request summary renders raw group keys such as google instead of shared display names. Live Review confirms google (6).

**Smallest repair:** Use PLATFORM_NAMES consistently in review and related approval views.

**Accept when:** Google, Meta and LinkedIn group labels use consistent display names; product selections remain understandable.

**Source:** [page.tsx:783](/Users/jon.high/agency-access/apps/web/src/app/(authenticated)/access-requests/new/page.tsx:783).

#### R07 · P2 · Success page permanently labels a request pending

**Evidence:** SOURCE.

The success route uses fixed pending copy despite loading current request data. Revisiting a completed request can contradict its detail view.

**Smallest repair:** Render the current persisted status and matching next action.

**Accept when:** Revisit pending, partial, completed, revoked and expired requests; success/detail views agree.

**Source:** [page.tsx:128](/Users/jon.high/agency-access/apps/web/src/app/(authenticated)/access-requests/[id]/success/page.tsx:128).

#### R08 · P2 · Manual flows retry expired or revoked invitations

**Evidence:** SOURCE.

Main invite uses a terminal card for dead links. Manual flow maps every load error to a retry card.

**Smallest repair:** Reuse the existing terminal classifier/card in all six manual flows.

**Accept when:** Expired/revoked links show agency-contact guidance; transient failures offer retry.

**Source:** [manual-invite-flow.tsx:333](/Users/jon.high/agency-access/apps/web/src/components/flow/manual-invite-flow.tsx:333), [client-invite-page.tsx:602](/Users/jon.high/agency-access/apps/web/src/app/invite/[token]/client-invite-page.tsx:602).

#### R09 · P2 · Manual validation is disconnected from its field

**Evidence:** SOURCE.

Manual form errors are visually present without aria-invalid or aria-describedby.

**Smallest repair:** Associate errors with their inputs and announce submission outcomes using existing form patterns.

**Accept when:** Invalid manual input has an announced error and a stable association; valid submission clears it.

**Source:** [manual-invite-flow.tsx:107](/Users/jon.high/agency-access/apps/web/src/components/flow/manual-invite-flow.tsx:107).

#### R10 · P1 · Valid request statuses fall back to Unknown

**Evidence:** SOURCE + LIVE_AUTHENTICATED.

Live dashboard request rows and request detail show Unknown. Their callers cast request status as any; shared StatusBadge has no completed or partial configurations. These are valid request lifecycle values.

**Smallest repair:** Add explicit supported request lifecycle presentations or a typed request-status adapter. Remove the casts that bypass the contract.

**Accept when:** Pending, partial, completed, expired and revoked each render a clear, accurate label on dashboard/detail/success.

**Source:** [status-badge.tsx:10](/Users/jon.high/agency-access/apps/web/src/components/ui/status-badge.tsx:10), [status-badge.tsx:146](/Users/jon.high/agency-access/apps/web/src/components/ui/status-badge.tsx:146), [page.tsx:569](/Users/jon.high/agency-access/apps/web/src/app/(authenticated)/dashboard/page.tsx:569), [request-overview-card.tsx:50](/Users/jon.high/agency-access/apps/web/src/components/access-request-detail/request-overview-card.tsx:50).

#### R11 · P2 · Request, connection and platform statuses lack clear domain labels

**Evidence:** SOURCE + LIVE_AUTHENTICATED.

For one live request, the platform board says Revoked, its history row says Active, and detail says Unknown plus Waiting on client authorization. Some statuses describe different domains; the UI does not explain that distinction.

**Smallest repair:** Label request lifecycle and connection/asset health separately. Use typed shared mappings without forcing distinct domain states into one generic badge.

**Accept when:** A request with an active connection but unfinished/revoked asset requirements shows both facts accurately, with clear next action and agreement across views.

**Source:** [OverviewTab.tsx:111](/Users/jon.high/agency-access/apps/web/src/components/client-detail/OverviewTab.tsx:111), [RequestedAccessBoard.tsx:90](/Users/jon.high/agency-access/apps/web/src/components/client-detail/RequestedAccessBoard.tsx:90), [request-overview-card.tsx:50](/Users/jon.high/agency-access/apps/web/src/components/access-request-detail/request-overview-card.tsx:50).

### Clients

#### C01 · P2 · Filters changes tint but does not filter

**Evidence:** SOURCE + LOCAL_PREVIEW + LIVE_AUTHENTICATED.

Click only toggles showFilters. No filter panel or query change consumes that state.

**Smallest repair:** Remove the unsupported control, or wire the filters required by the current product using existing query inputs.

**Accept when:** Every visible filter changes results and provides a clear reset state.

**Source:** [page.tsx:53](/Users/jon.high/agency-access/apps/web/src/app/(authenticated)/clients/page.tsx:53), [page.tsx:173](/Users/jon.high/agency-access/apps/web/src/app/(authenticated)/clients/page.tsx:173).

#### C02 · P1 · Clients after the first page cannot be reached

**Evidence:** SOURCE + LOCAL_PREVIEW.

The query omits pagination, backend defaults to a finite page, and UI reports total without pagination/load-more controls. The synthetic fixture displays one of 61.

**Smallest repair:** Use the existing paginated API contract to expose subsequent records.

**Accept when:** An account with more clients than one API page can reach/search the last record and correctly reports current results versus total.

**Source:** [page.tsx:83](/Users/jon.high/agency-access/apps/web/src/app/(authenticated)/clients/page.tsx:83), [page.tsx:285](/Users/jon.high/agency-access/apps/web/src/app/(authenticated)/clients/page.tsx:285), [clients.ts:133](/Users/jon.high/agency-access/apps/api/src/routes/clients.ts:133).

#### C03 · P2 · Client identifiers truncate without inspection

**Evidence:** SOURCE.

List name/company/email use truncate without title/details reveal. Search has only a placeholder label; no-result copy offers no reset.

**Smallest repair:** Allow full identifier inspection, name the search input and provide Clear search in the filtered empty state.

**Accept when:** Long names/emails remain distinguishable at 320px; search has a name; reset restores results.

**Source:** [page.tsx:164](/Users/jon.high/agency-access/apps/web/src/app/(authenticated)/clients/page.tsx:164), [page.tsx:199](/Users/jon.high/agency-access/apps/web/src/app/(authenticated)/clients/page.tsx:199), [page.tsx:226](/Users/jon.high/agency-access/apps/web/src/app/(authenticated)/clients/page.tsx:226).

#### C04 · P1 · Client detail exceeds its mobile container

**Evidence:** SOURCE + LOCAL_PREVIEW.

Actual route preview with a long client name/email has a 402px scroll area inside a 318px container at 320px. Header badge/email and fixed padding force horizontal scrolling. The existing mixed-Google harness also shows collisions.

**Smallest repair:** Reduce narrow padding, wrap the heading/status/actions and break long identifiers. Keep dates aligned without overlap.

**Accept when:** At 320px/390px and 200% zoom, long client data produces no unintended horizontal scrolling or overlapping labels.

**Source:** [page.tsx:129](/Users/jon.high/agency-access/apps/web/src/app/(authenticated)/clients/[id]/page.tsx:129), [ClientDetailHeader.tsx:72](/Users/jon.high/agency-access/apps/web/src/components/client-detail/ClientDetailHeader.tsx:72), [OverviewTab.tsx:117](/Users/jon.high/agency-access/apps/web/src/components/client-detail/OverviewTab.tsx:117).

**Screenshots:** [320-client-detail-preview.png](./evidence/320-client-detail-preview.png).

#### C05 · P2 · Client tabs use a different keyboard model

**Evidence:** SOURCE.

Client tabs declare role=tab but keep all tabs in sequence and omit Arrow/Home/End handlers. Settings already implements the correct reusable behavior.

**Smallest repair:** Reuse the existing settings tab keyboard behavior.

**Accept when:** Arrow/Home/End moves selected focus correctly; one tab is in the tab sequence and its panel is associated.

**Source:** [ClientTabs.tsx:53](/Users/jon.high/agency-access/apps/web/src/components/client-detail/ClientTabs.tsx:53), [settings-tabs.tsx:57](/Users/jon.high/agency-access/apps/web/src/components/settings/settings-tabs.tsx:57).

#### C06 · P3 · Filtered empty state asks to create another request

**Evidence:** SOURCE.

Overview reuses a create-request message when existing requests simply do not match a status filter.

**Smallest repair:** Show filter-specific copy and a Clear filter action. Keep creation guidance for genuinely empty clients.

**Accept when:** Every status filter distinguishes no matching results from no requests.

**Source:** [OverviewTab.tsx:91](/Users/jon.high/agency-access/apps/web/src/components/client-detail/OverviewTab.tsx:91).

#### C07 · P2 · Client overlays lack the common dialog contract

**Evidence:** SOURCE + LIVE_AUTHENTICATED.

Create Client, Delete Client and Create Request use generic motion containers without complete dialog/focus behavior. Create labels lack htmlFor/IDs and the close icon has no name. Live Create Client exposes zero dialog roles, four fields without associated labels, and one unnamed close button. Edit Client has dialog/Escape semantics but still lacks focus containment.

**Smallest repair:** Use one accessible dialog shell with native dialog behavior or a verified installed primitive. Associate labels and name the close action.

**Accept when:** All overlays have a name, initial/return focus, Tab containment and Escape; fields expose labels and failures.

**Source:** [CreateClientModal.tsx:120](/Users/jon.high/agency-access/apps/web/src/components/client-detail/CreateClientModal.tsx:120), [CreateClientModal.tsx:143](/Users/jon.high/agency-access/apps/web/src/components/client-detail/CreateClientModal.tsx:143), [DeleteClientModal.tsx:138](/Users/jon.high/agency-access/apps/web/src/components/client-detail/DeleteClientModal.tsx:138), [CreateRequestModal.tsx:275](/Users/jon.high/agency-access/apps/web/src/components/client-detail/CreateRequestModal.tsx:275), [EditClientModal.tsx:78](/Users/jon.high/agency-access/apps/web/src/components/client-detail/EditClientModal.tsx:78).

#### C08 · P2 · Total Requests on the client list counts connections

**Evidence:** SOURCE + LIVE_AUTHENTICATED.

Live list reports Total Requests:1, while the same client detail reports 12. Source binds the Total Requests label to client.connectionCount.

**Smallest repair:** Render the actual request count, or relabel the existing metric accurately if the list contract intentionally exposes only connection count.

**Accept when:** List/detail use the same request-count definition; connection count has its own label.

**Source:** [page.tsx:256](/Users/jon.high/agency-access/apps/web/src/app/(authenticated)/clients/page.tsx:256), [client.service.ts:353](/Users/jon.high/agency-access/apps/api/src/services/client.service.ts:353), [client.service.ts:1080](/Users/jon.high/agency-access/apps/api/src/services/client.service.ts:1080).

### Settings and connections

#### T01 · P1 · Token Health columns overlap and clip on mobile

**Evidence:** SOURCE + LOCAL_PREVIEW + LIVE_AUTHENTICATED.

The fixed twelve-column grid compresses five desktop columns into 320px. The local bottom-of-page capture shows client text, Healthy badge, expiry and action header colliding; overflow-hidden masks the defect. The 320px production view independently confirms overlap between real client email, Healthy badge and expiry.

**Smallest repair:** Use labeled stacked rows at narrow widths, or an intentional accessible scroll table.

**Accept when:** Long identifiers/status/expiry/actions remain readable at 320px and 200% zoom; every row action remains reachable.

**Source:** [page.tsx:326](/Users/jon.high/agency-access/apps/web/src/app/(authenticated)/token-health/page.tsx:326).

**Screenshots:** [320-token-health-bottom.png](./evidence/320-token-health-bottom.png).

#### T02 · P2 · Refresh token health has no accessible name

**Evidence:** SOURCE + LOCAL_PREVIEW + LIVE_AUTHENTICATED.

The page-header refresh button contains only an icon and has no aria-label. Browser DOM inspection confirms an unnamed control.

**Smallest repair:** Name the control and announce loading/result state. Apply S08 sizing.

**Accept when:** Accessibility tree exposes Refresh token health and loading does not erase its name.

**Source:** [page.tsx:208](/Users/jon.high/agency-access/apps/web/src/app/(authenticated)/token-health/page.tsx:208).

**Screenshots:** [1440-token-health.png](./evidence/1440-token-health.png).

#### T03 · P1 · Checkout reports activation without server confirmation

**Evidence:** SOURCE.

Checkout success says the subscription is active without fetching current subscription. Billing toast says upgraded whenever checkout=success is present.

**Smallest repair:** Reuse the billing query and show a verification/pending state until persisted subscription status confirms activation.

**Accept when:** Delayed webhook, failed checkout, stale/bookmarked and edited query URLs never falsely assert upgrade.

**Source:** [page.tsx:12](/Users/jon.high/agency-access/apps/web/src/app/checkout/success/page.tsx:12), [billing-tab.tsx:94](/Users/jon.high/agency-access/apps/web/src/components/settings/billing/billing-tab.tsx:94), [checkout-success-toast.tsx:43](/Users/jon.high/agency-access/apps/web/src/components/settings/billing/checkout-success-toast.tsx:43).

#### T04 · P2 · Billing details save has no result feedback

**Evidence:** SOURCE.

The handler awaits mutateAsync without local error handling or visible success. The mutation only invalidates data. Existing pending/disabled behavior is present and is not counted as missing.

**Smallest repair:** Use existing inline feedback/toast patterns for success and failure; preserve edited values on failure.

**Accept when:** A failed save shows an actionable error; a successful save confirms persistence without losing focus.

**Source:** [billing-details-card.tsx:58](/Users/jon.high/agency-access/apps/web/src/components/settings/billing/billing-details-card.tsx:58), [billing.ts:296](/Users/jon.high/agency-access/apps/web/src/lib/query/billing.ts:296).

#### T05 · P2 · Several load failures have no recovery action

**Evidence:** SOURCE.

Clients, connections, webhooks, token health and unavailable agent approvals render errors without a consistent retry or destination. Partner approval misclassification is tracked separately.

**Smallest repair:** Apply the existing recovery card pattern with error-specific copy and retry/back actions.

**Accept when:** 503→200 recovery works in place on each surface. True missing/unavailable records offer a clear next destination.

**Source:** [page.tsx:128](/Users/jon.high/agency-access/apps/web/src/app/(authenticated)/clients/page.tsx:128), [page.tsx:435](/Users/jon.high/agency-access/apps/web/src/app/(authenticated)/connections/page.tsx:435), [webhook-settings-tab.tsx:317](/Users/jon.high/agency-access/apps/web/src/components/settings/webhooks/webhook-settings-tab.tsx:317), [page.tsx:26](/Users/jon.high/agency-access/apps/web/src/app/(authenticated)/agent-operations/[id]/page.tsx:26).

#### T06 · P2 · Dialog code loading uses a page-card fallback

**Evidence:** SOURCE.

Connections dynamic imports render a page-width min-height placeholder before the real provider overlay. Slow code loading changes the visual shell.

**Smallest repair:** Keep the existing dialog shell while loading its body, or show pending state on the initiating control.

**Accept when:** Throttled code loading does not move the page or present an unrelated card before the overlay.

**Source:** [page.tsx:32](/Users/jon.high/agency-access/apps/web/src/app/(authenticated)/connections/page.tsx:32).

#### T07 · P2 · Diagnostic and checkout pages use legacy visual tokens

**Evidence:** SOURCE + LOCAL_PREVIEW.

Token Health uses slate/indigo. Checkout results use green/amber gradients, large blurred shadows and a 500ms entrance. Client detail boundaries also use legacy slate/shadows. Redirecting settings/platforms uses indigo.

**Smallest repair:** Use existing paper/ink/semantic status tokens, shared loading shells and app motion tokens.

**Accept when:** Loading→loaded→error transitions preserve visual hierarchy and work with reduced motion and dark theme.

**Source:** [page.tsx:203](/Users/jon.high/agency-access/apps/web/src/app/(authenticated)/token-health/page.tsx:203), [page.tsx:17](/Users/jon.high/agency-access/apps/web/src/app/checkout/success/page.tsx:17), [page.tsx:16](/Users/jon.high/agency-access/apps/web/src/app/checkout/cancel/page.tsx:16), [loading.tsx:10](/Users/jon.high/agency-access/apps/web/src/app/(authenticated)/clients/[id]/loading.tsx:10), [page.tsx:27](/Users/jon.high/agency-access/apps/web/src/app/settings/platforms/page.tsx:27).

#### T08 · P2 · Agent approvals expose machine names

**Evidence:** SOURCE.

Approval platform and permission chips print raw values. Current status already replaces underscores, so status itself is not counted as an underscore defect.

**Smallest repair:** Use shared product names and readable permission labels without weakening the precise effect preview.

**Accept when:** Pending/terminal approvals show clear platform, permission, target and effect labels, including long values.

**Source:** [approval-card.tsx:36](/Users/jon.high/agency-access/apps/web/src/components/agent-operations/approval-card.tsx:36).

#### T09 · P3 · Settings labels mix capitalization conventions

**Evidence:** SOURCE.

General, billing and webhooks mix Title Case with sentence-case sections and controls.

**Smallest repair:** Apply one existing sentence-case convention consistently to labels/actions.

**Accept when:** All four tabs use consistent section, field and action casing.

**Source:** [agency-profile-card.tsx:104](/Users/jon.high/agency-access/apps/web/src/components/settings/general/agency-profile-card.tsx:104), [webhook-settings-tab.tsx:404](/Users/jon.high/agency-access/apps/web/src/components/settings/webhooks/webhook-settings-tab.tsx:404), [billing-details-card.tsx:94](/Users/jon.high/agency-access/apps/web/src/components/settings/billing/billing-details-card.tsx:94).

#### T10 · P3 · Dashboard repeats filled Create request actions

**Evidence:** SOURCE + LOCAL_PREVIEW + LIVE_AUTHENTICATED.

Header and recent-request section both expose filled create actions. Checklist variants add further prominence.

**Smallest repair:** Keep one primary visible create action and make the repeated contextual action secondary.

**Accept when:** Populated/checklist/empty views each retain an obvious creation path without competing emphasis.

**Source:** [page.tsx:422](/Users/jon.high/agency-access/apps/web/src/app/(authenticated)/dashboard/page.tsx:422), [page.tsx:515](/Users/jon.high/agency-access/apps/web/src/app/(authenticated)/dashboard/page.tsx:515).

**Screenshots:** [1440-dashboard.png](./evidence/1440-dashboard.png).

#### T11 · P2 · Mobile billing withholds plan details and tier actions

**Evidence:** SOURCE + LIVE_AUTHENTICATED.

Below md, comparison shows only tier name/persona/price and Full plan details available on larger screens. Features and tier actions exist only in the desktop grid. Live 758px billing confirms this restriction.

**Smallest repair:** Provide an existing stacked/expandable comparison at narrow widths, or a clear link to complete accessible plan details.

**Accept when:** Mobile users can compare included capabilities and select the intended tier without changing devices.

**Source:** [plan-comparison.tsx:223](/Users/jon.high/agency-access/apps/web/src/components/settings/billing/plan-comparison.tsx:223), [plan-comparison.tsx:255](/Users/jon.high/agency-access/apps/web/src/components/settings/billing/plan-comparison.tsx:255).

#### T12 · P2 · Connected Google empty states give no useful recovery

**Evidence:** SOURCE + LIVE_AUTHENTICATED.

Live connected Google settings show No accounts available for Business Profile/Merchant Center, followed by Connect your account first. Those product sections have no direct recovery action or explanation of missing access versus missing assets.

**Smallest repair:** Use product-specific empty-state guidance and expose an appropriate existing reload/account-management path. Do not imply the whole Google connection is absent.

**Accept when:** Connected-but-empty, permission failure and disconnected cases show distinct guidance and an actionable next step.

**Source:** [google-unified-settings.tsx:517](/Users/jon.high/agency-access/apps/web/src/components/google-unified-settings.tsx:517).

### Public pages

#### M01 · P2 · Footer section links stay on the wrong page

**Evidence:** SOURCE + LIVE_PUBLIC.

Live pricing footer Features leaves the URL and scroll position unchanged after activation. Handler prevents default and only searches the current DOM. Live home does contain both section IDs; the nav already supports cross-route hashes.

**Smallest repair:** Route footer links to the homepage sections, reusing the nav behavior.

**Accept when:** Features and How it works reach the named home sections from pricing, blog and contact using pointer and keyboard.

**Source:** [marketing-footer.tsx:8](/Users/jon.high/agency-access/apps/web/src/components/marketing/marketing-footer.tsx:8), [marketing-nav.tsx:94](/Users/jon.high/agency-access/apps/web/src/components/marketing/marketing-nav.tsx:94).

#### M02 · P1 · Blog subscription form has no subscription action

**Evidence:** SOURCE + LIVE_PUBLIC.

The newsletter form has no action/onSubmit, input name or integration. It promises weekly tips but cannot create a subscription.

**Smallest repair:** Connect to an existing supported list endpoint, or remove the unsupported form/promise. Give the email field a persistent label.

**Accept when:** Submission creates a real subscription and reports success/failure, or the nonfunctional form is absent.

**Source:** [page.tsx:95](/Users/jon.high/agency-access/apps/web/src/app/(marketing)/blog/page.tsx:95).

#### M03 · P2 · Article Schedule Demo points to #

**Evidence:** SOURCE + LIVE_PUBLIC.

The article CTA is an anchor with href=# and no scheduling handler.

**Smallest repair:** Use the existing scheduling modal or contact destination.

**Accept when:** Mouse and keyboard activation opens a real scheduling path.

**Source:** [page.tsx:343](/Users/jon.high/agency-access/apps/web/src/app/(marketing)/blog/[slug]/page.tsx:343).

#### M04 · P2 · Comparison template uses a second visual system

**Evidence:** SOURCE + LIVE_PUBLIC.

The general comparison template uses teal accents/text, custom colors and blurred resting shadows. This affects all slugs routed through that template; other comparison templates need separate checks.

**Smallest repair:** Update the shared template to existing tokens and border-led surfaces once.

**Accept when:** Representative pages from each template match the documented palette and pass measured contrast.

**Source:** [ComparisonPageTemplate.tsx:441](/Users/jon.high/agency-access/apps/web/src/components/programmatic/ComparisonPageTemplate.tsx:441), [page.tsx:87](/Users/jon.high/agency-access/apps/web/src/app/(marketing)/compare/[slug]/page.tsx:87).

**Screenshots:** [live-1440-compare.png](./evidence/live-1440-compare.png).

#### M05 · P1 · Desktop marquee moves under reduced motion

**Evidence:** SOURCE + LIVE_PUBLIC.

Live home with reducedMotion=reduce still changes both inline and computed transforms across 1.2 seconds. CSS and Framer Motion both animate the track.

**Smallest repair:** Use the existing static grid when reduced motion is requested, and suppress both animation paths.

**Accept when:** Reduced-motion desktop/mobile show static readable content with no transform changes over time.

**Source:** [social-proof-section.tsx:42](/Users/jon.high/agency-access/apps/web/src/components/marketing/social-proof-section.tsx:42), [globals.css:654](/Users/jon.high/agency-access/apps/web/src/app/globals.css:654).

#### M06 · P1 · Public guide routes unexpectedly require authentication

**Evidence:** SOURCE + LIVE_PUBLIC.

Both published guides navigate signed-out visitors to accounts.authhub.co instead of rendering content. The proxy public allowlist omits /guides and protects everything else.

**Smallest repair:** Include the published guide route family in the public routing contract, with a focused regression check.

**Accept when:** Signed-out visits to both canonical guides return their content without the login/security challenge.

**Source:** [proxy.ts:12](/Users/jon.high/agency-access/apps/web/src/proxy.ts:12), [proxy.ts:89](/Users/jon.high/agency-access/apps/web/src/proxy.ts:89), [page.tsx:13](/Users/jon.high/agency-access/apps/web/src/app/(marketing)/guides/google-ads-access/page.tsx:13).

#### M07 · P2 · Article raises a hydration mismatch in production

**Evidence:** LIVE_PUBLIC.

The Google Ads article consistently emits React error #418 at 1440, 390 and 320px. Cause is unconfirmed. Locale-dependent date formatting is one candidate, not a proven diagnosis.

**Smallest repair:** Locate the exact mismatched markup/text and make server/client output deterministic.

**Accept when:** The article renders without hydration errors across locale/timezone and narrow/wide viewports.

**Source:** [blog-content.tsx:205](/Users/jon.high/agency-access/apps/web/src/components/blog/blog-content.tsx:205).

#### M08 · P2 · Pricing reveal causes temporary horizontal overflow under reduced motion

**Evidence:** SOURCE + LIVE_PUBLIC.

Before viewport reveals settle, live pricing measures 324px at 320px and 394px at 390px. The offscreen savings panel starts at x:+20. After scrolling through the page, width returns to 320/390px. This is a reveal-state defect, not settled grid overflow.

**Smallest repair:** Suppress reveal transforms under reduced motion; ensure hidden/offscreen panels cannot widen the document.

**Accept when:** At 320/390px with reduced motion, initial and scrolled states stay inside the viewport without horizontal movement.

**Source:** [savings-calculator.tsx:97](/Users/jon.high/agency-access/apps/web/src/components/marketing/pricing/savings-calculator.tsx:97), [savings-calculator.tsx:195](/Users/jon.high/agency-access/apps/web/src/components/marketing/pricing/savings-calculator.tsx:195).

**Screenshots:** [live-320-pricing.png](./evidence/live-320-pricing.png).

### Partner and admin

#### A01 · P2 · Partner load failures claim approval is pending

**Evidence:** SOURCE.

Any error or absent data produces Access pending approval, including service/network failures.

**Smallest repair:** Distinguish approval state from load failure and provide retry for the latter.

**Accept when:** A network 503 never changes the displayed account approval status.

**Source:** [page.tsx:124](/Users/jon.high/agency-access/apps/web/src/app/(partner)/partners/page.tsx:124).

#### A02 · P2 · Campaign errors lack field and announcement associations

**Evidence:** SOURCE.

The campaign error renders after submit without field association or live announcement. Referral URL also truncates without full visual inspection, although Copy already works.

**Smallest repair:** Associate campaign feedback with its field. Provide full referral URL inspection on keyboard/pointer without removing Copy.

**Accept when:** Invalid campaign feedback is announced; full referral URL is inspectable at narrow widths.

**Source:** [page.tsx:237](/Users/jon.high/agency-access/apps/web/src/app/(partner)/partners/page.tsx:237), [page.tsx:377](/Users/jon.high/agency-access/apps/web/src/app/(partner)/partners/page.tsx:377).

#### A03 · P2 · Admin search inputs rely on placeholders

**Evidence:** SOURCE.

Agencies and webhooks search controls lack associated visible/accessible labels and use 40px height.

**Smallest repair:** Use named search fields and the documented target sizing. Keep existing server filters.

**Accept when:** Admin searches expose names and retain usable focus/targets at narrow widths and zoom.

**Source:** [page.tsx:79](/Users/jon.high/agency-access/apps/web/src/app/(authenticated)/internal/admin/agencies/page.tsx:79), [page.tsx:126](/Users/jon.high/agency-access/apps/web/src/app/(authenticated)/internal/admin/webhooks/page.tsx:126).

## Product questions and unconfirmed risks — excluded from the 68 findings

- ClientHeader hardcodes Active. The intended meaning of client identity status versus connection status is not documented. Define that meaning before proposing a replacement badge.
- Billing mentions team/white-label capabilities, while Settings exposes General/Billing/Webhooks/Agents. Confirm where team/branding controls should live and which entitlements ship. Do not add new settings scope from this audit alone.
- PinterestBusinessSettings has console-only save failure and legacy styles, but its current mount path was not confirmed. Check reachability before counting a customer-visible defect.
- Settings' four-tab rail fits the tested 320/390px light previews. Zoom/localized labels still need testing; a mobile overflow defect is not established.
- The 320px article document measures 346px after reveal. Its tables intentionally scroll. Isolate the element responsible for document-level width before filing a distinct overflow repair.
- Google offboarding includes preview/confirmation/execution/receipt branches. These need role-specific, safe fixture review and live read-back. No incorrect-ID defect was established.
- Native Clerk widgets, dark theme, 200%/400% zoom, browser back/forward and refresh through every wizard step, and full screen-reader flows remain unverified.
- Provider authorization coverage remains open: denied consent, partial scopes, expired/reused state, empty/missing assets, long portfolios, grant failure, retry, verified completion and agency read-back. Local fixture renders do not prove provider behavior.
- Billing coverage remains open: each tier, trial, free, active, past due, cancellation, invoices, payment method, portal return, failed/delayed webhook and quota gates.
- Admin/partner coverage remains open: permission denial, empty/populated ledgers, campaign creation, filters, payout/approval/subscription mutations, webhook delivery details and failures. No real mutation was attempted.

## False positives removed during consolidation

Rounded-lg/md/xl/2xl utilities map to zero in this Tailwind theme. They are not visible corner defects. Explicit arbitrary radii and Clerk CSS are tracked in S09.

The offboarding prop is named agencyId but the API helper interpolates it into a client route. Passing clientId matches that endpoint; no wrong-agency bug was proven.

The text-muted alias resolves to gray-600; no contrast failure was inferred from its name. Lazy images were rechecked after scrolling; settled public captures did not establish broken product images. The protected Token Health signed-out spinner concern was excluded because the shell redirects signed-out users.

Live home has the Features section ID. The primary nav already handles cross-route hashes. M01 concerns the footer only. Initial blank full-page sections were reveal/lazy capture artifacts; settled screenshots replace them. Native runtime strict-motion errors are tracked as development behavior, not claimed production outages.

## Every page route pattern

Dynamic families represent multiple records/slugs. Mapping a route is not proof that all of its branches were exercised. Source review depth and runtime gaps remain visible here.

| Route | Review / render evidence | States / remaining coverage |
| --- | --- | --- |
| `/sign-in/[[...sign-in]]` | Inspected route and relevant shared source. Not rendered | Source only; runtime cases pending. **Remaining:** Actual Clerk sign-in/up/social/validation/recovery and user menu; auth mock does not verify widgets |
| `/sign-up/[[...sign-up]]` | Inspected route and relevant shared source. Not rendered | Source only; runtime cases pending. **Remaining:** Actual Clerk sign-in/up/social/validation/recovery and user menu; auth mock does not verify widgets |
| `/access-requests/[id]/edit` | Inspected route and relevant shared source. LOCAL_PREVIEW at 1440/390/320; mocked auth/API/router | request-edit. **Remaining:** Actual Next runtime and authenticated production; mutations/provider endpoints not exercised |
| `/access-requests/[id]` | Inspected route and relevant shared source. LOCAL_PREVIEW at 1440/390/320; mocked auth/API/router; LIVE_AUTHENTICATED read-only inspection | request-detail. **Remaining:** Full native keyboard/screen reader/zoom/dark coverage; all mutation, failure/retry, permission and role-specific cases not exercised |
| `/access-requests/[id]/success` | Inspected route and relevant shared source. LOCAL_PREVIEW at 1440/390/320; mocked auth/API/router | request-success. **Remaining:** Actual Next runtime and authenticated production; mutations/provider endpoints not exercised |
| `/access-requests/new` | Inspected route and relevant shared source. LOCAL_PREVIEW at 1440/390/320; mocked auth/API/router; LIVE_AUTHENTICATED read-only inspection | request-create; all four live draft steps; no submission. **Remaining:** Full native keyboard/screen reader/zoom/dark coverage; all mutation, failure/retry, permission and role-specific cases not exercised |
| `/agent-operations/[id]` | Inspected route and relevant shared source. Not rendered | Source only; runtime cases pending. **Remaining:** Authenticated production, keyboard, screen reader, zoom and dark theme where relevant |
| `/clients/[id]` | Inspected route and relevant shared source. LOCAL_PREVIEW at 1440/390/320; mocked auth/API/router; LIVE_AUTHENTICATED read-only inspection | client-detail-actual, client-detail-preview. **Remaining:** Full native keyboard/screen reader/zoom/dark coverage; all mutation, failure/retry, permission and role-specific cases not exercised |
| `/clients` | Inspected route and relevant shared source. LOCAL_PREVIEW at 1440/390/320; mocked auth/API/router; LIVE_AUTHENTICATED read-only inspection | clients, clients-empty, clients-error. **Remaining:** Full native keyboard/screen reader/zoom/dark coverage; all mutation, failure/retry, permission and role-specific cases not exercised |
| `/connections` | Inspected route and relevant shared source. LOCAL_PREVIEW at 1440/390/320; mocked auth/API/router; LIVE_AUTHENTICATED read-only inspection | connections, connections-empty; live Google/Meta asset dialogs, Escape, keyboard focus, 320px Meta dialog. **Remaining:** Full native keyboard/screen reader/zoom/dark coverage; all mutation, failure/retry, permission and role-specific cases not exercised |
| `/dashboard` | Inspected route and relevant shared source. LOCAL_PREVIEW at 1440/390/320; mocked auth/API/router; LIVE_AUTHENTICATED read-only inspection | dashboard, dashboard-empty, dashboard-error. **Remaining:** Full native keyboard/screen reader/zoom/dark coverage; all mutation, failure/retry, permission and role-specific cases not exercised |
| `/internal/admin/affiliates` | Route/navigation and selected control/error source inspected; full data branches pending. Not rendered | Source only; runtime cases pending. **Remaining:** Authorized admin account: populated/empty/denied/error, filters, subscription changes, webhook details, affiliate approval/payout paths |
| `/internal/admin/agencies` | Route/navigation and selected control/error source inspected; full data branches pending. Not rendered | Source only; runtime cases pending. **Remaining:** Authorized admin account: populated/empty/denied/error, filters, subscription changes, webhook details, affiliate approval/payout paths |
| `/internal/admin` | Route/navigation and selected control/error source inspected; full data branches pending. Not rendered | Source only; runtime cases pending. **Remaining:** Authorized admin account: populated/empty/denied/error, filters, subscription changes, webhook details, affiliate approval/payout paths |
| `/internal/admin/subscriptions` | Route/navigation and selected control/error source inspected; full data branches pending. Not rendered | Source only; runtime cases pending. **Remaining:** Authorized admin account: populated/empty/denied/error, filters, subscription changes, webhook details, affiliate approval/payout paths |
| `/internal/admin/webhooks` | Route/navigation and selected control/error source inspected; full data branches pending. Not rendered | Source only; runtime cases pending. **Remaining:** Authorized admin account: populated/empty/denied/error, filters, subscription changes, webhook details, affiliate approval/payout paths |
| `/settings` | Inspected route and relevant shared source. LOCAL_PREVIEW at 1440/390/320; mocked auth/API/router; LIVE_AUTHENTICATED read-only inspection | settings-general, settings-billing, settings-webhooks, settings-agents; General/Billing/Webhooks/Agents live; narrow billing. **Remaining:** Full native keyboard/screen reader/zoom/dark coverage; all mutation, failure/retry, permission and role-specific cases not exercised |
| `/token-health` | Inspected route and relevant shared source. LOCAL_PREVIEW at 1440/390/320; mocked auth/API/router; LIVE_AUTHENTICATED read-only inspection | token-health, token-health-empty. **Remaining:** Full native keyboard/screen reader/zoom/dark coverage; all mutation, failure/retry, permission and role-specific cases not exercised |
| `/about` | Inspected route and relevant shared source. LIVE_PUBLIC at 1440/390/320 | about. **Remaining:** All generated slugs, full keyboard/zoom, normal-motion variants |
| `/affiliate` | Inspected route and relevant shared source. LIVE_PUBLIC at 1440/390/320 | affiliate. **Remaining:** All generated slugs, full keyboard/zoom, normal-motion variants |
| `/blog/[slug]` | Inspected route and relevant shared source. LIVE_PUBLIC at 1440/390/320 | article. **Remaining:** All generated slugs, full keyboard/zoom, normal-motion variants |
| `/blog` | Inspected route and relevant shared source. LIVE_PUBLIC at 1440/390/320 | blog. **Remaining:** All generated slugs, full keyboard/zoom, normal-motion variants |
| `/compare/[slug]` | Inspected route and relevant shared source. LIVE_PUBLIC at 1440/390/320 | compare / compare-three-way. **Remaining:** All generated slugs, full keyboard/zoom, normal-motion variants |
| `/contact` | Inspected route and relevant shared source. LIVE_PUBLIC at 1440/390/320 | contact. **Remaining:** All generated slugs, full keyboard/zoom, normal-motion variants |
| `/guides/google-ads-access` | Inspected route and relevant shared source. LIVE_PUBLIC attempt redirected to authentication | Signed-out canonical visit. **Remaining:** Guide content, links and layout after public-route repair |
| `/guides/meta-ads-access` | Inspected route and relevant shared source. LIVE_PUBLIC attempt redirected to authentication | Signed-out canonical visit. **Remaining:** Guide content, links and layout after public-route repair |
| `/hero-copy-rewrite` | Engineering route and production guard inventory. Not rendered; production proxy returns 404 | Internal/dev utility. **Remaining:** Engineering utility only; do not prioritize as customer screen. Keep redirect/guard behavior verified. |
| `/` | Inspected route and relevant shared source. LIVE_PUBLIC at 1440/390/320 | home. **Remaining:** All generated slugs, full keyboard/zoom, normal-motion variants |
| `/pricing` | Inspected route and relevant shared source. LIVE_PUBLIC at 1440/390/320 | pricing. **Remaining:** All generated slugs, full keyboard/zoom, normal-motion variants |
| `/privacy-policy` | Inspected route and relevant shared source. LIVE_PUBLIC at 1440/390/320 | privacy. **Remaining:** All generated slugs, full keyboard/zoom, normal-motion variants |
| `/terms` | Inspected route and relevant shared source. LIVE_PUBLIC at 1440/390/320 | terms. **Remaining:** All generated slugs, full keyboard/zoom, normal-motion variants |
| `/partners` | Inspected route and relevant shared source. Not rendered | Source only; runtime cases pending. **Remaining:** Partner account: approval/loading, real ledgers, campaign creation, promo kit/copy and payout states |
| `/authorize/[token]` | Inspected route and relevant shared source. Source redirect reviewed | Redirect to /invite/[token]. **Remaining:** Live redirect preserves token/tier and destination |
| `/checkout/cancel` | Inspected route and relevant shared source. LOCAL_PREVIEW at 1440/390/320; mocked auth/API/router | checkout-cancel. **Remaining:** Actual Next runtime and authenticated production; mutations/provider endpoints not exercised |
| `/checkout/success` | Inspected route and relevant shared source. LOCAL_PREVIEW at 1440/390/320; mocked auth/API/router | checkout-success. **Remaining:** Actual Next runtime and authenticated production; mutations/provider endpoints not exercised |
| `/client/[token]` | Inspected route and relevant shared source. Source redirect reviewed | Redirect to /invite/[token]. **Remaining:** Live redirect preserves token/tier and destination |
| `/design-system` | Engineering route and production guard inventory. Not rendered; production proxy returns 404 | Internal/dev utility. **Remaining:** Engineering utility only; do not prioritize as customer screen. Keep redirect/guard behavior verified. |
| `/dev/client-detail` | Engineering route and production guard inventory. LOCAL_PREVIEW at 1440/390/320; mocked auth/API/router | client-detail-preview. **Remaining:** Engineering utility only; do not prioritize as customer screen. Keep redirect/guard behavior verified. |
| `/dev/offboarding-preview` | Engineering route and production guard inventory. LOCAL_PREVIEW at 1440/390/320; mocked auth/API/router | offboarding-preview. **Remaining:** Engineering utility only; do not prioritize as customer screen. Keep redirect/guard behavior verified. |
| `/dev` | Engineering route and production guard inventory. Not rendered; production proxy returns 404 | Internal/dev utility. **Remaining:** Engineering utility only; do not prioritize as customer screen. Keep redirect/guard behavior verified. |
| `/dev/redesign-prototype` | Engineering route and production guard inventory. Not rendered; production proxy returns 404 | Internal/dev utility. **Remaining:** Engineering utility only; do not prioritize as customer screen. Keep redirect/guard behavior verified. |
| `/invite/[token]/beehiiv/manual` | Inspected route and relevant shared source. LOCAL_PREVIEW at 1440/390/320; mocked auth/API/router | manual-beehiiv. **Remaining:** Actual Next runtime and authenticated production; mutations/provider endpoints not exercised |
| `/invite/[token]/kit/manual` | Inspected route and relevant shared source. LOCAL_PREVIEW at 1440/390/320; mocked auth/API/router | manual-kit. **Remaining:** Actual Next runtime and authenticated production; mutations/provider endpoints not exercised |
| `/invite/[token]/klaviyo/manual` | Inspected route and relevant shared source. LOCAL_PREVIEW at 1440/390/320; mocked auth/API/router | manual-klaviyo. **Remaining:** Actual Next runtime and authenticated production; mutations/provider endpoints not exercised |
| `/invite/[token]/mailchimp/manual` | Inspected route and relevant shared source. LOCAL_PREVIEW at 1440/390/320; mocked auth/API/router | manual-mailchimp. **Remaining:** Actual Next runtime and authenticated production; mutations/provider endpoints not exercised |
| `/invite/[token]` | Inspected route and relevant shared source. LOCAL_PREVIEW at 1440/390/320; mocked auth/API/router | invite, invite-expired. **Remaining:** Actual Next runtime and authenticated production; mutations/provider endpoints not exercised |
| `/invite/[token]/pinterest/manual` | Inspected route and relevant shared source. LOCAL_PREVIEW at 1440/390/320; mocked auth/API/router | manual-pinterest. **Remaining:** Actual Next runtime and authenticated production; mutations/provider endpoints not exercised |
| `/invite/[token]/shopify/manual` | Inspected route and relevant shared source. LOCAL_PREVIEW at 1440/390/320; mocked auth/API/router | manual-shopify. **Remaining:** Actual Next runtime and authenticated production; mutations/provider endpoints not exercised |
| `/invite/oauth-callback` | Inspected route and relevant shared source. LOCAL_PREVIEW at 1440/390/320; mocked auth/API/router | invite-callback-error. **Remaining:** Actual Next runtime and authenticated production; mutations/provider endpoints not exercised |
| `/onboarding/agency` | Inspected route and relevant shared source. Source redirect reviewed | Redirect to /onboarding/unified (tier preserved). **Remaining:** Live redirect preserves token/tier and destination |
| `/onboarding/platforms` | Inspected route and relevant shared source. Not rendered | Source only; runtime cases pending. **Remaining:** Legacy connector route: Google account hierarchy, Meta portfolio selection, all manual settings and errors; reachability/product retirement decision |
| `/onboarding/unified` | Inspected route and relevant shared source. Local render blocked by strict LazyMotion; user final-screen screenshot available; LIVE_AUTHENTICATED cold navigation reached welcome | All seven screens reviewed in source; resume/final completion not walked. **Remaining:** Render all seven stages in native app; final request trace, validation, refresh/resume and keyboard |
| `/perf/dashboard-bootstrap` | Engineering route and production guard inventory. Not rendered; production proxy returns 404 | Internal/dev utility. **Remaining:** Engineering utility only; do not prioritize as customer screen. Keep redirect/guard behavior verified. |
| `/platforms/callback` | Inspected route and relevant shared source. LOCAL_PREVIEW at 1440/390/320; mocked auth/API/router | platform-callback-error. **Remaining:** Actual Next runtime and authenticated production; mutations/provider endpoints not exercised |
| `/settings/platforms` | Inspected route and relevant shared source. Source redirect reviewed | Redirect to /connections. **Remaining:** Live redirect preserves token/tier and destination |
| `/test/access-request` | Engineering route and production guard inventory. Not rendered; production proxy returns 404 | Internal/dev utility. **Remaining:** Engineering utility only; do not prioritize as customer screen. Keep redirect/guard behavior verified. |
| `/test/asset-creation` | Engineering route and production guard inventory. Not rendered; production proxy returns 404 | Internal/dev utility. **Remaining:** Engineering utility only; do not prioritize as customer screen. Keep redirect/guard behavior verified. |

## Evidence receipts

[Base local captures and measurements](./evidence/captures.json) · [Live public captures and console receipts](./evidence/public-captures.json) · [Footer, motion, DOM and target probes](./evidence/interaction-probes.json) · [Scroll and keyboard probes](./evidence/scroll-and-keyboard-probes.json) · [Authenticated inspection receipts](./evidence/authenticated-probes.json)

Source locations were checked for existence and valid line numbers. Screenshot references were checked after capture completion. The report's JSON and HTML are generated from the same canonical findings. No application test suite was run because this task changed only audit artifacts. The native development startup limitation is reported above.

The authenticated production pass covered the listed live views. Role-specific pages, mutation/recovery states and full provider journeys remain open. This report does not certify the entire app as polished, visually complete, or exhaustively production verified.
