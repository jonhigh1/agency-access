/**
 * Three-way comparison page (Leadsie vs AgencyAccess vs AuthHub)
 * Matches brutalist compare-page craft; three-column tables, no feature-card grids.
 */

"use client";

import { ArrowRight, Check, Users, Globe, X } from "lucide-react";
import Link from "next/link";
import type { Route } from "next";
import { Button } from "@/components/ui/button";
import type { ProgrammaticThreeWayComparisonPage } from "@/lib/programmatic-types";

const migrationIconMap = {
  Users,
  Globe,
  ArrowRight,
} as const;

interface ThreeWayComparisonPageTemplateProps {
  page: ProgrammaticThreeWayComparisonPage;
}

function renderCell(value: string | boolean) {
  if (typeof value === "boolean") {
    return value ? (
      <Check size={16} className="mx-auto text-success-ink" aria-label="Yes" />
    ) : (
      <X size={16} className="mx-auto text-red" aria-label="No" />
    );
  }
  return <span className="text-ink">{value}</span>;
}

export function ThreeWayComparisonPageTemplate({ page }: ThreeWayComparisonPageTemplateProps) {
  const { cta } = page;

  return (
    <div className="min-h-screen bg-paper">
      <section className="relative overflow-hidden border-b-2 border-black bg-white">
        <div className="container mx-auto px-4 py-16 sm:px-6 md:py-24 lg:px-8">
          <div className="mx-auto max-w-3xl text-center">
            <div className="mb-6 inline-flex border-2 border-black bg-white px-[14px] py-[6px] text-[10px] font-black uppercase tracking-[0.22em] text-coral shadow-[3px_3px_0_0_#000]">
              2026 three-way buyer guide
            </div>
            <h1 className="font-dela text-[1.85rem] leading-[1.05] tracking-[-0.04em] text-ink sm:text-[2.35rem] md:text-[2.55rem]">
              {page.title}
            </h1>
            <p className="mx-auto mt-6 max-w-2xl font-mono text-sm leading-relaxed text-muted-foreground md:text-base">
              {page.excerpt}
            </p>
            <div className="mt-8 flex flex-col justify-center gap-4 sm:flex-row">
              <Button variant="brutalist" size="lg" asChild className="group px-8">
                <Link href={(cta.primaryLink || "/signup") as Route}>
                  {cta.primaryButton}
                  <ArrowRight size={18} className="transition-transform group-hover:translate-x-1" />
                </Link>
              </Button>
              <Button variant="secondary" size="lg" asChild className="px-8 font-bold uppercase tracking-wider">
                <Link href={(cta.secondaryLink || "/pricing") as Route}>{cta.secondaryButton}</Link>
              </Button>
            </div>
            <nav
              aria-label="Binary compare pages"
              className="mt-6 flex flex-wrap items-center justify-center gap-x-3 gap-y-2 font-mono text-xs text-muted-foreground sm:text-sm"
            >
              {page.heroLinks.map((link, index) => (
                <span key={link.href} className="inline-flex items-center gap-3">
                  {index > 0 && <span aria-hidden="true">·</span>}
                  <Link href={link.href as Route} className="font-semibold text-coral underline-offset-2 hover:underline">
                    {link.label}
                  </Link>
                </span>
              ))}
            </nav>
          </div>
        </div>
      </section>

      <section className="border-b-2 border-black bg-card">
        <div className="container mx-auto px-4 py-12 sm:px-6 lg:px-8">
          <h2 className="font-dela text-center text-2xl text-ink md:text-3xl">
            Shared job: one-link client OAuth / access for agencies
          </h2>
          <div className="mx-auto mt-6 max-w-3xl space-y-4 font-mono text-sm leading-relaxed text-muted-foreground">
            <p>{page.sharedJobLead}</p>
            <p>{page.sharedJobFollow}</p>
          </div>
        </div>
      </section>

      <section className="border-b-2 border-black bg-ink text-white">
        <div className="container mx-auto px-4 py-12 sm:px-6 lg:px-8">
          <h2 className="font-dela text-center text-xl md:text-2xl">Decision frame: five axes</h2>
          <ol className="mx-auto mt-8 grid max-w-4xl gap-4 md:grid-cols-2 lg:grid-cols-3">
            {page.decisionAxes.map((axis, index) => (
              <li
                key={axis.title}
                className="border-2 border-white/20 bg-white/5 p-4 text-left"
              >
                <p className="font-dela text-sm text-danger-ink">
                  {index + 1}. {axis.title}
                </p>
                <p className="mt-2 font-mono text-xs leading-relaxed text-white/85">{axis.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {page.aeoSections.length > 0 && (
        <section className="border-b-2 border-black bg-paper">
          <div className="container mx-auto space-y-6 px-4 py-10 sm:px-6 lg:px-8">
            {page.aeoSections.map((section) => (
              <article
                key={section.headline}
                className="mx-auto max-w-3xl border-2 border-black bg-white p-5 shadow-brutalist-sm"
              >
                <h3 className="font-dela text-lg text-ink">{section.headline}</h3>
                <p className="mt-3 font-mono text-sm leading-relaxed text-muted-foreground">{section.body}</p>
              </article>
            ))}
          </div>
        </section>
      )}

      <section id="comparison" className="scroll-mt-24 border-b-2 border-black bg-[#F8FAFC]">
        <div className="container mx-auto px-4 py-12 sm:px-6 lg:px-8">
          <h2 className="font-dela text-center text-2xl text-ink md:text-3xl">Side-by-side comparison</h2>
          <div className="mx-auto mt-10 max-w-5xl space-y-10">
            {page.tableCategories.map((category) => (
              <div key={category.category}>
                <h3 className="font-dela mb-3 border-l-4 border-coral pl-4 text-lg text-ink">
                  {category.category}
                </h3>
                {category.intro && (
                  <p className="mb-4 font-mono text-xs leading-relaxed text-muted-foreground">{category.intro}</p>
                )}
                <div className="overflow-x-auto border-2 border-black bg-white shadow-[4px_4px_0_0_#000]">
                  <table className="w-full min-w-[640px] border-collapse font-mono text-xs sm:text-sm">
                    <thead className="border-b-2 border-black bg-gray-100">
                      <tr>
                        <th scope="col" className="px-3 py-3 text-left font-bold">
                          Feature
                        </th>
                        <th scope="col" className="px-3 py-3 text-left font-bold">
                          Leadsie
                        </th>
                        <th scope="col" className="px-3 py-3 text-left font-bold">
                          AgencyAccess
                        </th>
                        <th scope="col" className="px-3 py-3 text-left font-bold">
                          AuthHub
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-300">
                      {category.rows.map((row) => (
                        <tr key={row.feature}>
                          <th scope="row" className="px-3 py-3 text-left font-semibold text-ink">
                            {row.feature}
                          </th>
                          <td className="px-3 py-3 text-muted-foreground">{renderCell(row.leadsie)}</td>
                          <td className="px-3 py-3 text-muted-foreground">{renderCell(row.agencyAccess)}</td>
                          <td className="px-3 py-3 font-medium text-ink">{renderCell(row.authhub)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
          <p className="mx-auto mt-8 max-w-3xl font-mono text-[11px] font-semibold text-muted-foreground">
            {page.pricingSourcesNote}
          </p>
        </div>
      </section>

      <section className="border-b-2 border-black bg-white">
        <div className="container mx-auto px-4 py-12 sm:px-6 lg:px-8">
          <h2 className="font-dela text-center text-2xl text-ink md:text-3xl">Cost math (worked examples)</h2>
          <p className="mx-auto mt-4 max-w-2xl text-center font-mono text-xs text-muted-foreground">
            Monthly list prices primary. Arithmetic shown—no invented savings headlines.
          </p>
          <div className="mx-auto mt-10 max-w-4xl space-y-10">
            {page.costScenarios.map((scenario) => (
              <div key={scenario.headline}>
                <h3 className="font-dela text-lg text-ink">{scenario.headline}</h3>
                <div className="mt-4 overflow-x-auto border-2 border-black shadow-[4px_4px_0_0_#000]">
                  <table className="w-full min-w-[520px] border-collapse bg-white font-mono text-xs">
                    <thead className="border-b-2 border-black bg-gray-100">
                      <tr>
                        <th scope="col" className="px-3 py-2 text-left font-bold">
                          Vendor
                        </th>
                        <th scope="col" className="px-3 py-2 text-left font-bold">
                          Plan
                        </th>
                        <th scope="col" className="px-3 py-2 text-left font-bold">
                          Monthly
                        </th>
                        <th scope="col" className="px-3 py-2 text-left font-bold">
                          Cap / credit fit
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-300">
                      {scenario.rows.map((row) => (
                        <tr key={`${scenario.headline}-${row.vendor}-${row.plan}`}>
                          <td className="px-3 py-2 font-semibold">{row.vendor}</td>
                          <td className="px-3 py-2">{row.plan}</td>
                          <td className="px-3 py-2">{row.monthly}</td>
                          <td className="px-3 py-2">{row.capFit}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="mt-3 font-mono text-[11px] leading-relaxed text-muted-foreground">
                  <span className="font-semibold text-ink">Deltas: </span>
                  {scenario.deltas}
                </p>
              </div>
            ))}
          </div>
          <p className="mx-auto mt-8 max-w-3xl font-mono text-xs leading-relaxed text-muted-foreground">
            {page.costMathClosing}{" "}
            <Link href="/pricing" className="font-semibold text-coral hover:underline">
              /pricing
            </Link>
            {" · "}
            <Link href="/compare/leadsie-pricing" className="font-semibold text-coral hover:underline">
              /compare/leadsie-pricing
            </Link>
            {" · "}
            <Link href="/blog/flat-rate-vs-credit-pricing" className="font-semibold text-coral hover:underline">
              /blog/flat-rate-vs-credit-pricing
            </Link>
          </p>
        </div>
      </section>

      <section className="border-b-2 border-black bg-card">
        <div className="container mx-auto px-4 py-12 sm:px-6 lg:px-8">
          <div className="mx-auto grid max-w-5xl gap-6 md:grid-cols-3">
            {page.pickSections.map((section) => (
              <article
                key={section.vendor}
                className="border-2 border-black bg-white p-5 shadow-brutalist-sm"
              >
                <h3 className="font-dela text-lg text-ink">Pick {section.vendor} if…</h3>
                <ul className="mt-4 space-y-2 font-mono text-xs leading-relaxed text-foreground">
                  {section.bullets.map((item) => (
                    <li key={item}>• {item}</li>
                  ))}
                </ul>
                <p className="mt-4 font-mono text-xs font-semibold text-muted-foreground">{section.closing}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="border-b-2 border-black bg-paper">
        <div className="container mx-auto px-4 py-12 sm:px-6 lg:px-8">
          <h2 className="font-dela text-center text-2xl text-ink">How to switch or dual-run</h2>
          <p className="mx-auto mt-4 max-w-2xl text-center font-mono text-sm text-muted-foreground">
            No SaaS ports existing platform permissions. Grants live in Meta, Google, LinkedIn, TikTok, and the other
            platforms.
          </p>
          <ol className="mx-auto mt-8 grid max-w-3xl gap-6">
            {page.migrationSteps.map((step) => {
              const Icon = migrationIconMap[step.icon as keyof typeof migrationIconMap] ?? ArrowRight;
              return (
                <li key={step.step} className="flex gap-4 border-2 border-black bg-white p-5 shadow-brutalist-sm">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center border-2 border-black bg-destructive/10">
                    <Icon size={20} className="text-destructive" aria-hidden="true" />
                  </div>
                  <div>
                    <p className="font-dela text-ink">
                      {step.step}. {step.title}
                    </p>
                    <p className="mt-2 font-mono text-sm text-muted-foreground">{step.description}</p>
                  </div>
                </li>
              );
            })}
          </ol>
        </div>
      </section>

      {page.faqs.length > 0 && (
        <section className="border-b-2 border-black bg-white">
          <div className="container mx-auto px-4 py-12 sm:px-6 lg:px-8">
            <h2 className="font-dela mb-8 text-center text-2xl text-ink">Frequently asked questions</h2>
            <div className="mx-auto max-w-3xl space-y-4">
              {page.faqs.map((faq) => (
                <details
                  key={faq.question}
                  className="group border-2 border-black bg-paper p-4 shadow-brutalist-sm"
                >
                  <summary className="cursor-pointer list-none font-dela text-base text-ink marker:content-none [&::-webkit-details-marker]:hidden">
                    {faq.question}
                  </summary>
                  <p className="mt-3 font-mono text-sm leading-relaxed text-muted-foreground">{faq.answer}</p>
                </details>
              ))}
            </div>
          </div>
        </section>
      )}

      <section className="border-t-2 border-black bg-ink py-16 text-white">
        <div className="container mx-auto px-4 text-center sm:px-6 lg:px-8">
          <h2 className="font-dela text-2xl md:text-3xl">{cta.headline}</h2>
          <p className="mx-auto mb-8 mt-4 max-w-xl font-mono text-sm text-white/80">{cta.subheadline}</p>
          <div className="flex flex-col justify-center gap-4 sm:flex-row">
            <Button variant="primary" size="lg" asChild className="border-white font-bold uppercase tracking-wider">
              <Link href={(cta.primaryLink ?? "/signup") as Route}>{cta.primaryButton}</Link>
            </Button>
            {cta.secondaryButton && (
              <Link
                href={(cta.secondaryLink ?? "/pricing") as Route}
                className="inline-flex items-center justify-center gap-2 border-2 border-white px-8 py-4 font-bold uppercase tracking-wider text-white transition-all hover:bg-white hover:text-ink"
              >
                {cta.secondaryButton}
              </Link>
            )}
          </div>
          <nav
            aria-label="Related compare and guide links"
            className="mt-8 flex flex-col gap-2 font-mono text-sm text-white/80 sm:flex-row sm:flex-wrap sm:justify-center sm:gap-x-4"
          >
            <Link href="/compare/leadsie-alternative" className="hover:text-white hover:underline">
              AuthHub vs Leadsie
            </Link>
            <Link href="/compare/leadsie-pricing" className="hover:text-white hover:underline">
              Leadsie pricing deep-dive
            </Link>
            <Link href="/compare/agencyaccess-alternative" className="hover:text-white hover:underline">
              AuthHub vs AgencyAccess
            </Link>
            <Link href="/blog/best-client-onboarding-software-agencies-2026" className="hover:text-white hover:underline">
              Best client onboarding software (2026)
            </Link>
            <Link href="/blog/oauth-token-management-agencies" className="hover:text-white hover:underline">
              OAuth token management for agencies
            </Link>
          </nav>
          {cta.guarantee && (
            <p className="mt-6 font-mono text-xs text-white/60">{cta.guarantee}</p>
          )}
        </div>
      </section>
    </div>
  );
}

export default ThreeWayComparisonPageTemplate;
