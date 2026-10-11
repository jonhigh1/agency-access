import { SUPPORTED_PLATFORM_COUNT } from "@agency-platform/shared";
import {
  agencyAccessAlternativePage,
  leadsieAlternativePage,
} from "@/lib/comparison-data";

export interface CitedStat {
  id: string;
  claim: string;
  value: string;
  sourceLabel: string;
  sourceHref: string;
  lastVerified: string;
}

function requireVerified(value: string | undefined, label: string): string {
  if (!value) {
    throw new Error(`Missing lastVerified for ${label}`);
  }
  return value;
}

function starterLine(
  starter: { price: number | string; features: string[] } | undefined,
  label: string,
): string {
  if (!starter) {
    throw new Error(`Missing starter pricing for ${label}`);
  }
  return `$${starter.price}/mo (${starter.features[0]})`;
}

const leadsieVerified = requireVerified(
  leadsieAlternativePage.lastVerified,
  "leadsie-alternative",
);
const agencyAccessVerified = requireVerified(
  agencyAccessAlternativePage.lastVerified,
  "agencyaccess-alternative",
);

export const CLIENT_ACCESS_STATS: CitedStat[] = [
  {
    id: "authhub-starter",
    claim: "AuthHub Starter monthly list price",
    value: `$${leadsieAlternativePage.ourProduct.pricing.starter.price}/mo`,
    sourceLabel: "AuthHub vs Leadsie (recorded list price)",
    sourceHref: "https://authhub.co/compare/leadsie-alternative",
    lastVerified: leadsieVerified,
  },
  {
    id: "leadsie-starter",
    claim: "Leadsie Starter monthly list price",
    value: starterLine(leadsieAlternativePage.competitor.pricing.starter, "Leadsie"),
    sourceLabel: "Leadsie pricing as recorded on AuthHub compare",
    sourceHref: "https://authhub.co/compare/leadsie-pricing",
    lastVerified: leadsieVerified,
  },
  {
    id: "agencyaccess-starter",
    claim: "AgencyAccess Starter monthly list price",
    value: starterLine(
      agencyAccessAlternativePage.competitor.pricing.starter,
      "AgencyAccess",
    ),
    sourceLabel: "AgencyAccess pricing as recorded on AuthHub compare",
    sourceHref: "https://authhub.co/compare/agencyaccess-alternative",
    lastVerified: agencyAccessVerified,
  },
  {
    id: "authhub-platform-count",
    claim: "AuthHub client-facing platform products",
    value: String(SUPPORTED_PLATFORM_COUNT),
    sourceLabel: "AuthHub shared platform catalog (SUPPORTED_PLATFORM_COUNT)",
    sourceHref: "https://authhub.co/pricing",
    lastVerified: "2026-10-10",
  },
];
