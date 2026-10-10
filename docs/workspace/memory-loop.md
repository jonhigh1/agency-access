# Memory Loop Contract

Authority order for memory: user instruction, live code and tests, promoted repo notes, agentmemory recall, raw logs. No memory layer outranks code.

## Substrate (agentmemory, U1)

- Server runs local-only: REST on `http://localhost:3111`, viewer on `:3113`, bound to loopback. Verified healthy keyless on 2026-10-09 (BM25-only retrieval, synthetic compression, deterministic graph extraction).
- Store lives per-machine (`~/.agentmemory`), outside git. The repo corpus is the portable layer; fresh clones start with empty recall.
- Keyless baseline holds capture, recall, and deterministic graph extraction. Full consolidation and summarization need a model backend (key or local model); U7 records the verdict.
- Session-start budget: 2,500 tokens total for workspace docs plus recall. Substrate injection cap nests inside it with overall-wins; both values live here.
- Repo config carries `AGENTMEMORY_URL` only. No secrets are committed; local auth stays open loopback.
- Recall proof (U1): observation posted keyless returns through hybrid recall. Re-verify after any substrate upgrade.

## Verify and promote (U4)

- Verification anchors to the verifying commit SHA from a clean checkout. Procedural learnings with no anchoring commit promote under a decision-record anchor (decision record, date, owner) per the settled 2026-10-09 call.
- Destination checklist: behavior or bug to `docs/solutions/`, settled name to `GLOSSARY.md`, meaning to `CONCEPTS.md`, technical choice to `docs/DECISIONS.md`. Duplicates merge; the source entry links to the target.
- Mandatory solution frontmatter: `title`, `date`, `category`, `module`, `problem_type`, `tags`; optional `component`, `symptoms`, `root_cause`, `resolution_type`, `severity`, `supersedes`. Enforced by `scripts/memory/check-frontmatter.mjs`, wired into root `test:run`.
- Promotion writes the learning back into agentmemory as a high-confidence lesson so recall improves.

## Claim markers (U3)

Six states, marked inline on the source entry. `pending` is the default unmarked state.

- `pending` — captured, not yet verified.
- `verified <sha>` — checked against the named commit from a clean checkout.
- `tentative <recheck>` — evidenced but not commit-anchored; carries its recheck condition.
- `dropped <reason>` — wrong or superseded before promotion; reason recorded.
- `promoted <path>` — lives in exactly one home; source entry links to it.
- `invalidated <superseding-ref>` — a revert or newer truth retired it.

A daily log renames to `.done.md` only when the marker checker reports zero unmarked claims.

## Hook ownership (U2)

| Event | Owner | Store |
|---|---|---|
| Working-memory capture | agentmemory hooks | Per-machine store |
| Raw session transcript | Entire auto-logs | `.remember/` (gitignored) |
| Curated claims | Capture distillation, doubled as the session-log entry | `docs/SESSION-LOG.md` (committed) |

No event has two owners. Single-slot `now.md` is retired; concurrent sessions write session-identity-prefixed blocks.

## Hook composition (U2)

- Session identity is the host sessionID, received independently by both plugins. Dedup key is date plus session identity.
- agentmemory capture plugin: observations on prompts, tool calls, diffs, and status changes; `/session/end` plus forced consolidation on session delete; summarize on idle and compaction.
- Entire plugin: raw transcript into `.remember/`; its `now.md` stays an Entire-owned latest-status slot, never a memory store the loop depends on.
- The two stores never share a write surface (per-machine server store vs repo `.remember/`), so parallel sessions cannot corrupt each other; verification is per-store intactness, not cross-store locking.
- The `.remember/` convention note lives here instead of in `.remember/` because that directory is gitignored and unrecoverable.
