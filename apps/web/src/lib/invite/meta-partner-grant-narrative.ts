import type { MetaAssetKind } from '@agency-platform/shared';
import { META_PARTNER_DURABILITY } from '@/lib/content/meta-partner-durability';

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
  oauthOrchestrationNote: string;
  revokeNote: string;
  agencyPartnerLine: string | null;
  clientPortfolioLine: string | null;
  /** Client-safe: how portfolio selection affects asset lists. */
  discoveryNote: string;
  zeroPortfolioPagesNote: string;
}

/** Agency-only / advanced copy — not rendered on default client grant screens. */
export const META_PARTNER_GRANT_ADVANCED_COPY = {
  businessScopedDiscovery:
    'Assets loaded after you choose a Business Portfolio come from Meta business-scoped discovery (business_management). That is separate from the Facebook Page list shown when someone has no Business Portfolio (pages_show_list / user Pages).',
  zeroPortfolioPages:
    'When you have no Business Portfolio yet, AuthHub lists Pages from your Facebook profile (pages_show_list). That path is not business_management portfolio proof.',
  automationMatrixDetail: {
    pages:
      'Graph assigned_users + Page partner mutation with read-back',
    adAccounts: 'Assign Partner in Meta Business Settings, then Check access in AuthHub',
    portfolioLink: 'Manual Meta Business Settings steps until a live Graph path is proven',
  },
} as const;

export const META_GRANT_AUTOMATION_LABEL: Record<MetaGrantAutomationMode, string> = {
  automatic: 'Automatic',
  manual: 'Manual',
};

/**
 * Live automation matrix (tickets 04/07): Pages automatic via assigned_users + Page
 * partner Graph mutation with read-back; ad accounts Manual partner share + Check access.
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
    body: META_PARTNER_DURABILITY.durableOutcomeLead,
    oauthOrchestrationNote: META_PARTNER_DURABILITY.oauthOrchestration,
    revokeNote: META_PARTNER_DURABILITY.revokePartner,
    agencyPartnerLine,
    clientPortfolioLine,
    discoveryNote:
      'After you pick a Business Portfolio, AuthHub loads the ad accounts, Pages, and other assets tied to that portfolio in Meta.',
    zeroPortfolioPagesNote:
      'When you do not have a Business Portfolio yet, AuthHub lists Pages from your Facebook profile. That list is separate from portfolio assets.',
  };
}
