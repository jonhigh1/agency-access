# AuthHub performance and codebase improvement plan

Date: October 1, 2026. Scope: current AuthHub web/API/shared/CLI code, engineering checks, and performance tooling.

## Outcome and decision

Improve the work required to complete real agency and client journeys, then reduce the cost of safely changing those journeys. “10X” is an ambition, not an established app-wide latency target. A tenfold improvement is credible for specific redundant-work workloads; an app-wide speedup requires representative measurements.

Execute small, independent local improvements now. Keep database/schema changes, production configuration, deployment, and git publication behind their existing approval gates. Preserve the dirty Meta onboarding and API configuration changes present at session start.

The evidence map and validation record live in [the audit](../audits/2026-10-01-authhub-performance/report.md).

## Wave 1 — remove proven waste and repair verification

Implemented locally during this investigation:

1. Coalesce concurrent reads of the same cache key. Exact/prefix invalidation detaches pending work and prevents an obsolete result from repopulating cache. Maintain tenant separation, failure propagation, and browser `private, no-store` behavior.
2. Load closed Create Client, Upgrade, and Save Template dialogs on demand. Keep loading feedback accessible and preserve exit animations.
3. Remove the duplicate marketing animation lifecycle gate. The root gate remains the single owner.
4. Route scanned token-refresh jobs through the existing retry/singleton helper. Retry structured transient provider failures, record one audit event, and keep terminal reconnect outcomes terminal.
5. Ensure the retention-cleanup queue exists before worker registration and scheduling.
6. Delegate the pre-push wrapper directly to its existing gate. Preserve Git reference input, one Entire invocation, and failure status.
7. Make performance scripts reject HTTP/application failures and malformed data. Validate sample counts/budgets, bound fetch time, create output directories, and redact session tokens from reports/traces/errors.
8. Repair the missing Sentry instrumentation peer declaration without upgrading libraries; align repository/CI to Node 22 because pg-boss requires ≥22.12.0. Preserve existing lock changes.
9. Add a deterministic root `test:run` command covering API, web, shared, CLI, hook, and measurement tests, and a general PR quality workflow covering typechecks, tests, lint, application/CLI builds without production credentials.

Acceptance: failing-first regressions for behavior changes; appropriate focused suites; all workspace typechecks; lint; API/web builds; review only owned diffs. Record baseline failures separately. A missing installed dependency or failed unrelated test blocks a broad green claim, not disclosure of verified narrow changes.

Measured cache acceptance: 20 concurrent cold same-key requests should invoke the source exactly once. This checks work reduction, not network latency.

## Wave 2 — establish trustworthy journey baselines

Measure before choosing additional optimizations. Use a dedicated local/non-production database and test identities; do not benchmark production credentials or customer data implicitly.

| Journey | Representative cases | Record |
| --- | --- | --- |
| Dashboard | Cold, warm, after revoke/grant, 1/20 concurrent reads | Agency resolution, cache wait, data-fetch time, response bytes, source calls, p50/p95, error rate |
| Clients | 0/50/500/5,000 clients; empty and selective/nonselective search; each page | SQL count/time, returned rows/bytes, total-count cost, p95 |
| Client detail | 0/10/100/1,000 historical requests and connections | SQL/result bytes, response bytes, rendering/interaction time |
| New/edit request | First load, client selection, platform selection, save, template reopen | Initial JS, long tasks, API sequence, ready time, errors |
| Invite | Fresh, resumed, expired/revoked, provider error, asset-heavy | Initial JS, ready time, input response, exact completion truth |
| Marketing | Home, guide, article; mobile and desktop | Initial JS/third-party cost, LCP, INP, CLS |
| Background jobs | Empty and large eligible batches; transient provider failure | Scan rows/time, queue inserts, concurrency, retries, age of oldest job |

Use at least 30 controlled repetitions for exploratory route timing; retain raw samples and configuration. Treat that sample size as preliminary, not production statistical certainty. Compare the same data, runtime, concurrency, and cache state. Report median/p95 and errors together; a fast failure is never a speed improvement.

Retain current dashboard configured budgets (warm p95 400 ms, first critical request 2,500 ms) until product evidence supports a change. Separate the API script's serial agencies+dashboard measurement from the UI's consolidated dashboard path. Existing “INP smoke” tests verify behavior, not Interaction to Next Paint.

Record field Core Web Vitals by route and mobile/desktop at the 75th percentile. Suggested external thresholds: LCP ≤2.5 s, INP ≤200 ms, CLS ≤0.1. Measure real-user interactions through existing analytics where supported before adding dependencies.

## Wave 3 — optimize measured data costs

Order by measured p95 contribution, SQL/payload cost, and risk:

- Client search/list: run `EXPLAIN (ANALYZE, BUFFERS)` on representative non-production reads. Verify case-insensitive substring selectivity and tenant scoping. Evaluate matching search/composite indexes only after seeing plans; do not prescribe a trigram migration blindly. Remove nested data only if no current caller needs it. Keep totals/pagination accurate.
- Client detail: measure unbounded historical relations. Separate aggregate stats from bounded visible history if the route is demonstrably costly. Decide pagination explicitly with product review; never truncate silently.
- Dashboard: verify cold source coalescing and invalidation under real concurrent route requests. Identify instance count before choosing cross-instance invalidation. Process-local cache is an explicit limitation; do not add Redis or a second cache merely because historical notes name it.
- Jobs: measure scan size and queue saturation. Bound scan/enqueue work using existing PostgreSQL capabilities only when volume warrants it. Keep refresh eligibility, singleton keys, retry behavior, audit, and terminal states intact.

Acceptance: measured improvement with no error-rate increase; tenant/auth tests; fresh reads after mutation; retained response contracts; reviewed database plan for any migration. Rollback by reversing the specific code change or approved migration, not disabling protections.

## Wave 4 — reduce browser startup cost

Use a fresh production build and browser network/CPU traces to identify shared versus route-specific costs. Audit root Clerk/provider work, immediate auth-button hydration imports, below-fold marketing motion, and the agency-then-onboarding sequence on non-dashboard routes.

- Extend the existing dynamic import pattern only to modules absent from the initial visible view.
- Move providers deeper only if public/signup flows retain their current behavior.
- Consolidate agency/onboarding reads only after establishing that the sequence materially delays the journey. The current layout does not block rendering, so a waterfall alone does not establish LCP delay.
- Keep server-fetched invite context and existing shared agency/query helpers. Avoid new overlapping fetch/cache abstractions.

Acceptance: fewer initial transferred/parsed bytes or long tasks in matched runs; no missing content, delayed primary CTA, focus regression, modal failure, or onboarding redirect error. Target a meaningful measured reduction, then set an enforced byte/time budget from that baseline.

## Wave 5 — reduce the cost of safe change

Large files are maintenance signals, not proven runtime bottlenecks. Split along current responsibilities while implementing related work: client-auth asset validation/discovery/grant handling; request lifecycle versus projections; shared domain contracts; client wizard state versus platform-specific steps.

Each extraction keeps one behavior behind one clear interface. Reuse current helpers; remove obsolete aliases and duplicate paths only after caller searches. No wholesale framework rewrite, speculative repository layer, second queue/cache system, or broad compatibility layer.

The new general PR check requires a healthy reproducible dependency baseline: generated shared/Prisma prerequisites, all workspace typechecks, deterministic tests, lint, then production builds. Use test environment values and no production secrets. Include changes to cache/job/config/dependency files in appropriate performance gates. Keep timing tests separate from functional tests.

Acceptance: one command reproduces CI; controlled fixtures; no watch processes; failures remain visible; reviewed refactors shrink caller knowledge rather than merely moving lines.

## Build / validate / iterate rule

For each item: capture baseline, state hypothesis, write a failing observable check, make the smallest change, run that check, measure the same workload, inspect the diff, and keep only the proven improvement. Repeat when a new failure or unresolved concern justifies it.

Finish an iteration with evidence and its limits. Deploy only after approval and local gates. Verify deployed routes, real browser journeys, and cache freshness before claiming customer impact.

## Second iteration completed locally

- Removed jsdom initialization from 12 proven file-only source-contract test suites through per-file Node annotations. The matched 40-test workload took 3.87–5.34 seconds before and 1.92–2.07 seconds after; all affected tests and a separate browser-environment smoke suite pass. Preserve jsdom for component and browser-global tests.
- Moved existing agency ownership into the first client-detail SQL predicate. Synthetic foreign-tenant histories now issue one query instead of five; response behavior remains unchanged. All 51 focused service/route/security checks and API typecheck pass. Search/index/history contract changes remain deferred.
- Added a repeatable route-entry byte inventory script using Python's standard library. It measures emitted chunk sizes; it does not substitute for browser timings.

## Next execution boundary

Wave 1 and the measured second iteration are local implementation. Waves 2–5 remain partially complete; additional changes depend on representative journey measurements. Production latency, real-provider OAuth behavior, multi-instance invalidation, and live browser timings require further verification. Fresh builds show 1.49–7.34% fewer estimated gzip bytes on affected route entries; this is not a page-speed measurement. No owners, deadlines, infrastructure spending, or product-contract changes were invented.

## Primary references

- [Next.js lazy loading](https://nextjs.org/docs/app/guides/lazy-loading): defer client code that a route does not initially render.
- [Next.js server/client components](https://nextjs.org/docs/app/getting-started/server-and-client-components): place providers where needed.
- [PostgreSQL EXPLAIN](https://www.postgresql.org/docs/current/using-explain.html): inspect actual plans and buffer work; ANALYZE executes the statement.
- [Web Vitals](https://web.dev/articles/vitals): evaluate field metrics by percentile and device segment.

## Updated first-login priority

Read-only live inspection verifies the API is on free Render compute. Two login windows encountered startup before Dashboard requests. Warm browser reloads took 1.0–1.5 seconds; warm API processing took 3.3–97.2 ms. First intervention: request approval to upgrade only agency-access compute to the $7/month 0.5c-512mb plan, then verify a first login after 16 idle minutes plus warm samples. Do not claim 10X latency improvement before matched after measurements.

Reconcile publishable code onto deployed main 2a789c6, retaining its Node24 and dependency updates. The isolated Dashboard repair adds bounded fetch/cancellation and existing server timing collection. Deploy and spending require separate explicit approval; neither has happened.
