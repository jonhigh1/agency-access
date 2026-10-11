import type { Metadata } from "next";
import type { Route } from "next";
import Link from "next/link";
import { CLIENT_ACCESS_STATS } from "@/lib/client-access-stats";
import { CANONICAL_ORIGIN } from "@/lib/seo-canonical";

const PAGE_URL = `${CANONICAL_ORIGIN}/stats`;
const PAGE_TITLE = "Client Access Stats for Agencies | AuthHub";
const META_DESCRIPTION =
  "Citable client-access figures with dates and sources: list prices and platform counts. No invented conversion rates or case-study metrics.";

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

export default function StatsPage() {
  return (
    <div className="min-h-screen bg-paper">
      <section className="border-b-2 border-black">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-12 md:py-16">
          <div className="max-w-3xl">
            <p className="label-micro text-danger-ink mb-4">Research</p>
            <h1 className="font-dela text-3xl sm:text-4xl md:text-5xl text-ink mb-4 tracking-tight">
              Client access stats
            </h1>
            <p className="font-mono text-base text-foreground">
              One-liners you can cite. Every number has a date and a source.
              Nothing here is a customer case study or an invented save-rate.
            </p>
          </div>
        </div>
      </section>

      <section className="container mx-auto px-4 sm:px-6 lg:px-8 py-12 md:py-16">
        <dl className="max-w-3xl space-y-8">
          {CLIENT_ACCESS_STATS.map((stat) => (
            <div key={stat.id} className="border-2 border-black bg-card p-5">
              <dt className="label-micro text-ink mb-2">{stat.claim}</dt>
              <dd>
                <p className="font-dela text-2xl text-ink mb-3">{stat.value}</p>
                <p className="font-mono text-sm text-foreground">
                  Source:{" "}
                  <a
                    href={stat.sourceHref}
                    className="text-danger-ink font-bold hover:underline"
                  >
                    {stat.sourceLabel}
                  </a>
                  {" · "}
                  Last verified {stat.lastVerified}
                </p>
              </dd>
            </div>
          ))}
        </dl>
        <p className="max-w-3xl font-mono text-sm text-foreground mt-10">
          Related:{" "}
          <Link href={"/compare" as Route} className="text-danger-ink font-bold hover:underline">
            compare tools
          </Link>
          {" · "}
          <Link href={"/blog" as Route} className="text-danger-ink font-bold hover:underline">
            blog
          </Link>
        </p>
      </section>
    </div>
  );
}
