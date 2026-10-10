# Homepage section badge inventory

Scope: the sections rendered by `apps/web/src/app/(marketing)/page.tsx`.
Product status badges, platform tiles, and the numbered value strip serve other roles.

| Section | Previous badge | Previous differences | Standard variant |
| --- | --- | --- | --- |
| Hero | Client Access Platform | Ink, rounded, tilted, hover rotation | Ink |
| Pain | The Reality | Coral, white text, coral border, large shadow, animated warning emojis | Coral |
| Solution | The simpler way | Coral, square, micro-label typography | Ink |
| Features | Real Results | Coral, white text, rounded | Coral |
| Integrations | Integration | Coral, black text, rounded | Ink |
| How it works | 5-Minute Setup | Ink, rounded, responsive bottom margin | Coral |
| Success stories | Real Results | Coral, white text, rounded, no icon | Ink |
| FAQ | None | No heading badge | Coral |
| Final CTA | None | No heading badge | Ink |

Seven existing heading badges become nine consistent badges. The value strip between
Hero and Pain has no heading badge and does not interrupt the alternation.

## Shared contract

`SectionBadge` owns both variants. Both use square corners, a 2px ink border,
a 4px offset shadow, the same responsive padding, mono uppercase type,
and one decorative 14px Lucide icon. Both use the same bottom spacing.
The ink variant uses paper text; coral uses ink text for contrast.
Badges have no independent rotation, pulse, or hover motion.
Existing section reveal animations continue to reveal each header as a unit.

Use the next alternating variant when adding another homepage heading section.
