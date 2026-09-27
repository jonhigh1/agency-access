# PostHog Self-driving setup report

## Summary

PostHog Self-driving is configured for the Agency Access Platform / AuthHub project. Session Replay, Error Tracking, and Support were enabled, and the health, error, support, and selected Sentry responders are ready.

Fresh scout configurations and Replay Vision monitors begin being picked up within about 30 minutes. Findings will appear in the [Self-driving inbox](https://us.posthog.com/project/309879/inbox).

## AI data processing

Approved. The organization-level AI data processing approval was confirmed by the setup flow before configuration began.

## GitHub

GitHub was already connected through the PostHog GitHub App before this setup. No GitHub Issues responder was enabled because it was not selected in the connected-tools step.

## Products enabled

| Product | Result | Notes |
| --- | --- | --- |
| Session Replay | enabled | Browser initialization was checked and does not disable session recording. No recordings were found yet. |
| Error Tracking | enabled | Browser initialization was checked and does not disable exception capture. No existing error-tracking issues were found. |
| Support | enabled | The ticket responder is enabled. Tickets will arrive only after an inbound email, inbox, or Slack channel is connected in PostHog. |

## Signal sources

| `source_product` | `source_type` | Action |
| --- | --- | --- |
| `signals_scout` | `cross_source_issue` | Left at the platform default: scout findings are enabled without a config row. |
| `health_checks` | `health_issue` | Enabled, config `01a06835-8419-7470-95d7-1f17c0d74520`. |
| `error_tracking` | `issue_created` | Enabled, config `01a06835-8486-7773-9388-0f6947b69ba2`. |
| `error_tracking` | `issue_reopened` | Enabled, config `01a06835-8434-7333-8687-a1a0f1bc042a`. |
| `error_tracking` | `issue_spiking` | Enabled, config `01a06835-84e3-73fa-862b-bda77bbbd67a`. |
| `conversations` | `ticket` | Enabled, config `01a06835-847c-7559-83b1-863c5c90cb15`. |
| `sentry` | `issue` | Enabled, config `01a06838-2d97-7fe6-a2a7-6054e96d657e`; dormant until a Sentry warehouse source starts syncing. |
| `session_replay` | `session_analysis_cluster` | Deliberately skipped. Replay is covered by the Replay Vision scanners below. |
| `replay_vision` | n/a | No source row is needed. Each scanner is self-authorizing through `emits_signals: true`. |

## Connected tools

| Tool | Selection and connection state |
| --- | --- |
| Sentry | Selected, but no source was connected because the secure browser connection step was skipped. Its responder is enabled and remains dormant until a Sentry source is added and syncing. |
| GitHub Issues, Linear, Jira, Zendesk, and other catalog tools | Not selected. No responder was enabled. |

## Scout troop

The project has **3 enabled scouts** on the default daily schedule:

| Scout | Why it is enabled |
| --- | --- |
| `signals-scout-general` | Watches cross-product correlations and surfaces not owned by a specialist. |
| `signals-scout-product-analytics` | Covers the instrumented agency onboarding, access-request, client authorization, and platform-connection journeys. |
| `signals-scout-health-checks` | Prioritizes actionable PostHog setup health issues. |

**24 built-in scouts are disabled.** The two overlapping routes are deliberately disabled: `signals-scout-error-tracking` is covered by the native Error Tracking responder, and `signals-scout-session-replay` is covered by Replay Vision. The remaining disabled scouts cover surfaces without current evidence of use: AI observability, anomaly detection, APM, conversations analysis, CSP violations, customer analytics, data pipelines, data warehouse, experiments, feature flags, inbox validation, insight alerts, logs, MCP tool calls, Replay Vision aggregate analysis, revenue analytics, skills store, surveys, tasks, web analytics, and web vitals. They can be enabled later from the inbox if those products become active.

| Run-budget field | Value |
| --- | --- |
| Maximum runs per day | 100 |
| Runs used today | 0 |
| Runs remaining today | 100 |
| Maximum runs per tick | 3 |

> Scouts are in early access. Each project gets up to 100 scout runs a day. Contact team-self-driving@posthog.com if you need more.

## Custom scouts

No custom scouts were created. Two candidates were proposed from the repository's client-invite and OAuth flow instrumentation, but the explicit `None — keep the built-in troop` selection means neither was created:

- **Client authorization journey:** would have watched invite loading, timeouts, and progression through authorization, including entry-volume and reliability changes that a conversion-rate monitor can miss.
- **Platform connection reliability:** would have watched provider-specific rises in authorization failures or falls in successful platform connections.

The generic product-analytics scout remains responsible for core journey-rate coverage. Error and replay surfaces are routed through their dedicated responders and monitors. If a future custom scout becomes noisy, setting `emit: false` on its scout config switches it to dry-run.

## Replay Vision scanners

A scanner is an LLM that watches individual session recordings on a schedule and pushes what it finds to the Self-driving inbox. These are the only components in this setup that spend Replay Vision quota. Scanner findings arrive at half weight and require corroboration before promotion to an inbox report.

| Brief | Scanner | Status | Query scope | Sampling | Estimated monthly usage |
| --- | --- | --- | --- | --- | --- |
| Breakage monitor | `Broken client authorization` | created | Recordings whose URL contains `/invite/`, covering the client-facing authorization completion flow and its immediate steps. | 0.5 | 0 observations, 0 credits |
| Frustration monitor | `Client authorization frustration` | created | Recordings containing `$rageclick`, with no URL filter. | 1.0 | 0 observations, 0 credits |

No session recordings existed at setup time, so both scanners are armed and will start scanning when recordings arrive. Replay Vision currently has 2,500 credits remaining in the active period and no projected scanner spend.

## Follow-ups

- [ ] Connect an inbound Support channel, such as email, inbox, or Slack, so the enabled Support responder can receive tickets.
- [ ] Connect Sentry through the secure PostHog page to activate the selected responder: https://us.posthog.com/project/309879/data-warehouse/connect?kind=Sentry
- [ ] Generate browser traffic and client-invite sessions. Session Replay and both Replay Vision monitors are enabled but currently have no recordings to analyze.
- [ ] If creating event-specific custom scouts later, reauthorize the PostHog MCP connection with `property_definition:read` so the event schema can be validated before authoring.

## What happens next

The scout coordinator picks up fresh configurations within about 30 minutes. Scout runs draw from the daily budget, then Self-driving clusters corroborated findings into reports in the inbox. Immediately actionable reports can begin coding tasks.

## Files modified or created

- Created `posthog-self-driving-report.md`.
- Installed local guidance under `.claude/skills/replay-vision-scanners-core/`, `.claude/skills/replay-vision-scanner-broken-experiences/`, and `.claude/skills/replay-vision-scanner-user-frustration/`.
- No application source files were modified.
