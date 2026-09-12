import type { Metadata } from 'next';
import { SUPPORTED_PLATFORM_COUNT } from '@agency-platform/shared';
import { PricingHero } from '@/components/marketing/pricing/pricing-hero';
import { SavingsCalculator } from '@/components/marketing/pricing/savings-calculator';
import { PricingTiers } from '@/components/marketing/pricing/pricing-tiers';
import { MetricBanner } from '@/components/marketing/pricing/metric-banner';
import { SuccessStoriesSection } from '@/components/marketing/success-stories-section';
import { FAQSection } from '@/components/marketing/pricing/faq-section';
import { FinalCTASection } from '@/components/marketing/pricing/final-cta-section';

const pricingSchema = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: 'AuthHub',
  applicationCategory: 'BusinessApplication',
  operatingSystem: 'Web',
  offers: [
    {
      '@type': 'Offer',
      name: 'Starter',
      price: '29.00',
      priceCurrency: 'USD',
      billingIncrement: 'P1M',
      description:
        `Up to 5 active clients, all ${SUPPORTED_PLATFORM_COUNT} platform integrations, one-link onboarding, token auto-refresh, audit logs, unlimited team seats. Yearly: $290/yr (~$24/mo, pay for 10 get 12).`,
      url: 'https://authhub.co/pricing',
    },
    {
      '@type': 'Offer',
      name: 'Growth',
      price: '79.00',
      priceCurrency: 'USD',
      billingIncrement: 'P1M',
      description:
        'Up to 20 active clients, everything in Starter plus full white-label branding, custom domain, webhooks & API, priority support, token health monitoring dashboard. Yearly: $790/yr (~$66/mo, pay for 10 get 12).',
      url: 'https://authhub.co/pricing',
    },
    {
      '@type': 'Offer',
      name: 'Scale',
      price: '149.00',
      priceCurrency: 'USD',
      billingIncrement: 'P1M',
      description:
        'Up to 50 active clients, everything in Growth plus multi-brand management (up to 3 brands) and custom integrations. Yearly: $1,490/yr (~$124/mo, pay for 10 get 12).',
      url: 'https://authhub.co/pricing',
    },
    {
      '@type': 'Offer',
      description: '14-day free trial, no credit card required',
    },
  ],
  featureList:
    'OAuth automation, white-label client experience, built-in token refresh, audit logs, webhooks & API',
};

export const metadata: Metadata = {
  title: 'OAuth Client Onboarding Pricing – Starter, Growth & Scale Plans | AuthHub',
  description: 'Plans from $29/mo ($24/mo billed yearly). Automate OAuth client onboarding with white-label flows, built-in token refresh, and audit logs. 14-day free trial — no credit card required.',
  alternates: {
    canonical: 'https://authhub.co/pricing',
  },
  openGraph: {
    title: 'OAuth Client Onboarding Pricing – Starter, Growth & Scale Plans | AuthHub',
    description: 'Simple, transparent pricing for client onboarding teams.',
    type: 'website',
    url: 'https://authhub.co/pricing',
  },
};

export default async function PricingPage() {
  return (
    <main className="relative bg-background">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(pricingSchema) }}
      />
      <PricingHero />
      <SavingsCalculator />
      <PricingTiers />
      <MetricBanner />
      <SuccessStoriesSection />
      <FAQSection />
      <FinalCTASection />
    </main>
  );
}
