/**
 * Long-form Leadsie pricing article under /compare/leadsie-pricing
 */

import type { ReactNode } from "react";
import Link from "next/link";
import type { Route } from "next";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { LeadsiePricingPageData } from "@/lib/leadsie-pricing-page";

interface LeadsiePricingPageTemplateProps {
  page: LeadsiePricingPageData;
}

function ArticleTable({
  children,
  caption,
}: {
  children: ReactNode;
  caption?: string;
}) {
  return (
    <figure className="my-8">
      <div className="overflow-x-auto border-2 border-black shadow-brutalist-sm">
        {children}
      </div>
      {caption ? (
        <figcaption className="mt-3 font-mono text-xs text-muted-foreground">{caption}</figcaption>
      ) : null}
    </figure>
  );
}

export function LeadsiePricingPageTemplate({ page }: LeadsiePricingPageTemplateProps) {
  return (
    <div className="min-h-screen bg-paper">
      <section className="border-b-2 border-black bg-white">
        <div className="container mx-auto px-4 py-16 sm:px-6 md:py-20 lg:px-8">
          <div className="mx-auto max-w-3xl text-center">
            <span className="mb-6 inline-block border-2 border-black bg-white px-4 py-2 text-xs font-bold uppercase tracking-wider text-coral">
              Pricing guide · verified {page.lastVerified}
            </span>
            <h1 className="font-dela text-3xl tracking-tight text-ink sm:text-4xl md:text-[2.75rem] md:leading-[1.05]">
              {page.title}
            </h1>
            <p className="mt-6 text-left font-mono text-sm leading-relaxed text-muted-foreground sm:text-base">
              {page.introLead}
            </p>
            <div className="mt-8 flex flex-col justify-center gap-4 sm:flex-row">
              <Button variant="brutalist" size="lg" asChild className="font-semibold uppercase tracking-wider">
                <Link href={"/signup" as Route}>
                  Start AuthHub free trial
                  <ArrowRight size={18} className="ml-2" aria-hidden />
                </Link>
              </Button>
              <Button variant="secondary" size="lg" asChild className="border-2 border-black font-semibold">
                <Link href={"/compare/leadsie-alternative" as Route}>
                  Compare AuthHub vs Leadsie features
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      <article className="container mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
        <section className="mb-14">
          <h2 className="font-dela text-2xl text-ink md:text-3xl">Leadsie plans and list prices</h2>
          <ArticleTable
            caption={
              "Sources: leadsie.com/pricing and Leadsie help center pricing article. Last checked " +
              page.lastVerified +
              "."
            }
          >
            <table className="w-full min-w-[640px] border-collapse font-mono text-sm">
              <thead className="border-b-2 border-black bg-gray-100">
                <tr>
                  <th scope="col" className="px-4 py-3 text-left font-bold text-ink">
                    Plan
                  </th>
                  <th scope="col" className="px-4 py-3 text-left font-bold text-ink">
                    Monthly
                  </th>
                  <th scope="col" className="px-4 py-3 text-left font-bold text-ink">
                    Yearly (effective)
                  </th>
                  <th scope="col" className="px-4 py-3 text-left font-bold text-ink">
                    Onboarding credits
                  </th>
                  <th scope="col" className="px-4 py-3 text-left font-bold text-ink">
                    Audit credits
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-300 bg-white">
                {page.plans.map((row) => (
                  <tr key={row.name}>
                    <td className="px-4 py-3 font-semibold text-ink">{row.name}</td>
                    <td className="px-4 py-3">{row.monthly}</td>
                    <td className="px-4 py-3">{row.yearly}</td>
                    <td className="px-4 py-3">{row.onboardingCredits}</td>
                    <td className="px-4 py-3">{row.auditCredits}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </ArticleTable>
          <p className="font-mono text-sm text-muted-foreground">
            Official references:{" "}
            <a
              href="https://www.leadsie.com/pricing"
              className="text-coral underline-offset-2 hover:underline"
              rel="noopener noreferrer"
              target="_blank"
            >
              leadsie.com/pricing
            </a>
            ,{" "}
            <a
              href="https://help.leadsie.com/article/96-leadsie-pricing"
              className="text-coral underline-offset-2 hover:underline"
              rel="noopener noreferrer"
              target="_blank"
            >
              Leadsie pricing help article
            </a>
            .
          </p>
        </section>

        <section className="mb-14">
          <h2 className="font-dela text-2xl text-ink md:text-3xl">How Leadsie credits work</h2>
          <ul className="mt-4 list-disc space-y-3 pl-5 font-mono text-sm leading-relaxed text-foreground">
            {page.creditBullets.map((bullet) => (
              <li key={bullet}>{bullet}</li>
            ))}
          </ul>
        </section>

        <section className="mb-14">
          <h2 className="font-dela text-2xl text-ink md:text-3xl">What happens when you run out</h2>
          <p className="mt-4 font-mono text-sm leading-relaxed text-muted-foreground">{page.runOutNote}</p>
          <ArticleTable>
            <table className="w-full border-collapse font-mono text-sm">
              <thead className="border-b-2 border-black bg-gray-100">
                <tr>
                  <th scope="col" className="px-4 py-3 text-left font-bold">
                    Plan
                  </th>
                  <th scope="col" className="px-4 py-3 text-left font-bold">
                    Overage pack
                  </th>
                  <th scope="col" className="px-4 py-3 text-left font-bold">
                    Extra onboarding credits
                  </th>
                  <th scope="col" className="px-4 py-3 text-left font-bold">
                    Extra audit credits
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-300 bg-white">
                {page.overagePacks.map((row) => (
                  <tr key={row.plan}>
                    <td className="px-4 py-3 font-semibold">{row.plan}</td>
                    <td className="px-4 py-3">{row.packPrice}</td>
                    <td className="px-4 py-3">{row.onboardingCredits}</td>
                    <td className="px-4 py-3">{row.auditCredits}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </ArticleTable>
        </section>

        <section className="mb-14">
          <h2 className="font-dela text-2xl text-ink md:text-3xl">Worked monthly cost examples</h2>
          <ArticleTable>
            <table className="w-full min-w-[640px] border-collapse font-mono text-sm">
              <thead className="border-b-2 border-black bg-gray-100">
                <tr>
                  <th scope="col" className="px-4 py-3 text-left font-bold">
                    New clients
                  </th>
                  <th scope="col" className="px-4 py-3 text-left font-bold">
                    Lowest published Leadsie path
                  </th>
                  <th scope="col" className="px-4 py-3 text-left font-bold">
                    Leadsie cost
                  </th>
                  <th scope="col" className="px-4 py-3 text-left font-bold">
                    AuthHub plan
                  </th>
                  <th scope="col" className="px-4 py-3 text-left font-bold">
                    AuthHub cost
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-300 bg-white">
                {page.workedExamples.map((row) => (
                  <tr key={row.newClients}>
                    <td className="px-4 py-3 font-semibold">{row.newClients}</td>
                    <td className="px-4 py-3">{row.leadsiePath}</td>
                    <td className="px-4 py-3">{row.leadsieCost}</td>
                    <td className="px-4 py-3">{row.authHubPlan}</td>
                    <td className="px-4 py-3 font-semibold">{row.authHubCost}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </ArticleTable>
          <p className="font-mono text-xs leading-relaxed text-muted-foreground">{page.workedExamplesFootnote}</p>
        </section>

        <section className="mb-14">
          <h2 className="font-dela text-2xl text-ink md:text-3xl">
            Leadsie pricing vs AuthHub — when each wins
          </h2>
          <div className="mt-8 grid gap-8 md:grid-cols-2">
            <div className="border-2 border-black bg-white p-6 shadow-brutalist-sm">
              <h3 className="font-dela text-lg text-ink">Stay on Leadsie if</h3>
              <ul className="mt-4 list-disc space-y-2 pl-5 font-mono text-sm text-foreground">
                {page.stayOnLeadsie.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
            <div className="border-2 border-black bg-[#FFF5F0] p-6 shadow-brutalist-sm">
              <h3 className="font-dela text-lg text-ink">Switch to AuthHub if</h3>
              <ul className="mt-4 list-disc space-y-2 pl-5 font-mono text-sm text-foreground">
                {page.switchToAuthHub.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        <section className="mb-14">
          <h2 className="font-dela text-2xl text-ink md:text-3xl">FAQ</h2>
          <dl className="mt-6 space-y-6">
            {page.faqs.map((faq) => (
              <div key={faq.question} className="border-2 border-black bg-white p-5 shadow-brutalist-sm">
                <dt className="font-dela text-base text-ink">{faq.question}</dt>
                <dd className="mt-2 font-mono text-sm leading-relaxed text-muted-foreground">{faq.answer}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section className="border-2 border-black bg-ink p-8 text-paper shadow-brutalist">
          <h2 className="font-dela text-2xl">Bottom line</h2>
          <p className="mt-4 font-mono text-sm leading-relaxed">{page.bottomLine}</p>
          <div className="mt-8 flex flex-col gap-4 sm:flex-row sm:flex-wrap">
            <Button variant="brutalist" size="lg" asChild className="bg-coral font-semibold uppercase tracking-wider">
              <Link href={"/signup" as Route}>Start free trial</Link>
            </Button>
            <Button
              variant="ghost"
              size="lg"
              asChild
              className="border-2 border-paper bg-transparent text-paper hover:bg-paper hover:text-ink"
            >
              <Link href={"/compare/leadsie-alternative" as Route}>Feature-by-feature comparison</Link>
            </Button>
            <Button
              variant="ghost"
              size="lg"
              asChild
              className="border-2 border-paper bg-transparent text-paper hover:bg-paper hover:text-ink"
            >
              <Link href={"/pricing" as Route}>AuthHub pricing</Link>
            </Button>
          </div>
        </section>
      </article>
    </div>
  );
}
