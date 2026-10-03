# Pre-push hook observation

Date: 2026-10-02. Read-only inspection of the dirty `.githooks/pre-push` and committed `scripts/tests/pre-push.test.mjs`. No hook or test file changed.

The working-tree hook now runs `entire hooks git pre-push "$1"`, then invokes `.githooks/pre-push.pre-entire`. The chained pre-entire script already delegates to Entire, captures and forwards its own stdin, and runs the main build gate only when it receives a main ref. The wrapper does not capture or forward Git's ref lines to the chained script, and it does not stop when its first Entire call fails.

This produces the observed failures in all four test cases:

- Entire runs twice because both the dirty wrapper and the chained script call it.
- The wrapper consumes the push input. The chained script receives no ref lines, so it skips the main build gate.
- The main success case therefore sees no npm build commands. The build failure case receives status 0 because the fake npm command never runs.
- The Entire failure case still invokes the second Entire call; the first failure status is discarded.
- Feature and deletion cases also show duplicate Entire invocations.

Reproduction: `node --test scripts/tests/pre-push.test.mjs` reports 4 tests, 0 passing, 4 failing. Assertion failures point to the duplicate invocation (test line 48), duplicate call list after Entire error (line 56), skipped simulated build failure (line 61), and duplicate invocation for feature/deletion refs (line 72).

The test file has no working-tree diff in this inspection. `.githooks/pre-push` is an existing dirty user change, also listed as pre-existing in the audit environment record. Its stated intent is to add the Entire session hook while chaining the committed build gate. That intent is reasonable; the current implementation does not preserve the intended chain semantics. This is a behavioral bug in the dirty hook, not evidence that the committed tests are stale. Do not replace or stage the hook as part of this audit.

The repeated run described by the parent is consistent with invoking this four-test file twice: each run fails all four cases. This inspection did not run the broader test suite or any build gate.
