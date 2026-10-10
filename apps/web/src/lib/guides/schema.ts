import { generateFAQSchema, generateHowToSchema } from "@/lib/schema-generators";
import { CANONICAL_ORIGIN } from "@/lib/seo-canonical";
import type { GuideDefinition } from "./types";

export function guideCanonicalUrl(slug: string): string {
  return `${CANONICAL_ORIGIN}/guides/${slug}`;
}

export function generateGuideSchemas(
  guide: GuideDefinition,
): Record<string, unknown>[] {
  const pageUrl = guideCanonicalUrl(guide.slug);

  return [
    generateHowToSchema(
      {
        name: guide.howToName,
        description: guide.howToDescription,
        steps: guide.howToSteps,
      },
      pageUrl,
    ),
    generateFAQSchema(guide.faqs),
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        {
          "@type": "ListItem",
          position: 1,
          name: "Home",
          item: CANONICAL_ORIGIN,
        },
        {
          "@type": "ListItem",
          position: 2,
          name: "Guides",
          item: `${CANONICAL_ORIGIN}/guides`,
        },
        {
          "@type": "ListItem",
          position: 3,
          name: guide.breadcrumbName,
          item: pageUrl,
        },
      ],
    },
  ];
}
