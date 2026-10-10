# Memory Heal Runbook (U5)

The heal pass runs on the external schedule and defaults to flags. Repairs ship as proposed diffs for user approval; autonomous runs never write repairs.

## Scan

1. Run the marker checker and frontmatter checker across `docs/solutions/` and the loop contract.
2. Review the tentative queue (claims marked `tentative` with unmet recheck conditions).
3. Check the last-run heartbeat. A missing or stale heartbeat surfaces an overdue warning at session start instead of silent staleness.

## Staleness classes

- Contradicted: a note the code now disproves. Flag with the disproving reference.
- Superseded: a note a newer note or commit replaces. Flag with the `supersedes` target.
- Dead reference: paths, commands, or hosts that no longer exist. Flag with the broken anchor.

## Tentative queue

The pass owns every tentative claim. A claim past its recheck condition without new evidence expires with its reason recorded as a flag. Expiry is a flag, never a silent write.

## Verdict log

Each run appends one entry to `docs/memory-heal-verdicts.md`: date, scope scanned, flags emitted, repairs proposed, approvals received. A second run over unchanged inputs emits no duplicate verdicts.
