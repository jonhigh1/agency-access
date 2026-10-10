import type { Metadata } from "next";
import Link from "next/link";

import { getCompareHubEntries } from "@/lib/comparison-data";

const PAGE_URL = "https://authhub.co/compare";
const PAGE_TITLE = "Compare Client Access Tools | AuthHub";
const META_DESCRIPTION =
  "Honest comparisons of AuthHub vs ClientInvite, Leadsie, and AgencyAccess — pricing units, platform coverage, and when the other tool is the better pick.";

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

const entries = getCompareHubEntries();

const itemListSchema = {
  "@context": "https://schema.org",
  "@type": "ItemList",
  name: "AuthHub client access comparisons",
  itemListElement: entries.map((entry, index) => ({
    "@type": "ListItem",
    position: index + 1,
    name: entry.title,
    url: `https://authhub.co/compare/${entry.slug}`,
  })),
};

const tableClass = "w-full border-collapse border-2 border-black font-mono text-sm";
const thClass = "border border-black p-3 text-left font-bold bg-ink text-paper";
const tdClass = "border border-black p-3 align-top";

export default function CompareHubPage() {
  return (
    <div className="min-h-screen bg-paper">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListSchema) }}
      />

      <section className="border-b-2 border-black">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-12 md:py-16">
          <div className="max-w-3xl">
            <p className="label-micro text-danger-ink mb-4">Comparisons</p>
            <h1 className="font-dela text-3xl sm:text-4xl md:text-5xl text-ink mb-4 tracking-tight">
              Compare client access tools
            </h1>
            <p className="font-mono text-base text-foreground">
              AuthHub vs ClientInvite, Leadsie, and AgencyAccess — with live pricing units
              and pick-X-if gates. These pages say when the other tool is the better pick.
            </p>
          </div>
        </div>
      </section>

      <section className="container mx-auto px-4 sm:px-6 lg:px-8 py-12 md:py-16">
        <h2 className="font-dela text-xl md:text-2xl text-ink mb-6">Where to start</h2>
        <div className="overflow-x-auto mb-12">
          <table className={tableClass}>
            <thead>
              <tr>
                <th className={thClass}>If this is the job</th>
                <th className={thClass}>Read this</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className={tdClass}>Shopify Partner access or unlimited monthly connections</td>
                <td className={tdClass}>
                  <Link href="/compare/clientinvite-alternative" className="text-danger-ink font-bold hover:underline">
                    ClientInvite vs AuthHub
                  </Link>
                </td>
              </tr>
              <tr>
                <td className={tdClass}>Leaving Leadsie credits or checking overage math</td>
                <td className={tdClass}>
                  <Link href="/compare/leadsie-alternative" className="text-danger-ink font-bold hover:underline">
                    Leadsie alternative
                  </Link>
                  {" · "}
                  <Link href="/compare/leadsie-pricing" className="text-danger-ink font-bold hover:underline">
                    Leadsie pricing
                  </Link>
                </td>
              </tr>
              <tr>
                <td className={tdClass}>Broader niche connectors beyond the core ad stack</td>
                <td className={tdClass}>
                  <Link href="/compare/agencyaccess-alternative" className="text-danger-ink font-bold hover:underline">
                    AgencyAccess alternative
                  </Link>
                </td>
              </tr>
              <tr>
                <td className={tdClass}>Shortlist all three at once</td>
                <td className={tdClass}>
                  <Link href="/compare/leadsie-vs-agencyaccess-vs-authhub" className="text-danger-ink font-bold hover:underline">
                    Leadsie vs AgencyAccess vs AuthHub
                  </Link>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <h2 className="font-dela text-xl md:text-2xl text-ink mb-6">All comparisons</h2>
        <ul className="grid gap-4 sm:grid-cols-2">
          {entries.map((entry) => (
            <li key={entry.slug} className="border-2 border-black bg-card p-5">
              <Link
                href={`/compare/${entry.slug}`}
                className="font-display text-lg font-bold text-ink hover:text-danger-ink hover:underline"
              >
                {entry.title}
              </Link>
              <p className="font-mono text-sm text-foreground mt-2">{entry.summary}</p>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
