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
              Pricing guide · prices checked {page.lastVerifiedDisplay}
            </span>
            <h1 className="font-dela text-3xl tracking-tight text-ink sm:text-4xl md:text-[2.75rem] md:leading-[1.05]">
              {page.title}
            </h1>
            <p className="mt-6 border-2 border-black bg-[#F7FFE0] p-4 text-left font-mono text-sm leading-relaxed text-ink sm:text-base">
              <span className="font-bold uppercase tracking-wide text-coral">Answer box: </span>
              {page.answerBox}
            </p>
            <p className="mt-4 text-left font-mono text-sm leading-relaxed text-muted-foreground sm:text-base">
              {page.priceCheckNote}{" "}
              <a
                href="https://www.leadsie.com/pricing"
                className="text-coral underline-offset-2 hover:underline"
                rel="noopener noreferrer"
                target="_blank"
              >
                Leadsie pricing
              </a>{" "}
              and{" "}
              <Link href="/pricing" className="text-coral underline-offset-2 hover:underline">
                AuthHub pricing
              </Link>
              .
            </p>
            <div className="mt-8 flex flex-col justify-center gap-4 sm:flex-row sm:flex-wrap">
              <Button variant="brutalist" size="lg" asChild className="font-semibold uppercase tracking-wider">
                <Link href={"/signup" as Route}>
                  Start AuthHub 14-day free trial — no credit card
                  <ArrowRight size={18} className="ml-2" aria-hidden />
                </Link>
              </Button>
              <Button variant="secondary" size="lg" asChild className="border-2 border-black font-semibold">
                <Link href={"/compare/leadsie-alternative" as Route}>Feature compare</Link>
              </Button>
              <Button variant="ghost" size="lg" asChild className="font-semibold text-coral underline-offset-2">
                <Link href={"/blog/flat-rate-vs-credit-pricing" as Route}>
                  Flat-rate vs credit pricing
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      <article className="container mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
        <section className="mb-14">
          <h2 className="font-dela text-2xl text-ink md:text-3xl">Leadsie plans and list prices</h2>
          <p className="mt-4 font-mono text-sm leading-relaxed text-muted-foreground">
            {page.annualCreditPoolsBullets[0]}
          </p>
          <ArticleTable
            caption={
              "Sources: leadsie.com/pricing and Leadsie help center pricing article. Last checked " +
              page.lastVerifiedDisplay +
              "."
            }
          >
            <table className="w-full min-w-[720px] border-collapse font-mono text-sm">
              <thead className="border-b-2 border-black bg-gray-100">
                <tr>
                  <th scope="col" className="px-3 py-3 text-left font-bold text-ink">
                    Plan
                  </th>
                  <th scope="col" className="px-3 py-3 text-left font-bold text-ink">
                    Monthly
                  </th>
                  <th scope="col" className="px-3 py-3 text-left font-bold text-ink">
                    Yearly total
                  </th>
                  <th scope="col" className="px-3 py-3 text-left font-bold text-ink">
                    Effective / mo
                  </th>
                  <th scope="col" className="px-3 py-3 text-left font-bold text-ink">
                    New clients
                  </th>
                  <th scope="col" className="px-3 py-3 text-left font-bold text-ink">
                    Prospects (audit)
                  </th>
                  <th scope="col" className="px-3 py-3 text-left font-bold text-ink">
                    Key gates
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-300 bg-white">
                {page.plans.map((row) => (
                  <tr key={row.name}>
                    <td className="px-3 py-3 font-semibold text-ink">{row.name}</td>
                    <td className="px-3 py-3">{row.monthly}</td>
                    <td className="px-3 py-3">{row.yearlyTotal}</td>
                    <td className="px-3 py-3">{row.effectiveMonthly}</td>
                    <td className="px-3 py-3">{row.newClients}</td>
                    <td className="px-3 py-3">{row.prospects}</td>
                    <td className="px-3 py-3">{row.keyGates}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </ArticleTable>
          <p className="font-mono text-sm text-muted-foreground">{page.annualCreditPoolsBullets[1]}</p>

          <h3 className="mt-10 font-dela text-xl text-ink">Annual credit pools</h3>
          <p className="mt-3 font-mono text-sm leading-relaxed text-muted-foreground">
            {page.annualCreditPoolsIntro}
          </p>
        </section>

        <section className="mb-14">
          <h2 className="font-dela text-2xl text-ink md:text-3xl">How Leadsie credits work</h2>
          <p className="mt-4 font-mono text-sm text-muted-foreground">
            Leadsie does not bill per ad account. It bills in credits:
          </p>
          <ul className="mt-4 list-disc space-y-3 pl-5 font-mono text-sm leading-relaxed text-foreground">
            {page.creditBullets.map((bullet) => (
              <li key={bullet}>{bullet}</li>
            ))}
          </ul>
        </section>

        <section className="mb-14">
          <h2 className="font-dela text-2xl text-ink md:text-3xl">What happens when credits run out</h2>
          <p className="mt-4 font-mono text-sm leading-relaxed text-muted-foreground">{page.runOutIntro}</p>
          <ArticleTable>
            <table className="w-full border-collapse font-mono text-sm">
              <thead className="border-b-2 border-black bg-gray-100">
                <tr>
                  <th scope="col" className="px-4 py-3 text-left font-bold">
                    Plan
                  </th>
                  <th scope="col" className="px-4 py-3 text-left font-bold">
                    Pack
                  </th>
                  <th scope="col" className="px-4 py-3 text-left font-bold">
                    Extra onboard
                  </th>
                  <th scope="col" className="px-4 py-3 text-left font-bold">
                    Extra audit
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
          <h2 className="font-dela text-2xl text-ink md:text-3xl">Units difference (read before the cost table)</h2>
          <ArticleTable>
            <table className="w-full min-w-[640px] border-collapse font-mono text-sm">
              <thead className="border-b-2 border-black bg-gray-100">
                <tr>
                  <th scope="col" className="px-4 py-3 text-left font-bold">
                    {" "}
                  </th>
                  <th scope="col" className="px-4 py-3 text-left font-bold">
                    Leadsie
                  </th>
                  <th scope="col" className="px-4 py-3 text-left font-bold">
                    AuthHub
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-300 bg-white">
                {page.unitsDifferenceRows.map((row) => (
                  <tr key={row.label}>
                    <td className="px-4 py-3 font-semibold">{row.label}</td>
                    <td className="px-4 py-3">{row.leadsie}</td>
                    <td className="px-4 py-3">{row.authHub}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </ArticleTable>
          <p className="mt-4 font-mono text-sm leading-relaxed text-foreground">{page.unitsCallout}</p>
          <p className="mt-3 font-mono text-sm leading-relaxed text-muted-foreground">
            {page.authHubPricingNote}{" "}
            <Link href="/pricing" className="text-coral underline-offset-2 hover:underline">
              AuthHub pricing
            </Link>
            .
          </p>
        </section>

        <section className="mb-14">
          <h2 className="font-dela text-2xl text-ink md:text-3xl">Worked busy-month examples (matching units)</h2>
          <p className="mt-4 font-mono text-sm leading-relaxed text-muted-foreground">
            {page.workedExamplesIntro}
          </p>
          <div className="mt-8 space-y-8">
            {page.workedExamples.map((example) => (
              <div
                key={example.label}
                className="border-2 border-black bg-white p-5 shadow-brutalist-sm"
              >
                <h3 className="font-dela text-lg text-ink">
                  {example.label}) {example.scenario}
                </h3>
                <ArticleTable>
                  <table className="w-full border-collapse font-mono text-sm">
                    <thead className="border-b-2 border-black bg-gray-100">
                      <tr>
                        <th scope="col" className="px-4 py-2 text-left font-bold">
                          Vendor
                        </th>
                        <th scope="col" className="px-4 py-2 text-left font-bold">
                          Path
                        </th>
                        <th scope="col" className="px-4 py-2 text-left font-bold">
                          Cost
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-300">
                      <tr>
                        <td className="px-4 py-2 font-semibold">Leadsie</td>
                        <td className="px-4 py-2">{example.leadsiePath}</td>
                        <td className="px-4 py-2">{example.leadsieCost}</td>
                      </tr>
                      <tr>
                        <td className="px-4 py-2 font-semibold">AuthHub</td>
                        <td className="px-4 py-2">{example.authHubPlan}</td>
                        <td className="px-4 py-2 font-semibold">{example.authHubCost}</td>
                      </tr>
                    </tbody>
                  </table>
                </ArticleTable>
                <p className="font-mono text-sm text-foreground">{example.deltaNote}</p>
                {example.extraNote ? (
                  <p className="mt-2 font-mono text-sm text-muted-foreground">{example.extraNote}</p>
                ) : null}
              </div>
            ))}
          </div>
          <p className="mt-6 font-mono text-xs leading-relaxed text-muted-foreground">
            {page.workedExamplesFootnote}{" "}
            <Link
              href="/blog/flat-rate-vs-credit-pricing"
              className="text-coral underline-offset-2 hover:underline"
            >
              Flat-rate vs credit pricing
            </Link>
            .
          </p>
        </section>

        <section className="mb-14">
          <h2 className="font-dela text-2xl text-ink md:text-3xl">Stay on Leadsie if…</h2>
          <ul className="mt-4 list-disc space-y-2 pl-5 font-mono text-sm text-foreground">
            <li>
              Broader coverage than AuthHub’s 15+ — Leadsie lists{" "}
              <a
                href="https://www.leadsie.com/integrations"
                className="text-coral underline-offset-2 hover:underline"
                rel="noopener noreferrer"
                target="_blank"
              >
                31 accounts/assets
              </a>
            </li>
            <li>
              <a
                href="https://www.leadsie.com/influencer-whitelisting"
                className="text-coral underline-offset-2 hover:underline"
                rel="noopener noreferrer"
                target="_blank"
              >
                Access Detective
              </a>
              , Meta asset creation, or influencer whitelisting is core
            </li>
            {page.stayOnLeadsie.slice(2).map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
          <p className="mt-4 font-mono text-sm text-muted-foreground">Staying is a valid outcome.</p>
        </section>

        <section className="mb-14">
          <h2 className="font-dela text-2xl text-ink md:text-3xl">Switch to AuthHub (or dual-run) if…</h2>
          <ul className="mt-4 list-disc space-y-2 pl-5 font-mono text-sm text-foreground">
            {page.switchToAuthHub.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
          <p className="mt-4 font-mono text-sm text-muted-foreground">
            Features:{" "}
            <Link href="/compare/leadsie-alternative" className="text-coral underline-offset-2 hover:underline">
              AuthHub vs Leadsie
            </Link>
            . Also{" "}
            <Link
              href="/compare/clientinvite-alternative"
              className="text-coral underline-offset-2 hover:underline"
            >
              ClientInvite compare
            </Link>
            ,{" "}
            <Link
              href="/compare/leadsie-vs-agencyaccess-vs-authhub"
              className="text-coral underline-offset-2 hover:underline"
            >
              three-way compare
            </Link>
            ,{" "}
            <Link href="/features/white-label" className="text-coral underline-offset-2 hover:underline">
              white-label
            </Link>
            .
          </p>
        </section>

        <section className="mb-14">
          <h2 className="font-dela text-2xl text-ink md:text-3xl">How migration works</h2>
          <p className="mt-4 font-mono text-sm leading-relaxed text-muted-foreground">{page.migrationIntro}</p>
          <ol className="mt-4 list-decimal space-y-2 pl-5 font-mono text-sm text-foreground">
            {page.migrationSteps.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
          <p className="mt-4 font-mono text-sm text-muted-foreground">{page.migrationFootnote}</p>
        </section>

        <section className="mb-14">
          <h2 className="font-dela text-2xl text-ink md:text-3xl">Frequently asked questions</h2>
          <dl className="mt-6 space-y-6">
            {page.faqs.map((faq) => (
              <div key={faq.question} className="border-2 border-black bg-white p-5 shadow-brutalist-sm">
                <dt className="font-dela text-base text-ink">{faq.question}</dt>
                <dd className="mt-2 font-mono text-sm leading-relaxed text-muted-foreground">
                  {faq.question === "How does AuthHub compare for a busy month?" ? (
                    <>
                      {faq.answer}{" "}
                      <Link
                        href="/compare/leadsie-alternative"
                        className="text-coral underline-offset-2 hover:underline"
                      >
                        Feature compare
                      </Link>
                      . Roundup:{" "}
                      <Link
                        href="/blog/best-leadsie-alternatives-2026"
                        className="text-coral underline-offset-2 hover:underline"
                      >
                        best Leadsie alternatives 2026
                      </Link>
                      .
                    </>
                  ) : (
                    faq.answer
                  )}
                </dd>
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
              <Link href={"/compare/leadsie-alternative" as Route}>AuthHub vs Leadsie</Link>
            </Button>
            <Button
              variant="ghost"
              size="lg"
              asChild
              className="border-2 border-paper bg-transparent text-paper hover:bg-paper hover:text-ink"
            >
              <Link href={"/blog/flat-rate-vs-credit-pricing" as Route}>Flat-rate vs credit</Link>
            </Button>
            <Button
              variant="ghost"
              size="lg"
              asChild
              className="border-2 border-paper bg-transparent text-paper hover:bg-paper hover:text-ink"
            >
              <Link href={"/features/white-label" as Route}>White-label access</Link>
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
