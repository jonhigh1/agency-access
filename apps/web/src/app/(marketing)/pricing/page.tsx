import type { Metadata } from 'next';
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
      price: '24.00',
      priceCurrency: 'USD',
      billingIncrement: 'P1M',
      description:
        '5 clients/month, all platform integrations, white-label branding, unlimited team seats.',
      url: 'https://authhub.co/pricing',
    },
    {
      '@type': 'Offer',
      name: 'Growth',
      price: '66.00',
      priceCurrency: 'USD',
      billingIncrement: 'P1M',
      description:
        '20 clients/month, custom domain, webhooks & API, priority support, multi-brand accounts.',
      url: 'https://authhub.co/pricing',
    },
    {
      '@type': 'Offer',
      name: 'Agency',
      price: '124.00',
      priceCurrency: 'USD',
      billingIncrement: 'P1M',
      description:
        '50 clients/month, custom integrations, multi-brand management up to 3 brands.',
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
  title: 'OAuth Client Onboarding Pricing – Starter, Growth & Agency Plans | AuthHub',
  description: 'Plans from $29/mo ($24/mo billed yearly). Automate OAuth client onboarding with white-label flows, built-in token refresh, and audit logs. 14-day free trial — no credit card required.',
  alternates: {
    canonical: 'https://authhub.co/pricing',
  },
  openGraph: {
    title: 'OAuth Client Onboarding Pricing – Starter, Growth & Agency Plans | AuthHub',
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
