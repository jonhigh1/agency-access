/**
 * Programmatic Comparison Page Template
 * AIDA/PAS framework-based comparison page component for SEO and conversions
 * Designed for programmatic generation with data-driven content
 */

"use client";

import { Check, X, ArrowRight, Clock, DollarSign, Globe, Zap, Shield, Users } from "lucide-react";
import Link from "next/link";
import type { Route } from "next";
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
  const authHubPrice = page.ourProduct.pricing.pro?.price ?? 79;
  const agencyAccessPrice = typeof page.competitor.pricing.pro?.price === "number"
    ? page.competitor.pricing.pro.price
    : page.competitor.pricing.starting;

  const authHubFeatures = page.ourProduct.pricing.pro?.features ?? page.pricingComparison.authhub.starter.features;

  const agencyAccessFeatures = [
    "Unlimited invites",
    "Complete branding",
    "Zapier integration",
    "10 team members",
    "Priority support",
    "20+ platform integrations",
  ];

  return (
    <section
      id="comparison"
      className="scroll-mt-24 border-y border-black/10 bg-[#F8FAFC] px-4 py-[46px] sm:px-6 lg:px-8 lg:py-[54px]"
    >
      <div className="mx-auto max-w-[872px]">
        <div className="mb-9 text-center lg:mb-10">
          <div className="mb-5 inline-flex items-center justify-center border-2 border-black bg-white px-[14px] py-[6px] text-[10px] font-black uppercase tracking-[0.22em] text-[#EA7A49] shadow-[3px_3px_0_0_#000]">
            Pricing
          </div>
          <h2 className="font-dela text-[2.2rem] leading-[0.96] tracking-[-0.045em] text-[#10162F] sm:text-[2.55rem]">
            Cost Comparison
          </h2>
          <p className="mx-auto mt-5 max-w-[560px] font-mono text-[13px] font-medium leading-[1.45] tracking-[0.02em] text-[#7B8492] sm:text-[14px]">
            Compare equivalent feature sets and see where you get the most value
            for your budget.
          </p>
        </div>

        <div className="relative mx-auto grid max-w-[872px] gap-5 md:grid-cols-2">
          <article className="relative border-2 border-black bg-[#EDF6F7] px-[24px] pb-[22px] pt-[24px] shadow-[4px_4px_0_0_#000]">
            <div className="absolute right-[10px] top-[-10px] z-10 border-2 border-black bg-[#E8B43C] px-[14px] py-[5px] text-[10px] font-black uppercase tracking-[0.12em] text-black shadow-[3px_3px_0_0_#000]">
              Best Value
            </div>

            <h3 className="font-dela text-[1.32rem] leading-none tracking-[-0.04em] text-[#151E35] sm:text-[1.42rem]">
              AuthHub Growth
            </h3>

            <div className="mt-5 flex items-end gap-[7px] text-[#45B3A8]">
              <span className="font-dela text-[2.85rem] leading-none tracking-[-0.06em] sm:text-[3rem]">
                ${authHubPrice}
              </span>
              <span className="pb-[6px] font-mono text-[13px] font-medium text-[#717A89]">
                per month
              </span>
            </div>

            <ul className="mt-4 space-y-[9px]">
              {authHubFeatures.map((feature) => (
                <li key={feature} className="flex items-start gap-3">
                  <Check
                    size={15}
                    strokeWidth={3}
                    className="mt-[1px] shrink-0 text-[#45B3A8]"
                  />
                  <span className="font-mono text-[13px] font-medium leading-[1.2] text-[#626A78]">
                    {feature}
                  </span>
                </li>
              ))}
            </ul>

            <Link
              href={"/signup" as Route}
              className="mt-4 flex h-[34px] w-full items-center justify-center border-2 border-black bg-[#E97A4A] px-4 font-sans text-[11px] font-black uppercase tracking-[0.06em] text-white shadow-[3px_3px_0_0_#000] transition-transform hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[2px_2px_0_0_#000]"
            >
              Start Free Trial
            </Link>
          </article>

          <article className="border-2 border-black bg-white px-[24px] pb-[22px] pt-[24px] shadow-[4px_4px_0_0_#000]">
            <h3 className="font-dela text-[1.32rem] leading-none tracking-[-0.04em] text-[#151E35] sm:text-[1.42rem]">
              AgencyAccess Premium
            </h3>

            <div className="mt-5 flex flex-wrap items-end gap-x-[7px] gap-y-1 text-[#596276]">
              <span className="font-dela text-[2.85rem] leading-none tracking-[-0.06em] sm:text-[3rem]">
                ${agencyAccessPrice}
              </span>
              <span className="pb-[6px] font-mono text-[13px] font-medium text-[#717A89]">
                per month (annual)
              </span>
            </div>

            <ul className="mt-4 space-y-[9px]">
              {agencyAccessFeatures.map((feature) => (
                <li key={feature} className="flex items-start gap-3">
                  <Check
                    size={15}
                    strokeWidth={3}
                    className="mt-[1px] shrink-0 text-[#BBC4D0]"
                  />
                  <span className="font-mono text-[13px] font-medium leading-[1.2] text-[#687180]">
                    {feature}
                  </span>
                </li>
              ))}
            </ul>

          </article>
        </div>

        <div className="mt-[22px] border-2 border-black bg-[#F8FAFC] px-4 py-[18px] shadow-[4px_4px_0_0_#000] sm:px-[18px]">
          <div className="flex items-start gap-3">
            <div className="flex h-[30px] w-[30px] shrink-0 items-center justify-center border-2 border-black bg-[#E97A4A] font-sans text-[18px] font-medium leading-none text-white">
              $
            </div>
            <div>
              <h3 className="font-sans text-[1rem] font-black tracking-[-0.03em] text-[#1A2238]">
                Value Summary
              </h3>
              <p className="mt-[6px] font-mono text-[11px] font-medium leading-[1.35] tracking-[0.015em] text-[#818898]">
                For agencies needing 20 clients/month, API access, and automatic token
                refresh, AuthHub Growth (${authHubPrice}/mo, or $66/mo billed yearly) delivers more automation than
                AgencyAccess Premium (${agencyAccessPrice}/mo). Predictable tier caps (5/20/50 clients/month) plus
                Infisical-backed token storage and audit logs. AgencyAccess excels with
                broader platform coverage and 24/7 chat support on higher tiers.
              </p>
            </div>
          </div>
        </div>
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
  const isLeadsiePage = page.id === "leadsie-alternative";
  const { competitor, ourProduct, cta, testimonials, painPoints, quickComparison, detailedComparison, recommendations, migrationSteps, pricingComparison, faqs } = page;

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

            {/* Headline with colored "vs" */}
            <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold tracking-tight mb-8">
              <span className="text-[#1A1A1A]">{ourProduct.name}</span>{" "}
              <span className="text-[#4ECDC4] font-normal">vs</span>{" "}
              <span className="text-[#4A4A4A]">{competitor.name}</span>
            </h1>

            {/* Body text */}
            <p className="text-lg md:text-xl text-[#6B7280] mb-10 max-w-2xl mx-auto leading-relaxed">
              {page.excerpt}
            </p>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row gap-4 justify-center mb-10">
              <Link
                href={(cta.primaryLink || "/signup") as Route}
                className="group inline-flex items-center justify-center gap-2 font-bold uppercase tracking-wider px-10 py-4 bg-coral text-white border-2 border-black rounded-none shadow-brutalist hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px] transition-all"
              >
                Start Free Trial
                <ArrowRight size={18} className="transition-transform group-hover:translate-x-1" />
              </Link>
              <Link
                href={(cta.secondaryLink || "/pricing") as Route}
                className="inline-flex items-center justify-center gap-2 font-bold uppercase tracking-wider px-10 py-4 bg-white text-[#1A1A1A] border-2 border-black rounded-none hover:bg-gray-50 transition-colors"
              >
                Schedule Demo
              </Link>
            </div>

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
              Why Agencies Switch to {ourProduct.name}
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
            Why Agencies Look for {competitor.name} Alternatives
          </h2>
          <p className="font-mono text-muted-foreground text-center mb-12 max-w-2xl mx-auto">
            Growing agencies hit these walls with {competitor.name}. Sound familiar?
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
                Pricing Comparison
              </p>
              <h2 className="text-3xl md:text-4xl font-bold text-[#1A1A1A]">
                Which plan is right for you?
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
                  {isLeadsiePage && (
                    <p className="text-sm text-[#6B7280] mt-1">
                      $59 · $129 · $299 by tier (3 / 10 / 50 credits)
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
                        <span className="w-4 text-center text-[#6B7280]">{row.competitor}</span>
                      )}
                      <span>{row.feature}</span>
                    </li>
                  ))}
                </ul>

                {/* CTA */}
                <Link
                  href={(cta.secondaryLink || "/pricing") as Route}
                  className="block w-full text-center py-3 px-6 bg-white text-[#1A365D] border-2 border-[#1A365D] rounded-lg font-semibold hover:bg-gray-50 transition-colors"
                >
                  CHOOSE PLAN
                </Link>
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
                  {pricingComparison.savings.yearly > 0 && (
                    <p className="text-sm font-semibold text-[#4ECDC4] mt-2">
                      {isLeadsiePage
                        ? "Save $50/mo ($600/yr) vs Leadsie Agency — AuthHub Growth $79 / 20 clients"
                        : `Save $${pricingComparison.savings.yearly}/year`}
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
                        <span className="w-4 text-center font-semibold text-[#4A5568]">{row.authhub}</span>
                      )}
                      <span className={row.isExclusive ? "font-semibold" : ""}>{row.feature}</span>
                      {row.isExclusive && (
                        <span className="text-xs font-semibold text-[#FF6B35]">(Exclusive)</span>
                      )}
                    </li>
                  ))}
                </ul>

                {/* CTA */}
                <Link
                  href={(cta.primaryLink || "/signup") as Route}
                  className="group flex items-center justify-center gap-2 w-full text-center py-3 px-6 bg-[#FF6B35] text-white rounded-lg font-semibold hover:bg-[#e55a2b] transition-all"
                >
                  START FREE TRIAL
                  <ArrowRight size={16} className="transition-transform group-hover:translate-x-1" />
                </Link>
              </div>
            </div>

            {/* Value Summary */}
            <div className="max-w-4xl mx-auto mt-12 p-6 bg-[#FFFBEB] border border-[#FCD34D] rounded-xl">
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0 w-10 h-10 bg-[#FF6B35] rounded-full flex items-center justify-center">
                  <DollarSign size={20} className="text-white" />
                </div>
                <div>
                  <h4 className="font-bold text-[#1A365D] mb-2">
                    {isLeadsiePage
                      ? "Save $50/mo ($600/yr) vs Leadsie Agency — AuthHub Growth $79 / 20 clients"
                      : `Save $${pricingComparison.savings.yearly}/year with AuthHub`}
                  </h4>
                  <p className="text-sm text-[#4A5568]">
                    {isLeadsiePage ? (
                      <>
                        Leadsie uses client credits (3 / 10 / 50 per tier at $59 / $129 / $299) with overage fees when you exceed your cap. AuthHub uses fixed monthly caps—5, 20, or 50 clients per plan at $29 / $79 / $149—with no credit math or surprise overages.
                      </>
                    ) : (
                      <>
                        AuthHub&apos;s tiered pricing (Starter $29 · Growth $79 · Agency $149) scales with your volume—5, 20, or 50 clients/month per plan. AgencyAccess charges per seat and limits invites on Starter. AuthHub adds automatic token refresh and Infisical-backed audit logs that prevent costly access interruptions.
                      </>
                    )}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Feature-by-Feature Comparison */}
      {detailedComparison.length > 0 && (
        <section className="border-b-2 border-black bg-card">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-12">
            <h2 className="font-dela text-2xl md:text-3xl text-ink mb-8 text-center">
              Feature-by-Feature Comparison
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
            Who Should Switch (and Who Shouldn&apos;t)
          </h2>
          <div className="grid md:grid-cols-2 gap-6 max-w-4xl mx-auto">
            {/* Stick with competitor */}
            <div className="border-2 border-black p-6 rounded-none shadow-brutalist-sm">
              <h3 className="font-dela text-xl text-ink mb-4">Stick with {competitor.name} If</h3>
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
                Switch in {page.migrationTimeMinutes || 15} Minutes
              </h2>
              <p className="font-mono text-muted-foreground mb-12">
                Moving from {competitor.name} is straightforward. Here&apos;s how agencies do it:
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

              <div className="mt-10 p-4 bg-ink/5 border border-ink/10 inline-flex items-center gap-3">
                <div className="w-8 h-8 bg-teal/20 rounded-full flex items-center justify-center">
                  <Check size={16} className="text-success-ink" />
                </div>
                <p className="font-mono text-sm text-ink/80">
                  <span className="font-semibold">Free migration support:</span> Our team walks you through the switch during onboarding.
                </p>
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
            <Link
              href={(cta.primaryLink ?? "/signup") as Route}
              className="inline-flex items-center justify-center gap-2 font-bold uppercase tracking-wider px-8 py-4 bg-coral text-white border-2 border-white rounded-none shadow-brutalist hover:shadow-brutalist-lg hover:-translate-y-0.5 transition-all"
            >
              {cta.primaryButton}
            </Link>
            {cta.secondaryButton && (
              <Link
                href={(cta.secondaryLink ?? "/pricing") as Route}
                className="inline-flex items-center justify-center gap-2 font-bold uppercase tracking-wider px-8 py-4 bg-transparent text-white border-2 border-white hover:bg-white hover:text-ink transition-all"
              >
                {cta.secondaryButton}
              </Link>
            )}
          </div>
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
    "Predictable tiered pricing (no credits)": "Fixed monthly caps at $29 / $79 / $149—no credits, no overage surprises.",
    "Flat-Rate Pricing": "Fixed monthly caps—no credits, no overage surprises.",
    "US-Based Support": "Same-day responses during US hours. No more time zone delays.",
    "15+ Platforms": "Support for Pinterest, Klaviyo, Shopify, and more emerging channels.",
    "Infisical-backed Token Storage": "OAuth tokens stored in Infisical with complete audit logs—never in the database.",
  };

  return descriptions[differentiator] || "Industry-leading capability that sets us apart.";
}

export default ComparisonPageTemplate;
