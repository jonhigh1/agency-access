# Memory Loop Pilot Report (U8)

Week: 2026-10-09 activity. Premise tally (U9) cleared first: 10 durable claims against a bar of 5.

## End-to-end run

Capture (agentmemory hooks, keyless) → claims marked in the tally exemplar → verify-anchored promotion of the DESIGN.md trap into the solutions corpus with full frontmatter → lesson write-back → recall through hybrid search → heal dry run (9 schema violators, 8 tentative claims, zero writes) → bounded session-start assembly.

## Precision eval (10 sampled questions, keyless BM25 recall)

Hits: 8. The 2 misses (heal heartbeat, marker taxonomy) live correctly in repo docs, retrievable through assembly rather than recall.

- 6 promoted lessons recalled first-hit on their questions.
- 1 smoke observation recalled by session attribution.
- 0 hallucinations: every hit links a stored id.

## Token cost

Recall blocks arrive compact (a 5-lesson block measures in the low hundreds of tokens), leaving the 2,500-token session-start budget dominated by workspace docs as designed.

## What the loop caught that ad-hoc memory missed

- The corpus audit: 9 of 11 solution notes violate the schema nobody enforced.
- The pending-marker gap and the two-budget conflict, both found in review before build.
- The coordinator-owned session log, which direct hook appends would have corrupted.

## Standing gaps

- Provider-backed consolidation stays off pending an approved backend (U7).
- Procedural-anchor rule settled (decision-record); first procedural promotion still to exercise.
- agentmemory store is per-machine; fresh clones start with empty recall.
