import type { Metadata } from "next";
import type { Route } from "next";
import Link from "next/link";
import { getAllUseCases } from "@/lib/use-cases";
import { CANONICAL_ORIGIN } from "@/lib/seo-canonical";

const PAGE_URL = `${CANONICAL_ORIGIN}/uses`;
const PAGE_TITLE = "Who AuthHub Is For | AuthHub";
const META_DESCRIPTION =
  "Client platform access for PPC agencies, SEO agencies, freelancers, and in-house marketing teams — not a dental or ecommerce playbook.";

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

const useCases = getAllUseCases();

const itemListSchema = {
  "@context": "https://schema.org",
  "@type": "ItemList",
  name: "AuthHub use cases",
  itemListElement: useCases.map((useCase, index) => ({
    "@type": "ListItem",
    position: index + 1,
    name: useCase.title,
    url: `${CANONICAL_ORIGIN}/uses/${useCase.slug}`,
  })),
};

export default function UsesHubPage() {
  return (
    <div className="min-h-screen bg-paper">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListSchema) }}
      />

      <section className="border-b-2 border-black">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-12 md:py-16">
          <div className="max-w-3xl">
            <p className="label-micro text-danger-ink mb-4">Uses</p>
            <h1 className="font-dela text-3xl sm:text-4xl md:text-5xl text-ink mb-4 tracking-tight">
              Who AuthHub is for
            </h1>
            <p className="font-mono text-base text-foreground">
              Agencies and operators who collect client access to ads and analytics
              platforms. Four verticals, cross-linked. Not dental, not ecommerce.
            </p>
          </div>
        </div>
      </section>

      <section className="container mx-auto px-4 sm:px-6 lg:px-8 py-12 md:py-16">
        <ul className="grid gap-4 sm:grid-cols-2">
          {useCases.map((useCase) => (
            <li key={useCase.slug} className="border-2 border-black bg-card p-5">
              <Link
                href={`/uses/${useCase.slug}` as Route}
                className="font-display text-lg font-bold text-ink hover:text-danger-ink hover:underline"
              >
                {useCase.title}
              </Link>
              <p className="font-mono text-sm text-foreground mt-2">{useCase.hubSummary}</p>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
