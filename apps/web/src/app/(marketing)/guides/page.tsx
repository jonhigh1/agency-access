import type { Metadata } from "next";
import Link from "next/link";
import { getAllGuides } from "@/lib/guides";
import { CANONICAL_ORIGIN } from "@/lib/seo-canonical";

const PAGE_URL = `${CANONICAL_ORIGIN}/guides`;
const PAGE_TITLE = "Platform Access Guides for Agencies | AuthHub";
const META_DESCRIPTION =
  "Step-by-step guides for getting Meta Ads, Google Ads, GA4, LinkedIn, TikTok, and Business Manager access from clients — the manual path, then the one-link option.";

export const metadata: Metadata = {
  title: PAGE_TITLE,
  description: META_DESCRIPTION,
  alternates: {
    canonical: PAGE_URL,
  },
  openGraph: {
    title: PAGE_TITLE,
    description: META_DESCRIPTION,
    type: "website",
    url: PAGE_URL,
  },
};

const guides = getAllGuides();

const itemListSchema = {
  "@context": "https://schema.org",
  "@type": "ItemList",
  name: "AuthHub platform access guides",
  itemListElement: guides.map((guide, index) => ({
    "@type": "ListItem",
    position: index + 1,
    name: guide.title,
    url: `${CANONICAL_ORIGIN}/guides/${guide.slug}`,
  })),
};

export default function GuidesHubPage() {
  return (
    <div className="min-h-screen bg-paper">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListSchema) }}
      />

      <section className="border-b-2 border-black">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-12 md:py-16">
          <div className="max-w-3xl">
            <p className="label-micro text-danger-ink mb-4">Guides</p>
            <h1 className="font-dela text-3xl sm:text-4xl md:text-5xl text-ink mb-4 tracking-tight">
              Platform access guides
            </h1>
            <p className="font-mono text-base text-foreground">
              How agencies get client access to ad and analytics accounts. Manual steps first,
              then the one-link option. These pages are the breadcrumb parent for every guide.
            </p>
          </div>
        </div>
      </section>

      <section className="container mx-auto px-4 sm:px-6 lg:px-8 py-12 md:py-16">
        <ul className="grid gap-4 sm:grid-cols-2">
          {guides.map((guide) => (
            <li key={guide.slug} className="border-2 border-black bg-card p-5">
              <Link
                href={`/guides/${guide.slug}`}
                className="font-display text-lg font-bold text-ink hover:text-danger-ink hover:underline"
              >
                {guide.title}
              </Link>
              <p className="font-mono text-sm text-foreground mt-2">{guide.hubSummary}</p>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
