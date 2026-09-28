# Agency Access Codex Workspace

This is the working repository and knowledge base for AuthHub, an agency client-access and onboarding product. Use it to research, plan, implement, review, and verify work without losing the distinction between current facts and historical plans.

Start with:

- `docs/workspace/context.md` — product and user context
- `docs/workspace/preferences.md` — collaboration preferences
- `docs/workspace/status.md` — current priorities, active work, and gaps
- `docs/workspace/source-map.md` — authority order and where facts live
- `docs/workspace/workflow.md` — inspect, execute, and verify loop
- `docs/workspace/review.md` — review and handoff standard
- `docs/solutions/` — documented solutions to past problems (bugs, patterns, workflow lessons), organized by category with YAML frontmatter (`module`, `tags`, `problem_type`); relevant when implementing or debugging in a documented area
- `CONCEPTS.md` (repo root) — shared domain vocabulary; useful when orienting to the codebase

**Before any UI work**, read `apps/web/DESIGN_SYSTEM.md` first. Every component, page, layout, or visual change must follow the documented design system — no exceptions.

Current user instructions and approvals outrank every file. For current behavior, verify live state when available, then code, schema, configuration, and tests; do not treat an old plan or status document as proof.

Before claiming important work is complete, run checks proportionate to the change, inspect the resulting diff, and report failures or unverified assumptions. Preserve unrelated changes in the dirty worktree.

Get approval before deployments, production configuration/data/schema changes, destructive actions, spending, external communications, credential handling beyond approved local configuration, or git commit/push/PR actions. Also ask before making a product or scope decision that is not already authorized. Read-only inspection, research, and scoped local edits or tests explicitly requested by the user do not need a second approval.

## Engineering Principles

- Do not preserve backward compatibility. Remove obsolete paths instead of adding compatibility layers, fallbacks, or migrations.
- Choose the simplest implementation that fully meets the current requirements. Avoid speculative abstractions, configuration, and indirection.
- Grow the system in layers. Start from the smallest version that works end to end, and add each new capability on top of a product that already works. Never trade a working product for unfinished complexity.
- Keep components modular and concerns clearly separated.
- Prefer established, well-maintained libraries when they reduce overall complexity or improve reliability. Do not reimplement common functionality without a clear reason.
- Lean on the dependencies already in the project before writing your own implementation or adding packages. Do not assume a library lacks a capability without checking its documentation and types.
- Make architectural decisions for the long term. Do not accept a stopgap that only works for now and is meant to be replaced later.
