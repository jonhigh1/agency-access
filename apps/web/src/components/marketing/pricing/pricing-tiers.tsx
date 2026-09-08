'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { m } from 'framer-motion';
import { PricingToggle } from './pricing-toggle';
import { PricingTierCard } from './pricing-tier-card';
import { Reveal } from '../reveal';
import { trackPricingViewed } from '@/lib/analytics/billing';

// Feature interface with optional value context
interface Feature {
  name: string;
  included: boolean;
  value?: string; // Why this matters
}

const tierFeatures = {
  starter: [
    { name: '5 clients/month', included: true, value: '60 onboards/year' },
    { name: 'All platform integrations', included: true, value: 'Meta, Google, LinkedIn, TikTok, more' },
    { name: 'White-label branding', included: true, value: 'Your brand, not ours' },
    { name: 'Unlimited team seats', included: true, value: 'Share the work' },
    { name: 'Email support', included: true },
    { name: 'Custom domain', included: false },
    { name: 'Webhooks & API', included: false },
    { name: 'Priority support', included: false },
  ],
  growth: [
    { name: '20 clients/month', included: true, value: '240 onboards/year' },
    { name: 'All platform integrations', included: true },
    { name: 'White-label branding', included: true },
    { name: 'Custom domain', included: true, value: 'Your URL, your brand' },
    { name: 'Unlimited team seats', included: true, value: 'Full team collaboration' },
    { name: 'Webhooks & API', included: true, value: 'Connect your stack' },
    { name: 'Priority support', included: true, value: 'Faster response time' },
    { name: 'Multi-brand accounts', included: false },
    { name: 'Custom integrations', included: false },
  ],
  agency: [
    { name: '50 clients/month', included: true, value: '600 onboards/year' },
    { name: 'All platform integrations', included: true },
    { name: 'White-label branding', included: true },
    { name: 'Custom domain', included: true, value: 'Your URL, your brand' },
    { name: 'Unlimited team seats', included: true, value: 'Full team collaboration' },
    { name: 'Webhooks & API', included: true, value: 'Connect your stack' },
    { name: 'Priority support', included: true, value: 'Faster response time' },
    { name: 'Multi-brand accounts', included: true, value: 'Manage up to 3 brands' },
    { name: 'Custom integrations', included: true, value: 'We build what you need' },
  ],
};

export function PricingTiers() {
  const pathname = usePathname();
  const [isYearly, setIsYearly] = useState(true);
  const billingPeriod = isYearly ? 'yearly' : 'monthly';

  useEffect(() => {
    trackPricingViewed({
      path: pathname || '/pricing',
      billing_period: billingPeriod,
    });
  }, [billingPeriod, pathname]);

  return (
    <section id="pricing" className="py-16 sm:py-20 md:py-24 bg-paper relative">
      {/* Background Pattern */}
      <div className="absolute inset-0 opacity-5 pointer-events-none">
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: 'radial-gradient(circle, #000 1px, transparent 1px)',
            backgroundSize: '30px 30px',
          }}
        />
      </div>

      <div className="container mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <Reveal>
          {/* Section Header */}
          <div className="text-center mb-12 sm:mb-16">
            <div className="inline-block mb-4">
              <div className="bg-coral/10 text-danger-ink border-2 border-coral/30 px-4 py-2 font-mono text-xs font-bold uppercase tracking-wider inline-block">
                Simple Pricing
              </div>
            </div>
            <h2 className="font-dela text-3xl sm:text-4xl md:text-5xl lg:text-6xl tracking-tight mb-4 sm:mb-6 text-ink">
              Choose the plan that{' '}
              <span className="text-danger-ink italic">fits your team</span>
            </h2>
            <p className="text-base sm:text-lg text-gray-600 max-w-2xl mx-auto font-mono">
              All plans include a 14-day free trial. Choose the plan that fits your agency's needs.
            </p>
          </div>

          {/* Toggle */}
          <PricingToggle isYearly={isYearly} onToggle={setIsYearly} />
        </Reveal>

        {/* Mobile-Friendly Tier Summary */}
        <div className="md:hidden mb-8">
          <div className="border-2 border-black bg-card p-4 shadow-brutalist-sm">
            <div className="space-y-3 font-mono text-sm">
              <div className="flex justify-between items-center py-2 border-b border-gray-200">
                <span className="font-bold text-ink">Starter</span>
                <span className="text-gray-600">{isYearly ? '$24/mo' : '$29/mo'}</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-gray-200 bg-coral/5 -mx-2 px-2">
                <span className="font-bold text-danger-ink">Growth → Most Popular</span>
                <span className="text-gray-600">{isYearly ? '$66/mo' : '$79/mo'}</span>
              </div>
              <div className="flex justify-between items-center py-2">
                <span className="font-bold text-ink">Agency</span>
                <span className="text-gray-600">{isYearly ? '$124/mo' : '$149/mo'}</span>
              </div>
            </div>
            <p className="text-xs text-gray-500 mt-4 text-center font-mono">
              Scroll down for full comparison →
            </p>
          </div>
        </div>

        {/* Bento Grid Layout - Now visible on all screens */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8 max-w-7xl mx-auto">
          {/* Starter Tier - Has Free Trial */}
          <div className="md:col-span-1">
            <PricingTierCard
              tier="STARTER"
              name="Starter"
              description="Agencies getting started with access automation"
              persona="For small agencies"
              yearlyPrice={290}
              monthlyPrice={29}
              isYearly={isYearly}
              hasTrial={true}
              features={tierFeatures.starter}
              buttonText="Start Free Trial"
              buttonVariant="brutalist"
              billingInterval={isYearly ? 'yearly' : 'monthly'}
            />
          </div>

          {/* Growth Tier (Most Popular) - Has Free Trial */}
          <div className="md:col-span-1" data-tier="GROWTH">
            <PricingTierCard
              tier="GROWTH"
              name="Growth"
              description="Agencies scaling their client operations"
              persona="For growing agencies"
              yearlyPrice={790}
              monthlyPrice={79}
              isYearly={isYearly}
              isPopular={true}
              hasTrial={true}
              features={tierFeatures.growth}
              buttonText="Start Free Trial"
              buttonVariant="brutalist"
              billingInterval={isYearly ? 'yearly' : 'monthly'}
            />
          </div>

          {/* Agency Tier - Has Free Trial */}
          <div className="md:col-span-1">
            <PricingTierCard
              tier="AGENCY"
              name="Agency"
              description="High-volume agencies with advanced needs"
              persona="For established agencies"
              yearlyPrice={1490}
              monthlyPrice={149}
              isYearly={isYearly}
              isPro={true}
              hasTrial={true}
              features={tierFeatures.agency}
              buttonText="Start Free Trial"
              buttonVariant="brutalist"
              billingInterval={isYearly ? 'yearly' : 'monthly'}
            />
          </div>
        </div>

        {/* Payback Callout */}
        <Reveal delay={0.2}>
          <m.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="mt-12 sm:mt-16 text-center"
          >
            <div className="inline-flex items-center gap-3 bg-teal/10 border-2 border-teal/30 px-6 py-4 max-w-xl mx-auto">
              <span className="text-2xl">💡</span>
              <div className="text-left">
                <p className="font-bold text-ink text-sm">Pays for itself in 1 client onboarding</p>
                <p className="text-xs text-gray-600 font-mono">Most teams save 3+ hours per client. At $85/hr, that's $255 saved per onboard.</p>
              </div>
            </div>
          </m.div>
        </Reveal>
      </div>
    </section>
  );
}
