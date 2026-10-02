# AuthHub polish and performance integration

Base: current main `daa9f3b1`. The committed `codex/authhub-polish` branch is already an ancestor of this base. This integration carries the remaining local performance edits forward while retaining main's Node 24 runtime, dependency lockfile, UI polish, and deletion of the obsolete Deploy Repair workflow.

Changes:
- Share concurrent cold reads by cache key; prevent invalidated work from repopulating the cache.
- Reuse token-refresh queue policy; retry structured transient failures; ensure the cleanup queue exists.
- Apply tenant ownership before fetching client history.
- Bound Dashboard/API settings reads through the existing authenticated helper; collect failure stages and existing Server-Timing fields.
- Defer unopened dialogs and remove the duplicate marketing animation gate.
- Validate benchmark success responses, redact session tokens, and retain pushed refs through one hook delegation.
- Run deterministic tests, typechecks, lint, and builds in a general Node 24 workflow.

The external API health monitor is configured separately at ten-minute intervals. This commit does not change compute plans, incur hosting spend, or establish a measured 10X production latency gain.

Private browser screenshots, customer data, unrelated launch video work, and the separate Drex integration remain outside this release. Earlier Node 22/dependency proposals are superseded by current main.

Validation on Node 24: all workspace typechecks; API/web lint with 184 warnings and zero errors; application and CLI builds; 1,695 API tests (19 skipped), 165 shared tests, seven CLI tests, and nine hook/benchmark validation checks passed. The full web run passed 2,235 tests with two skips and four failures. Two failures exposed existing comparison source violations, now corrected. Two timed out under the parallel workload. All four affected suites then passed with 32 tests and two skips. Final web build rerun includes the comparison repair.
