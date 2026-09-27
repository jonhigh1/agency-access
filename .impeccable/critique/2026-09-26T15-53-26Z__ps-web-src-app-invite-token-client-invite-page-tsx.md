---
target: Meta authorization step of the client invite screen
total_score: 15
max_score: 40
na_heuristics:
p0_count: 0
p1_count: 3
timestamp: 2026-09-26T15-53-26Z
slug: ps-web-src-app-invite-token-client-invite-page-tsx
---
# UX Critique — Client Invite, Meta Authorization Screen (authhub.co/invite)

Method: dual-agent. Assessment A: isolated design review (screenshot + live page at 1440/390 + source). Assessment B: deterministic detector scan + read-only browser evidence. Overlay skipped (production page).

Scope: client invite flow, Meta authorization step. Not evaluated: agency dashboard, Meta's OAuth screens, dark mode.

## UX Health Score

38/100 — Poor. Heuristics 15/40; cognitive load 7/8 checks fail; walkthrough 2 failures + 4 hesitations at the trust-critical middle; no manipulative anti-patterns.

## Anti-Pattern Verdict: Minor Issues

No fake urgency, no guilt trips, no hidden costs. Honesty problems: (1) fake progress — bar reads 33% on arrival, 67% before anything connects; code measures phase index, not work; user screenshot shows 0% on final platform; (2) jargon walls — "Business Portfolio", "Admin Access", "Load accounts", raw 16-digit IDs; (3) trust gap — agency name renders raw signup casing ("Jon high") on the verification line.

## Design Specificity Verdict

Category-interchangeable, with three authored exceptions (exit note "You will leave for Meta and come right back here.", StepHelpText connect preview, Verify-before-you-approve rail — which never renders on Meta-only requests). Internal-tool data model rendered outward.

Deterministic scan: 0 findings in scope (verified genuine; full-tree run = 19 findings, none in invite/client-auth). Detector blind spot: does not cover nested shadow stacks, raw coral/teal text AA failures, rounded-2xl violations found in review.

## Heuristic Scores (15/40 — Poor)

1. Visibility of System Status: 1 — four disagreeing signals; two numbering systems on one screen.
2. Match System/Real World: 1 — Meta-admin jargon; "Choose the client Business Portfolio" addressed to the client.
3. User Control and Freedom: 2 — "Switch business" silently wipes all selections.
4. Consistency and Standards: 1 — two step systems, two CTA grammars, casing fork, rounded-2xl, emoji tiles.
5. Error Prevention: 1 — silent selection destruction; no "which one is mine" help on a one-tap irreversible-feeling choice.
6. Recognition over Recall: 2 — client must recall 16-digit ID ownership; 5 sub-steps held across app switch.
7. Flexibility and Efficiency: 2 — no search in 8+ option dropdown; invisible resume capability.
8. Aesthetic and Minimalist Design: 1 — 4+ nested bordered boxes; shadow budget broken; 3 heading+subtitle pairs before any control.
9. Error Recovery: 2 — human copy but raw coral text (~2.9:1), no role=alert, collapsible-away banners.
10. Help and Documentation: 2 — StepHelpText right pattern, collapsed by default; manual grant is dense text at the anxiety peak.

Cognitive load: single focus ✗, grouping ✗, hierarchy ✗, one-decision ✗, ≤4 options ✗, working memory ✗, progressive disclosure inverted ✗, chunking barely passes.

## Walkthrough — "Authorize Meta Ads and finish"

Pass: Continue to connect; select ad accounts/pages; finish. Hesitation: landing (33% before action), Connect Meta (67% while nothing connects; pop-up fork), leave-for-OAuth (no waiting state), return (step noise), Load accounts (verb misreads). Failure: pick Business Portfolio (no way to identify theirs), find Share Access (hidden until unspoken rule met), manual grant (text-only at fear peak).

## Strengths — Protect

1. Exit note: "You will leave for Meta and come right back here."
2. Status never color-only: icon + word + ink chips; "3 of 5 selected" counts.
3. State machine: server-side progress, sessionStorage resume, OAuth return-to-context. Calm control is real in architecture.

## Priority Issues

- P1-1 Primary CTA renders only after hidden validity check (PlatformAuthWizard.tsx ~1032–1045). Fix: always render, disabled with live reason, pinned outside collapsible. Route: /journey + /fortify · impeccable shape.
- P1-2 Portfolio choice by raw ID (MetaAssetSelector.tsx:714-717 label = name (id)). Fix: name-only rows, ID demoted, plain prompt, "Use this portfolio", preselect single-match portfolio. Route: /articulate + /journey · impeccable clarify.
- P1-3 Contradictory progress system (invite-flow-shell.tsx:29 step/total*100; NOW·STEP 1 OF 1; IN PROGRESS). Fix: one truthful model — named platforms with per-platform status; delete percentage, premature ✓, and step-of-1. Route: /fortify · impeccable distill.
- P2-1 Silent reset on Switch business (handleSwitchBusiness). Fix: confirm with count, or per-business selection retention. Route: /fortify.
- P2-2 Text-only manual grant at anxiety peak (AdAccountSharingInstructions: 2 steps + 5 sub-steps; "Admin Access" never explained). Fix: stateful checklist, one-tap copy, Partners deep link, revocation reassurance. Route: /journey + /include · impeccable harden.
- P3-1 Design-system conformance debt: nested shadows, raw coral/teal text, rounded-2xl, emoji tiles, casing fork. Route: impeccable polish.

## Persona Red Flags

- Jordan (non-technical first-timer): "Admin" unexplained; "Load accounts" misreads; hidden button rule. Stalls at portfolio step.
- Casey (mobile): trust note wraps into duplicate fragments; dropdown truncation keeps the useless ID half; sticky CTA trapped by overflow-hidden parent.
- Sam (a11y): combobox lacks arrow/Escape/typeahead; options portal to body end; collapsibles lack aria-expanded; errors lack role=alert.
- Dana (fears breaking ads): silent selection wipe reads as self-inflicted breakage; failure ending ("Access needs follow-up" + jargon) is the last memory.

## Minor Observations

"Passwords are never requested" ×3 on Setup; agency name casing on trust line; /ingest/* 404s on production (funnel telemetry dropped); Verify-before-you-approve rail missing on Meta requests; two split-brain portfolio selectors; Clerk afterSignUpUrl deprecation.

## Questions to Consider

1. Why is the client choosing a portfolio at all? Preselect when OAuth reveals a single owner; ask "which brand is this?" instead.
2. Confirmation not workshop: one line per account — "Share X with Y? Yes / No".
3. What if agency brand had to earn the click: logo, verified request, why-Admin, revocation promise.
