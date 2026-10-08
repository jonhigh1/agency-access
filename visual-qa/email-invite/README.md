# Visual QA: AuthHub-sent client invite email

Rendered locally on the evidence Vite harness (Clerk shim, API stubbed in the browser). Fonts fall back because Next font loading isn't part of the harness. All data is fake.

| Shot | What it shows |
|---|---|
| 01 / 04 | Onboarding Share link step (desktop / mobile): Copy Link kept, client email prefilled, "Send invite" |
| 02 | Onboarding after a successful send: "Sent" plus an inline confirmation |
| 03 | Onboarding when delivery fails: inline error, button re-enabled |
| 05 / 07 | Request detail page (desktop / mobile): form under the existing link actions |
| 06 | Request detail after a successful send |
| 08 | The email itself: From, Reply-To, Subject, HTML body with one CTA, and the text/plain part |

The request success page (`/access-requests/[id]/success`) uses the same `SendInviteEmailForm` under Copy Link / Email Client. It isn't screenshotted here.
