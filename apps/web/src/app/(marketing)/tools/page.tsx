import type { Metadata } from "next";
import type { Route } from "next";
import Link from "next/link";
import { CANONICAL_ORIGIN } from "@/lib/seo-canonical";

const PAGE_URL = `${CANONICAL_ORIGIN}/tools`;
const PAGE_TITLE = "Agency Access Tools | AuthHub";
const META_DESCRIPTION =
  "Ungated tools for agencies requesting client platform access — start with the access-level recommender.";

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

const itemListSchema = {
  "@context": "https://schema.org",
  "@type": "ItemList",
  name: "AuthHub agency access tools",
  itemListElement: [
    {
      "@type": "ListItem",
      position: 1,
      name: "Access-level tool",
      url: `${CANONICAL_ORIGIN}/tools/access-level`,
    },
  ],
};

export default function ToolsHubPage() {
  return (
    <div className="min-h-screen bg-paper">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListSchema) }}
      />

      <section className="border-b-2 border-black">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-12 md:py-16">
          <div className="max-w-3xl">
            <p className="label-micro text-danger-ink mb-4">Tools</p>
            <h1 className="font-dela text-3xl sm:text-4xl md:text-5xl text-ink mb-4 tracking-tight">
              Agency access tools
            </h1>
            <p className="font-mono text-base text-foreground">
              Decision helpers for client platform access. No signup wall. No
              Business Manager ID scraper.
            </p>
          </div>
        </div>
      </section>

      <section className="container mx-auto px-4 sm:px-6 lg:px-8 py-12 md:py-16">
        <ul className="grid gap-4 sm:grid-cols-2">
          <li className="border-2 border-black bg-card p-5">
            <Link
              href={"/tools/access-level" as Route}
              className="font-display text-lg font-bold text-ink hover:text-danger-ink hover:underline"
            >
              Access-level tool
            </Link>
            <p className="font-mono text-sm text-foreground mt-2">
              Pick the platform family and the job. Get admin, standard, read-only,
              or email-only — then copy the recommendation with attribution.
            </p>
          </li>
        </ul>
      </section>
    </div>
  );
}
