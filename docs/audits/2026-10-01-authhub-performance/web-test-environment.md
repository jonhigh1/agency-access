# Web test environment measurement

Twelve source-contract suites read files or pure data and do not use browser globals. Each now declares `// @vitest-environment node`. The default environment remains jsdom for browser tests.

Measured from `apps/web` with Vitest 4.0.16, Node 22.22.3, `--maxWorkers=4`, and the same 12 files in every run. All 40 tests passed each time. `/usr/bin/time -p` measured wall time.

| Environment | Wall time (seconds) | Vitest reported duration (seconds) | Aggregate environment setup |
| --- | ---: | ---: | ---: |
| jsdom, run 1 | 3.87 | 3.18 | 6.96 s |
| jsdom, run 2 | 5.34 | 4.80 | 8.51 s |
| Node, run 1 | 2.07 | 1.50 | 1 ms |
| Node, run 2 | 1.94 | 1.43 | 1 ms |
| Node, run 3 | 1.92 | 1.42 | 1 ms |

The matched workload improved. This does not measure the full web suite or the two-worker CI command. A separate jsdom smoke test (`src/components/ui/__tests__/status-badge.test.tsx`) passed all 13 tests after the change.

Measured files:

- `src/__tests__/{app-directory-structure,client-component-directives,frontend-perf-contracts,next-config,sentry-config}.test.ts`
- `src/app/(authenticated)/dashboard/__tests__/usage-overview-location.test.ts`
- `src/app/onboarding/__tests__/route-targets.test.ts`
- `src/components/marketing/__tests__/{marketing-copy,marketing-honesty,pricing-copy,hero-copy-rewrite-copy}.claims.test.ts`
- `src/lib/api/__tests__/api-url-usage.test.ts`

Reproduce with `vitest run --maxWorkers=4 --reporter=dot` followed by those paths. Before measurements used the same files without environment annotations; after measurements used the annotations.
