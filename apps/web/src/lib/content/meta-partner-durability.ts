/**
 * Partner-handshake product copy (ticket 11): OAuth orchestrates; Partner access is durable on Meta.
 */

export const META_PARTNER_DURABILITY = {
  oauthOrchestration:
    'Facebook login gives AuthHub a client token so we can list assets, run Partner steps, and re-check access. That token is orchestration—it expires on Meta’s schedule and can be refreshed without removing Partner access.',
  durableOutcomeLead:
    'Durable access means your agency’s Business Portfolio is added as a Partner on the assets you select. You keep ownership.',
  revokePartner:
    'To remove agency access, remove the Partner in Meta Business Settings (or ask your agency to disconnect). Ending an AuthHub subscription or an expired OAuth token does not by itself revoke Partner access.',
} as const;

/** Matches grant UI + permission-matrix automation rows (tickets 04/07). */
export const META_AUTOMATION_MATRIX_LINES = [
  { asset: 'Facebook Pages', mode: 'automatic' as const, detail: 'Graph assigned_users + Page partner mutation with read-back' },
  { asset: 'Ad accounts', mode: 'manual' as const, detail: 'Assign Partner in Meta Business Settings, then Check access in AuthHub' },
  {
    asset: 'Business Portfolio link (client ↔ agency BM)',
    mode: 'manual' as const,
    detail: 'Manual Meta Business Settings steps until a live Graph path is proven',
  },
  { asset: 'Instagram, catalogs, pixels & datasets', mode: 'manual' as const, detail: 'Partner share or assignment in Meta Business Settings' },
] as const;

export const META_AGENCY_SETTINGS_PARTNER_COPY = {
  eyebrow: 'Partner access model',
  title: 'How client grants stay durable on Meta',
  description:
    'AuthHub OAuth reconnects orchestration tokens; Partner access on client assets lives in Meta until someone removes the Partner.',
  oauthNote: META_PARTNER_DURABILITY.oauthOrchestration,
  revokeNote: META_PARTNER_DURABILITY.revokePartner,
  matrixHeading: 'Automatic vs Manual (live product paths)',
} as const;
