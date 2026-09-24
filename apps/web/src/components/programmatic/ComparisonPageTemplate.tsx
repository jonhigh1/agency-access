/**
 * Programmatic Comparison Page Template
 * AIDA/PAS framework-based comparison page component for SEO and conversions
 * Designed for programmatic generation with data-driven content
 */

"use client";

import { Check, X, ArrowRight, Clock, DollarSign, Globe, Zap, Shield, Users } from "lucide-react";
import Link from "next/link";
import type { Route } from "next";
import { SUPPORTED_PLATFORM_COUNT } from "@agency-platform/shared";
import { Button } from "@/components/ui/button";
import type { ProgrammaticComparisonPage } from "@/lib/programmatic-types";

// Icon mapping for dynamic icon rendering
const iconMap: Record<string, React.ComponentType<{ size?: number; className?: string }>> = {
  Clock,
  DollarSign,
  Globe,
  Zap,
  Shield,
  Users,
  ArrowRight,
};

interface ComparisonPageTemplateProps {
  page: ProgrammaticComparisonPage;
}

function AgencyAccessPricingSection({ page }: ComparisonPageTemplateProps) {
  const {
    competitor,
    ourProduct,
    competitorPricingSubtitle,
    authhubSavingsHighlight,
    valueCallout,
    pricingScenarios,
    pricingScenariosNote,
    cta,
  } = page;

  const authHubTiers = [
    { name: "Starter", data: ourProduct.pricing.starter },
    { name: "Growth", data: ourProduct.pricing.pro },
    { name: "Scale", data: ourProduct.pricing.enterprise },
  ];

  const agencyTiers = [
    { name: "Starter", data: competitor.pricing.starter },
    { name: "Premium", data: competitor.pricing.pro },
    { name: "Agency", data: competitor.pricing.enterprise },
  ];

  return (
    <section
      id="comparison"
      className="scroll-mt-24 border-y border-black/10 bg-[#F8FAFC] px-4 py-[46px] sm:px-6 lg:px-8 lg:py-[54px]"
    >
      <div className="mx-auto max-w-[920px]">
        <div className="mb-9 text-center lg:mb-10">
          <div className="mb-5 inline-flex items-center justify-center border-2 border-black bg-white px-[14px] py-[6px] text-[10px] font-black uppercase tracking-[0.22em] text-[#EA7A49] shadow-[3px_3px_0_0_#000]">
            Pricing & limits
          </div>
          <h2 className="font-dela text-[2.2rem] leading-[0.96] tracking-[-0.045em] text-[#10162F] sm:text-[2.55rem]">
            Cost math (worked examples)
          </h2>
          <p className="mx-auto mt-5 max-w-[620px] font-mono text-[13px] font-medium leading-[1.45] tracking-[0.02em] text-[#7B8492] sm:text-[14px]">
            Monthly list prices primary. AuthHub sells active clients; AgencyAccess sells
            clients per month. Annual footnotes: AuthHub ~$24 / $66 / $124; AgencyAccess
            $33 / $74 / $149 on their pricing page.
          </p>
          {competitorPricingSubtitle && (
            <p className="mx-auto mt-3 max-w-[620px] font-mono text-xs font-semibold text-[#596276]">
              AgencyAccess: {competitorPricingSubtitle}
            </p>
          )}
        </div>

        <div className="grid gap-5 md:grid-cols-2">
          <article className="relative border-2 border-black bg-[#EDF6F7] px-[24px] pb-[22px] pt-[24px] shadow-[4px_4px_0_0_#000]">
            <h3 className="font-dela text-[1.32rem] leading-none tracking-[-0.04em] text-[#151E35]">
              AuthHub (monthly list)
            </h3>
            <ul className="mt-5 space-y-4">
              {authHubTiers.map((tier) => (
                <li key={tier.name} className="border-b border-black/10 pb-3 last:border-0">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="font-sans text-sm font-black uppercase tracking-wide text-[#151E35]">
                      {tier.name}
                    </span>
                    <span className="font-dela text-2xl text-[#45B3A8]">
                      ${tier.data?.price}
                      <span className="font-mono text-xs font-medium text-[#717A89]">/mo</span>
                    </span>
                  </div>
                  {tier.data?.features.slice(0, 3).map((feature) => (
                    <p key={feature} className="mt-1 font-mono text-[11px] text-[#626A78]">
                      {feature}
                    </p>
                  ))}
                </li>
              ))}
            </ul>
            {authhubSavingsHighlight && (
              <p className="mt-4 font-mono text-[11px] font-semibold leading-snug text-[#45B3A8]">
                {authhubSavingsHighlight}
              </p>
            )}
            <Button
              variant="primary"
              size="sm"
              asChild
              className="mt-4 w-full font-sans text-[11px] font-black uppercase tracking-[0.06em]"
            >
              <Link href={(cta.primaryLink || "/signup") as Route}>Start Free Trial</Link>
            </Button>
          </article>

          <article className="border-2 border-black bg-white px-[24px] pb-[22px] pt-[24px] shadow-[4px_4px_0_0_#000]">
            <h3 className="font-dela text-[1.32rem] leading-none tracking-[-0.04em] text-[#151E35]">
              AgencyAccess (monthly list)
            </h3>
            <ul className="mt-5 space-y-4">
              {agencyTiers.map((tier) => (
                <li key={tier.name} className="border-b border-black/10 pb-3 last:border-0">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="font-sans text-sm font-black uppercase tracking-wide text-[#151E35]">
                      {tier.name}
                    </span>
                    <span className="font-dela text-2xl text-[#596276]">
                      ${tier.data?.price}
                      <span className="font-mono text-xs font-medium text-[#717A89]">/mo</span>
                    </span>
                  </div>
                  {tier.data?.features.slice(0, 2).map((feature) => (
                    <p key={feature} className="mt-1 font-mono text-[11px] text-[#687180]">
                      {feature}
                    </p>
                  ))}
                </li>
              ))}
            </ul>
          </article>
        </div>

        {valueCallout && (
          <div className="mt-8 border-2 border-black bg-white px-4 py-4 shadow-[4px_4px_0_0_#000] sm:px-5">
            <h3 className="font-dela text-base text-[#151E35]">{valueCallout.headline}</h3>
            <p className="mt-2 font-mono text-xs leading-relaxed text-[#626A78]">{valueCallout.body}</p>
          </div>
        )}

        {pricingScenarios && pricingScenarios.length > 0 && (
          <div className="mt-8 overflow-x-auto border-2 border-black bg-white shadow-[4px_4px_0_0_#000]">
            <table className="w-full border-collapse text-sm">
              <thead className="border-b-2 border-black bg-gray-100">
                <tr>
                  <th scope="col" className="px-4 py-3 text-left font-bold">
                    Volume
                  </th>
                  <th scope="col" className="px-4 py-3 text-left font-bold">
                    AgencyAccess plan
                  </th>
                  <th scope="col" className="px-4 py-3 text-left font-bold">
                    AA monthly
                  </th>
                  <th scope="col" className="px-4 py-3 text-left font-bold">
                    AuthHub plan
                  </th>
                  <th scope="col" className="px-4 py-3 text-left font-bold">
                    AuthHub monthly
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-300 font-mono text-xs">
                {pricingScenarios.map((scenario) => (
                  <tr key={scenario.clients}>
                    <td className="px-4 py-3 font-semibold">{scenario.clients} clients/mo</td>
                    <td className="px-4 py-3">{scenario.competitorPlan}</td>
                    <td className="px-4 py-3">{scenario.competitorCost}</td>
                    <td className="px-4 py-3">{scenario.authHubPlan}</td>
                    <td className="px-4 py-3 font-semibold">{scenario.authHubCost}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {pricingScenariosNote && (
              <p className="border-t border-black/10 px-4 py-3 font-mono text-[11px] text-[#7B8492]">
                {pricingScenariosNote}
              </p>
            )}
          </div>
        )}

        <p className="mt-6 text-center font-mono text-xs text-[#7B8492]">
          Also comparing Leadsie?{" "}
          <Link href={"/compare/leadsie-alternative" as Route} className="font-semibold text-coral underline-offset-2 hover:underline">
            AuthHub vs Leadsie
          </Link>
          {" · "}
          <Link href={"/compare/leadsie-pricing" as Route} className="font-semibold text-coral underline-offset-2 hover:underline">
            Leadsie pricing deep-dive
          </Link>
        </p>
      </div>
    </section>
  );
}

/**
 * Main comparison page template component
 * Renders the full comparison page with all sections
 */
export function ComparisonPageTemplate({ page }: ComparisonPageTemplateProps) {
  const isAgencyAccessPage = page.id === "agencyaccess-alternative";
  const {
    competitor,
    ourProduct,
    cta,
    testimonials,
    painPoints,
    quickComparison,
    detailedComparison,
    recommendations,
    migrationSteps,
    pricingComparison,
    faqs,
    valueCallout,
    competitorPricingSubtitle,
    authhubSavingsHighlight,
    pricingScenarios,
    pricingScenariosNote,
  } = page;

  return (
    <div className="min-h-screen bg-paper">
      {/* Hero Section - AIDA: Attention */}
      <section className="relative overflow-hidden bg-white">
        {/* Three-column background frame - very subtle */}
        <div className="absolute inset-0 flex pointer-events-none">
          <div className="w-[15%] bg-[#FFF5F5]" />
          <div className="flex-1 bg-white" />
          <div className="w-[15%] bg-[#F5F8FA]" />
        </div>

        {/* Content */}
        <div className="relative container mx-auto px-4 sm:px-6 lg:px-8 py-20 md:py-28">
          <div className="max-w-3xl mx-auto text-center">
            {/* Year badge - white bg, orange text, black border */}
            <div className="mb-8">
              <span className="inline-block px-5 py-2.5 text-sm font-bold uppercase tracking-wider text-[#FF6B35] bg-white border-2 border-black">
                2026 COMPARISON GUIDE
              </span>
            </div>

            {/* Headline */}
            {isAgencyAccessPage ? (
              <h1 className="text-3xl sm:text-4xl md:text-[2.65rem] font-bold tracking-tight mb-8 leading-tight text-[#1A1A1A]">
                {page.title}
              </h1>
            ) : (
              <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold tracking-tight mb-8">
                <span className="text-[#1A1A1A]">{ourProduct.name}</span>{" "}
                <span className="text-[#4ECDC4] font-normal">vs</span>{" "}
                <span className="text-[#4A4A4A]">{competitor.name}</span>
              </h1>
            )}

            {/* Body text */}
            <p className="text-lg md:text-xl text-[#6B7280] mb-10 max-w-2xl mx-auto leading-relaxed">
              {page.excerpt}
            </p>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row gap-4 justify-center mb-10">
              <Button
                variant="brutalist"
                size="lg"
                asChild
                className="group px-10"
              >
                <Link href={(cta.primaryLink || "/signup") as Route}>
                  {cta.primaryButton || "Start Free Trial"}
                  <ArrowRight size={18} className="transition-transform group-hover:translate-x-1" />
                </Link>
              </Button>
              <Button
                variant="secondary"
                size="lg"
                asChild
                className="px-10 font-bold uppercase tracking-wider"
              >
                <Link href={(cta.secondaryLink || "/pricing") as Route}>
                  {cta.secondaryButton || "Schedule Demo"}
                </Link>
              </Button>
            </div>

            {isAgencyAccessPage && (
              <p className="mb-8 font-mono text-sm text-[#6B7280]">
                Also comparing Leadsie?{" "}
                <Link href={"/compare/leadsie-alternative" as Route} className="font-semibold text-coral underline-offset-2 hover:underline">
                  AuthHub vs Leadsie
                </Link>
                {" · "}
                <Link href={"/compare/leadsie-pricing" as Route} className="font-semibold text-coral underline-offset-2 hover:underline">
                  Leadsie pricing deep-dive
                </Link>
              </p>
            )}

            {/* Trust badges with orange checkmarks */}
            <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-2 text-sm font-semibold uppercase tracking-wider text-[#6B7280]">
              <span className="inline-flex items-center gap-2">
                <Check size={16} className="text-[#FF6B35]" strokeWidth={3} />
                14-Day Free Trial
              </span>
              <span className="inline-flex items-center gap-2">
                <Check size={16} className="text-[#FF6B35]" strokeWidth={3} />
                No Credit Card
              </span>
              <span className="inline-flex items-center gap-2">
                <Check size={16} className="text-[#FF6B35]" strokeWidth={3} />
                Cancel Anytime
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* TL;DR Summary - AIDA: Interest */}
      <section className="border-b-2 border-black bg-ink text-white">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-10">
          <div className="max-w-4xl mx-auto">
            <h2 className="font-dela text-xl md:text-2xl mb-4 text-center">
              {isAgencyAccessPage
                ? "Where AuthHub and AgencyAccess diverge"
                : `Why Agencies Switch to ${ourProduct.name}`}
            </h2>
            <div className="grid md:grid-cols-3 gap-6 text-center">
              {ourProduct.differentiators.slice(0, 3).map((diff, i) => (
                <div key={i} className="p-4">
                  <div className="text-danger-ink font-bold text-lg mb-2">{diff}</div>
                  <p className="font-mono text-sm text-white/80">
                    {getDifferentiatorDescription(diff)}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Why Agencies Look for Alternatives - PAS Formula */}
      <section className="border-b-2 border-black bg-card">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <h2 className="font-dela text-2xl md:text-3xl text-ink mb-4 text-center">
            {isAgencyAccessPage
              ? "Shared job: one-link client access for agencies"
              : `Why Agencies Look for ${competitor.name} Alternatives`}
          </h2>
          <p className="font-mono text-muted-foreground text-center mb-12 max-w-2xl mx-auto">
            {isAgencyAccessPage
              ? "Both solve access onboarding with official OAuth behind one client link. Decide on token expiry, vaulting and audit, automation hooks, and how plan caps hit a busy month. Intake is not a monopoly—both include it."
              : `Growing agencies hit these walls with ${competitor.name}. Sound familiar?`}
          </p>

          <div className="grid md:grid-cols-2 gap-6 max-w-4xl mx-auto">
            {painPoints.map((pain, index) => {
              const IconComponent = iconMap[pain.icon] || ArrowRight;
              return (
                <div key={index} className="border-2 border-black p-6 rounded-none shadow-brutalist-sm">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 bg-destructive/10 border-2 border-black rounded-none flex items-center justify-center">
                      <IconComponent size={20} className="text-destructive" />
                    </div>
                    <h3 className="font-dela text-lg text-ink">{pain.title}</h3>
                  </div>
                  <p className="font-mono text-sm text-foreground mb-3">
                    <em>&ldquo;{pain.quote}&rdquo;</em>
                  </p>
                  <p className="font-mono text-sm text-muted-foreground">
                    {pain.description}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Pricing Comparison - AIDA: Interest */}
      {isAgencyAccessPage ? (
        <AgencyAccessPricingSection page={page} />
      ) : (
        <section id="comparison" className="py-16 bg-white">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8">
            {/* Section Header */}
            <div className="text-center mb-12">
              <p className="text-xs font-bold uppercase tracking-wider text-[#4ECDC4] mb-3">
                Leadsie Pricing
              </p>
              <h2 className="text-3xl md:text-4xl font-bold text-[#1A1A1A]">
                Leadsie pricing explained
              </h2>
            </div>

            {/* Pricing Cards */}
            <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
              {/* Competitor Card */}
              <div className="bg-white border border-[#E5E7EB] rounded-xl p-8 shadow-[0_4px_6px_rgba(0,0,0,0.1)]">
                {/* Plan Name */}
                <h3 className="text-xl font-bold text-[#1A365D] mb-4">
                  {competitor.name}
                </h3>

                {/* Price */}
                <div className="mb-6">
                  <p className="text-4xl font-bold text-[#1A365D]">
                    ${competitor.pricing.starting}
                    <span className="text-lg font-normal text-[#6B7280]">/month</span>
                  </p>
                  {competitorPricingSubtitle && (
                    <p className="text-sm text-[#6B7280] mt-1">
                      {competitorPricingSubtitle}
                    </p>
                  )}
                  {competitor.pricing.billing === "yearly" && (
                    <p className="text-sm text-[#6B7280] mt-1">
                      Billed yearly
                    </p>
                  )}
                </div>

                {/* Features */}
                <ul className="space-y-3 mb-8">
                  {quickComparison.slice(0, 5).map((row, i) => (
                    <li key={i} className="flex items-center gap-3 text-sm text-[#4A5568]">
                      {typeof row.competitor === "boolean" ? (
                        row.competitor ? (
                          <Check size={16} className="text-[#4ECDC4] flex-shrink-0" strokeWidth={3} />
                        ) : (
                          <X size={16} className="text-[#EF4444] flex-shrink-0" strokeWidth={3} />
                        )
                      ) : (
                          <span className="w-24 shrink-0 text-right font-semibold text-[#6B7280]">
                            {row.competitor}
                          </span>
                      )}
                      <span>{row.feature}</span>
                    </li>
                  ))}
                </ul>

                {/* CTA */}
                <Button
                  variant="secondary"
                  size="md"
                  asChild
                  className="w-full font-semibold uppercase tracking-wider"
                >
                  <Link href={(cta.secondaryLink || "/pricing") as Route}>
                    CHOOSE PLAN
                  </Link>
                </Button>
              </div>

              {/* AuthHub Card - Featured */}
              <div className="bg-white border border-[#E5E7EB] rounded-xl p-8 shadow-[0_4px_6px_rgba(0,0,0,0.1)] relative">
                {/* Best Value Badge */}
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-[#F59E0B] text-white px-4 py-1 text-xs font-bold uppercase tracking-wider rounded">
                  BEST VALUE
                </div>

                {/* Plan Name */}
                <h3 className="text-xl font-bold text-[#1A365D] mb-4">
                  {ourProduct.name}
                </h3>

                {/* Price */}
                <div className="mb-6">
                  <p className="text-4xl font-bold text-[#1A365D]">
                    ${ourProduct.pricing.starting}
                    <span className="text-lg font-normal text-[#6B7280]">/month</span>
                  </p>
                  <p className="text-sm text-[#6B7280] mt-1">
                    From $29/mo · 5/20/50 clients by tier
                  </p>
                  {authhubSavingsHighlight && (
                    <p className="text-sm font-semibold text-[#4ECDC4] mt-2">
                      {authhubSavingsHighlight}
                    </p>
                  )}
                  {!authhubSavingsHighlight && pricingComparison.savings.yearly > 0 && (
                    <p className="text-sm font-semibold text-[#4ECDC4] mt-2">
                      Save ${pricingComparison.savings.yearly}/year
                    </p>
                  )}
                </div>

                {/* Features */}
                <ul className="space-y-3 mb-8">
                  {quickComparison.slice(0, 5).map((row, i) => (
                    <li key={i} className="flex items-center gap-3 text-sm text-[#4A5568]">
                      {typeof row.authhub === "boolean" ? (
                        row.authhub ? (
                          <Check size={16} className="text-[#FF6B35] flex-shrink-0" strokeWidth={3} />
                        ) : (
                          <X size={16} className="text-[#EF4444] flex-shrink-0" strokeWidth={3} />
                        )
                      ) : (
                          <span className="w-24 shrink-0 text-right font-semibold text-[#4A5568]">
                            {row.authhub}
                          </span>
                      )}
                      <span className={row.isExclusive ? "font-semibold" : ""}>{row.feature}</span>
                      {row.isExclusive && (
                        <span className="text-xs font-semibold text-[#FF6B35]">(Exclusive)</span>
                      )}
                    </li>
                  ))}
                </ul>

                {/* CTA */}
                <Button
                  variant="primary"
                  size="md"
                  asChild
                  className="group w-full font-semibold uppercase tracking-wider"
                >
                  <Link href={(cta.primaryLink || "/signup") as Route}>
                    START FREE TRIAL
                    <ArrowRight size={16} className="transition-transform group-hover:translate-x-1" />
                  </Link>
                </Button>
              </div>
            </div>

            {valueCallout && (
              <div className="max-w-4xl mx-auto mt-12 p-6 bg-[#FFFBEB] border border-[#FCD34D] rounded-xl">
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0 w-10 h-10 bg-[#FF6B35] rounded-full flex items-center justify-center">
                    <DollarSign size={20} className="text-white" />
                  </div>
                  <div>
                    <h4 className="font-bold text-[#1A365D] mb-2">
                      {valueCallout.headline}
                    </h4>
                    <p className="text-sm text-[#4A5568]">
                      {valueCallout.body}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {pricingScenarios && pricingScenarios.length > 0 && (
              <div className="mx-auto mt-8 max-w-4xl">
                <div className="overflow-x-auto border-2 border-black">
                  <table className="w-full border-collapse text-sm">
                    <thead className="border-b-2 border-black bg-gray-100">
                      <tr>
                        <th scope="col" className="px-4 py-3 text-left font-bold">
                          Clients in one month
                        </th>
                        <th scope="col" className="px-4 py-3 text-left font-bold">
                          Lowest published Leadsie option
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
                    <tbody className="divide-y divide-gray-300">
                      {pricingScenarios.map((scenario) => (
                        <tr key={scenario.clients}>
                          <td className="px-4 py-3 font-semibold">{scenario.clients}</td>
                          <td className="px-4 py-3">{scenario.competitorPlan}</td>
                          <td className="px-4 py-3">{scenario.competitorCost}</td>
                          <td className="px-4 py-3">{scenario.authHubPlan}</td>
                          <td className="px-4 py-3 font-semibold">{scenario.authHubCost}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {pricingScenariosNote && (
                  <p className="mt-3 text-xs text-[#6B7280]">{pricingScenariosNote}</p>
                )}
                {page.slug === "leadsie-alternative" && (
                  <p className="mt-4 font-mono text-sm font-semibold">
                    <Link
                      href={"/compare/leadsie-pricing" as Route}
                      className="text-coral underline-offset-2 hover:underline"
                    >
                      Full Leadsie pricing breakdown →
                    </Link>
                  </p>
                )}
              </div>
            )}
          </div>
        </section>
      )}

      {/* Feature-by-Feature Comparison */}
      {detailedComparison.length > 0 && (
        <section className="border-b-2 border-black bg-card">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-12">
            <h2 className="font-dela text-2xl md:text-3xl text-ink mb-8 text-center">
              {isAgencyAccessPage ? "Feature comparison" : "Feature-by-Feature Comparison"}
            </h2>
            <div className="max-w-4xl mx-auto overflow-x-auto">
              {detailedComparison.map((category, catIndex) => (
                <div key={catIndex} className="mb-8">
                  <h3 className="font-dela text-lg text-ink mb-4 border-l-4 border-coral pl-4">
                    {category.category}
                  </h3>
                  <table className="w-full border-2 border-black text-sm font-mono table-fixed">
                    <thead>
                      <tr className="bg-gray-100 border-b-2 border-black">
                        <th className="w-1/3 px-4 py-3 text-left font-bold text-ink border-r border-black">Feature</th>
                        <th className="w-1/3 px-4 py-3 text-center font-bold text-ink border-r border-black">{competitor.name}</th>
                        <th className="w-1/3 px-4 py-3 text-center font-bold text-ink">{ourProduct.name}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y border-black">
                      {category.features.map((feature, featIndex) => (
                        <tr key={featIndex} className="border-b border-gray-300">
                          <td className="px-4 py-3 text-ink border-r border-gray-300">{feature.name}</td>
                          <td className="px-4 py-3 text-center border-r border-gray-300">
                            {typeof feature.competitor === "boolean" ? (
                              feature.competitor ? (
                                <Check size={16} className="text-success-ink mx-auto" />
                              ) : (
                                <X size={16} className="text-red mx-auto" />
                              )
                            ) : (
                              feature.competitor
                            )}
                          </td>
                          <td className="px-4 py-3 text-center">
                            {typeof feature.authhub === "boolean" ? (
                              feature.authhub ? (
                                <Check size={16} className="text-success-ink mx-auto" />
                              ) : (
                                <X size={16} className="text-red mx-auto" />
                              )
                            ) : (
                              <span className="font-bold">{feature.authhub}</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Who Should Switch (and Who Shouldn't) */}
      <section className="border-b-2 border-black bg-card">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <h2 className="font-dela text-2xl md:text-3xl text-ink mb-12 text-center">
            {isAgencyAccessPage
              ? "Who should stay — and who should switch"
              : "Who Should Switch (and Who Shouldn\u2019t)"}
          </h2>
          <div className="grid md:grid-cols-2 gap-6 max-w-4xl mx-auto">
            {/* Stick with competitor */}
            <div className="border-2 border-black p-6 rounded-none shadow-brutalist-sm">
              <h3 className="font-dela text-xl text-ink mb-4">
                {isAgencyAccessPage ? `Stick with ${competitor.name} if…` : `Stick with ${competitor.name} If`}
              </h3>
              <ul className="space-y-2 font-mono text-sm text-foreground">
                {recommendations.stickWithCompetitor.map((item, i) => (
                  <li key={i}>• {item}</li>
                ))}
              </ul>
            </div>

            {/* Switch to AuthHub */}
            <div className="border-[3px] border-coral p-6 rounded-none shadow-brutalist-lg bg-coral/5">
              <h3 className="font-dela text-xl text-danger-ink mb-4">
                Switch to {ourProduct.name} If
              </h3>
              <ul className="space-y-2 font-mono text-sm text-foreground">
                {recommendations.switchToAuthHub.map((item, i) => (
                  <li key={i}>• {item}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Migration Steps */}
      {migrationSteps.length > 0 && (
        <section className="border-b-2 border-ink bg-teal/10">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-16 md:py-20">
            <div className="max-w-4xl mx-auto text-center">
              <h2 className="font-dela text-3xl md:text-4xl text-ink mb-4">
                {isAgencyAccessPage ? "How migration works" : `Switch from ${competitor.name}`}
              </h2>
              <p className="font-mono text-muted-foreground mb-12">
                {isAgencyAccessPage
                  ? "Neither SaaS moves existing platform permissions. Canceling AgencyAccess does not revoke grants—and AuthHub does not inherit them."
                  : `Moving from ${competitor.name} is straightforward. Here's how agencies do it:`}
              </p>

              <div className="grid md:grid-cols-3 gap-6 md:gap-8 text-left">
                {migrationSteps.map((step) => (
                  <div key={step.step} className="bg-paper border-2 border-ink p-6 shadow-brutalist hover-lift-brutalist group">
                    <div className="w-12 h-12 bg-coral text-white font-display font-bold text-xl flex items-center justify-center shadow-brutalist-sm mb-4">
                      {step.step}
                    </div>
                    <h3 className="font-display font-semibold text-ink text-lg mb-2">{step.title}</h3>
                    <p className="font-mono text-sm text-muted-foreground leading-relaxed">
                      {step.description}
                    </p>
                  </div>
                ))}
              </div>

            </div>
          </div>
        </section>
      )}

      {/* Testimonials */}
      {testimonials.length > 0 && (
        <section className="border-b-2 border-black bg-card">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-16">
            <h2 className="font-dela text-2xl md:text-3xl text-ink mb-8 text-center">
              What Agencies Say
            </h2>
            <div className="grid md:grid-cols-2 gap-6 max-w-4xl mx-auto">
              {testimonials.slice(0, 2).map((testimonial, i) => (
                <div key={i} className="border-2 border-black p-6 rounded-none shadow-brutalist-sm">
                  <blockquote className="font-mono text-ink mb-4">
                    &ldquo;{testimonial.quote}&rdquo;
                  </blockquote>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-coral/20 rounded-full flex items-center justify-center">
                      <span className="font-bold text-danger-ink">{testimonial.author[0]}</span>
                    </div>
                    <div>
                      <p className="font-bold text-ink text-sm">{testimonial.author}</p>
                      <p className="text-muted-foreground text-xs font-mono">
                        {testimonial.role} at {testimonial.company}
                        {testimonial.previousTool && (
                          <span className="text-danger-ink"> • {testimonial.previousTool}</span>
                        )}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* FAQ Section */}
      {faqs.length > 0 && (
        <section className="border-b-2 border-black bg-card">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-16">
            <h2 className="font-dela text-2xl md:text-3xl text-ink mb-8 text-center">
              Frequently Asked Questions
            </h2>
            <div className="max-w-3xl mx-auto space-y-4">
              {faqs.map((faq, i) => (
                <details key={i} className="group border-2 border-black p-4 rounded-none">
                  <summary className="font-dela text-lg text-ink cursor-pointer list-none flex justify-between items-center">
                    {faq.question}
                    <span className="transform transition-transform group-open:rotate-180">
                      ▼
                    </span>
                  </summary>
                  <p className="font-mono text-sm text-foreground mt-4 pt-4 border-t border-gray-200">
                    {faq.answer}
                  </p>
                </details>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Final CTA - AIDA: Action */}
      <section className="bg-ink text-white">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-16 text-center">
          <h2 className="font-dela text-3xl md:text-4xl mb-4">
            {cta.headline}
          </h2>
          <p className="font-mono text-white/80 mb-8 max-w-xl mx-auto">
            {cta.subheadline}
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button
              variant="primary"
              size="lg"
              asChild
              className="border-white font-bold uppercase tracking-wider"
            >
              <Link href={(cta.primaryLink ?? "/signup") as Route}>
                {cta.primaryButton}
              </Link>
            </Button>
            {cta.secondaryButton && (
              <Link
                href={(cta.secondaryLink ?? "/pricing") as Route}
                className="inline-flex items-center justify-center gap-2 font-bold uppercase tracking-wider px-8 py-4 bg-transparent text-white border-2 border-white hover:bg-white hover:text-ink transition-all"
              >
                {cta.secondaryButton}
              </Link>
            )}
          </div>
          {isAgencyAccessPage && (
            <nav
              aria-label="Related compare and guide links"
              className="mt-8 flex flex-col gap-2 font-mono text-sm text-white/80 sm:flex-row sm:flex-wrap sm:justify-center sm:gap-x-4 sm:gap-y-2"
            >
              <Link href={"/compare/leadsie-alternative" as Route} className="hover:text-white hover:underline">
                AuthHub vs Leadsie
              </Link>
              <Link href={"/compare/leadsie-pricing" as Route} className="hover:text-white hover:underline">
                Leadsie pricing deep-dive
              </Link>
              <Link
                href={"/blog/best-client-onboarding-software-agencies-2026" as Route}
                className="hover:text-white hover:underline"
              >
                Best client onboarding software (2026)
              </Link>
              <Link href={"/blog/oauth-token-management-agencies" as Route} className="hover:text-white hover:underline">
                OAuth token management for agencies
              </Link>
            </nav>
          )}
          {cta.guarantee && (
            <p className="font-mono text-xs text-muted-foreground mt-6">
              {cta.guarantee}
            </p>
          )}
        </div>
      </section>
    </div>
  );
}

// Helper function to get differentiator descriptions
function getDifferentiatorDescription(differentiator: string): string {
  const descriptions: Record<string, string> = {
    "Access + Intake": "One link handles OAuth and collects client info—no separate forms needed.",
    "Access + Intake in One Link": "One link handles OAuth and collects client info—no separate forms needed.",
    "Predictable tiered pricing (no credits)": "Monthly tiers at $29 / $79 / $149 with 5 / 20 / 50 client caps.",
    "Token Health + Infisical Audit": "Token-health monitoring, provider-supported refresh, and audit events.",
    [`${SUPPORTED_PLATFORM_COUNT} Platform Connectors`]:
      "Core ad, analytics, commerce, and email connectors in one flow.",
    "Infisical-backed Token Storage":
      "OAuth token references in Infisical with audit logs—no SOC 2 claim on this page.",
    "Automatic Token Refresh":
      "Monitors token health and refreshes before expiry where the provider supports it.",
    "API + Webhooks on Growth+": "REST API and webhooks on Growth and Scale—not Starter.",
    "API & Webhooks Built-In": "REST API and webhooks on Growth and Scale—not Starter.",
  };

  return descriptions[differentiator] || "Compare token lifecycle, caps, and automation depth.";
}

export default ComparisonPageTemplate;
