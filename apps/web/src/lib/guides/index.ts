import { facebookBusinessManagerAccessGuide } from "./facebook-business-manager-access";
import { ga4AccessGuide } from "./ga4-access";
import { googleAdsAccessGuide } from "./google-ads-access";
import { linkedinAdsAccessGuide } from "./linkedin-ads-access";
import { metaAdsAccessGuide } from "./meta-ads-access";
import { tiktokAdsAccessGuide } from "./tiktok-ads-access";
import type { GuideDefinition } from "./types";

export type { GuideDefinition, GuideFaq, GuideHowToStep } from "./types";
export { generateGuideSchemas, guideCanonicalUrl } from "./schema";

const GUIDES: GuideDefinition[] = [
  metaAdsAccessGuide,
  googleAdsAccessGuide,
  ga4AccessGuide,
  linkedinAdsAccessGuide,
  tiktokAdsAccessGuide,
  facebookBusinessManagerAccessGuide,
];

export function getAllGuides(): GuideDefinition[] {
  return [...GUIDES];
}

export function getAllGuideSlugs(): string[] {
  return GUIDES.map((guide) => guide.slug);
}

export function getGuideBySlug(slug: string): GuideDefinition | undefined {
  return GUIDES.find((guide) => guide.slug === slug);
}
