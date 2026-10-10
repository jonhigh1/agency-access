import type { Metadata } from "next";
import Link from "next/link";

const PAGE_URL = "https://authhub.co/guides";
const PAGE_TITLE = "Platform Access Guides for Agencies | AuthHub";
const META_DESCRIPTION =
  "Step-by-step guides for getting Meta Ads, Google Ads, and related platform access from clients — the manual path, then the one-link option.";

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

const GUIDES = [
  {
    slug: "meta-ads-access",
    title: "How to Get Meta Ads Access for Agencies",
    summary:
      "Give your agency access to client Facebook and Instagram ad accounts. Manual Business Manager steps, or one AuthHub link.",
  },
  {
    slug: "google-ads-access",
    title: "How to Get Google Ads Access for Agencies",
    summary:
      "Request Google Ads manager access from clients: Customer ID, Access and security, roles — or send one link.",
  },
] as const;

const itemListSchema = {
  "@context": "https://schema.org",
  "@type": "ItemList",
  name: "AuthHub platform access guides",
  itemListElement: GUIDES.map((guide, index) => ({
    "@type": "ListItem",
    position: index + 1,
    name: guide.title,
    url: `https://authhub.co/guides/${guide.slug}`,
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
          {GUIDES.map((guide) => (
            <li key={guide.slug} className="border-2 border-black bg-card p-5">
              <Link
                href={`/guides/${guide.slug}`}
                className="font-display text-lg font-bold text-ink hover:text-danger-ink hover:underline"
              >
                {guide.title}
              </Link>
              <p className="font-mono text-sm text-foreground mt-2">{guide.summary}</p>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
