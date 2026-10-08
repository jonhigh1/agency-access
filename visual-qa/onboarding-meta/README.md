# Visual QA: connect the agency Meta Business Portfolio inside onboarding

Rendered locally on a throwaway Vite harness that mounts the real onboarding screens inside `UnifiedWizard` (Clerk and Next shims, no API). Platform logos fall back to letters because favicons aren't fetched in the harness, and fonts fall back too. All data is fake.

| Shot | What it shows |
|---|---|
| 01 / 06 | Step 4 with Meta selected and no agency Meta connection (desktop / mobile): inline panel with "Connect Meta Business Portfolio", summary says how to unblock, Continue disabled |
| 02 | Meta connected but no portfolio selected yet: "Choose Business Portfolio" (same OAuth + portfolio picker) |
| 03 | Back from OAuth: "Meta connected. Example Agency Portfolio", Continue enabled |
| 04 | Status check failed: "Check again" / "Connect Meta". Continue stays enabled; the API remains the authority |
| 05 | Google-only (default): no panel, callout copy no longer implies Meta is pre-selected |
| 07 | Step 3 with an existing client selected: no "No client yet" under it, labelled search, corrected "Next" copy |
| 08 | Step 3 new-client form: visible labels are now tied to their inputs |

Not shown: `/platforms/callback` (unchanged portfolio picker) now sends the agency back to `/onboarding/unified?meta=connected` after saving, or offers "Back to onboarding" on failure, when the connection was started from onboarding.
