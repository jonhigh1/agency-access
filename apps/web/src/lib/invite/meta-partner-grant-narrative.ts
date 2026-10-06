import type { MetaAssetKind } from '@agency-platform/shared';

export type MetaGrantAutomationMode = 'automatic' | 'manual';

export interface MetaPartnerGrantNarrativeInput {
  agencyBusinessId: string | null;
  agencyBusinessName?: string | null;
  clientBusinessId?: string | null;
  clientBusinessName?: string | null;
}

export interface MetaPartnerGrantNarrative {
  headline: string;
  body: string;
  agencyPartnerLine: string | null;
  clientPortfolioLine: string | null;
  /** Explicit: business-scoped discovery is not the zero-portfolio Page list. */
  discoveryNote: string;
  zeroPortfolioPagesNote: string;
}

export const META_GRANT_AUTOMATION_LABEL: Record<MetaGrantAutomationMode, string> = {
  automatic: 'Automatic',
  manual: 'Manual',
};

/**
 * Live automation matrix (ticket 06): Pages may be automatic via assigned_users;
 * Partner Business Portfolio share stays Manual until ticket 07 proves Graph mutation.
 */
export function resolveMetaGrantAutomationMode(assetKind: MetaAssetKind): MetaGrantAutomationMode {
  switch (assetKind) {
    case 'page':
      return 'automatic';
    case 'ad_account':
    case 'instagram_account':
    case 'catalog':
    case 'dataset':
      return 'manual';
    default:
      return 'manual';
  }
}

export function buildMetaPartnerGrantNarrative(
  input: MetaPartnerGrantNarrativeInput
): MetaPartnerGrantNarrative {
  const agencyLabel = input.agencyBusinessName?.trim() || 'your agency';
  const agencyId = input.agencyBusinessId?.trim() || null;
  const clientName = input.clientBusinessName?.trim() || null;
  const clientId = input.clientBusinessId?.trim() || null;

  const agencyPartnerLine = agencyId
    ? `Partner recipient: ${agencyLabel} · Business Portfolio ID ${agencyId}`
    : null;

  const clientPortfolioLine =
    clientId && clientName
      ? `Sharing from your Business Portfolio: ${clientName} · ID ${clientId}`
      : clientId
        ? `Sharing from your Business Portfolio · ID ${clientId}`
        : null;

  return {
    headline: 'Partner access for your agency',
    body:
      'Durable access means your agency\'s Business Portfolio is added as a Partner on the assets you select. You keep ownership; revoke Partner access anytime in Meta Business Settings.',
    agencyPartnerLine,
    clientPortfolioLine,
    discoveryNote:
      'Assets loaded after you choose a Business Portfolio come from Meta business-scoped discovery (business_management). That is separate from the Facebook Page list shown when someone has no Business Portfolio (pages_show_list / user Pages).',
    zeroPortfolioPagesNote:
      'When you have no Business Portfolio yet, AuthHub lists Pages from your Facebook profile (pages_show_list). That path is not business_management portfolio proof.',
  };
}
