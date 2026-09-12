'use client';

/**
 * Plan Comparison Card
 *
 * Tier comparison grid with upgrade CTAs.
 * Matches the marketing site pricing tiers at https://www.authhub.co/pricing
 */

import { useEffect, useState } from 'react';
import { useAuth } from '@clerk/nextjs';
import { AlertCircle, ArrowRight, Check, X } from 'lucide-react';
import { useSubscription, useCreateCheckout } from '@/lib/query/billing';
import {
  buildPlanSelectedProps,
  trackPlanSelected,
} from '@/lib/analytics/billing';
import {
  type BillingInterval,
  type PricingDisplayTier,
  PRICING_DISPLAY_TIER_ORDER,
  PRICING_DISPLAY_TIER_DETAILS,
  PRICING_DISPLAY_TIER_TO_SUBSCRIPTION_TIER,
  getPricingDisplayTierFromSubscriptionTier,
} from '@agency-platform/shared';
import { Button } from '@/components/ui/button';
import { persistBillingIntervalPreference, readBillingIntervalPreference } from './billing-interval';
import { resolveBillingLifecycle } from './billing-lifecycle';

// Tier pricing configuration (yearly price, monthly price)
const tierPricing: Record<PricingDisplayTier, { yearly: number; monthly: number }> = {
  STARTER: {
    yearly: PRICING_DISPLAY_TIER_DETAILS.STARTER.yearlyPrice,
    monthly: PRICING_DISPLAY_TIER_DETAILS.STARTER.monthlyPrice,
  },
  GROWTH: {
    yearly: PRICING_DISPLAY_TIER_DETAILS.GROWTH.yearlyPrice,
    monthly: PRICING_DISPLAY_TIER_DETAILS.GROWTH.monthlyPrice,
  },
  SCALE: {
    yearly: PRICING_DISPLAY_TIER_DETAILS.SCALE.yearlyPrice,
    monthly: PRICING_DISPLAY_TIER_DETAILS.SCALE.monthlyPrice,
  },
};

// Feature inclusion matrix for each tier - ONE value metric (active clients)
const tierFeatures: Record<PricingDisplayTier, { name: string; included: boolean; value?: string }[]> = {
  STARTER: [
    { name: 'Up to 5 active clients', included: true, value: 'Add/remove anytime' },
    { name: 'All platform integrations', included: true, value: 'Meta, Google, LinkedIn, TikTok, more' },
    { name: 'One-link onboarding', included: true, value: 'Share single link' },
    { name: 'Token auto-refresh', included: true, value: 'No expired tokens' },
    { name: 'Audit logs', included: true, value: 'Full activity history' },
    { name: 'Unlimited team seats', included: true, value: 'Share the work' },
    { name: 'AuthHub-branded client link', included: true, value: 'Built-in branding' },
    { name: 'White-label branding', included: false, value: 'Your brand, not ours' },
    { name: 'Custom domain', included: false },
    { name: 'Webhooks & API', included: false },
    { name: 'Priority support', included: false },
    { name: 'Email support', included: true },
    { name: 'Token health monitoring dashboard', included: false },
  ],
  GROWTH: [
    { name: 'Up to 20 active clients', included: true, value: 'Add/remove anytime' },
    { name: 'All platform integrations', included: true, value: 'Meta, Google, LinkedIn, TikTok, more' },
    { name: 'One-link onboarding', included: true, value: 'Share single link' },
    { name: 'Token auto-refresh', included: true, value: 'No expired tokens' },
    { name: 'Audit logs', included: true, value: 'Full activity history' },
    { name: 'Unlimited team seats', included: true, value: 'Share the work' },
    { name: 'AuthHub-branded client link', included: true, value: 'Built-in branding' },
    { name: 'White-label branding', included: true, value: 'Your brand, colors, domain' },
    { name: 'Custom domain', included: true, value: 'Your URL, your brand' },
    { name: 'Webhooks & API', included: true, value: 'Connect your stack' },
    { name: 'Priority support', included: true, value: 'Faster response time' },
    { name: 'Email support', included: true },
    { name: 'Token health monitoring dashboard', included: true, value: 'Real-time token health' },
    { name: 'Multi-brand accounts', included: false, value: 'Up to 3 brands' },
    { name: 'Custom integrations', included: false, value: 'We build what you need' },
  ],
  SCALE: [
    { name: 'Up to 50 active clients', included: true, value: 'Add/remove anytime' },
    { name: 'All platform integrations', included: true, value: 'Meta, Google, LinkedIn, TikTok, more' },
    { name: 'One-link onboarding', included: true, value: 'Share single link' },
    { name: 'Token auto-refresh', included: true, value: 'No expired tokens' },
    { name: 'Audit logs', included: true, value: 'Full activity history' },
    { name: 'Unlimited team seats', included: true, value: 'Share the work' },
    { name: 'AuthHub-branded client link', included: true, value: 'Built-in branding' },
    { name: 'White-label branding', included: true, value: 'Your brand, colors, domain' },
    { name: 'Custom domain', included: true, value: 'Your URL, your brand' },
    { name: 'Webhooks & API', included: true, value: 'Connect your stack' },
    { name: 'Priority support', included: true, value: 'Faster response time' },
    { name: 'Email support', included: true },
    { name: 'Token health monitoring dashboard', included: true, value: 'Real-time token health' },
    { name: 'Multi-brand accounts', included: true, value: 'Manage up to 3 brands' },
    { name: 'Custom integrations', included: true, value: 'We build what you need' },
  ],
};

export function PlanComparison() {
  const { orgId, userId } = useAuth();
  const agencyId = orgId ?? userId ?? null;
  const { data: subscription } = useSubscription();
  const createCheckout = useCreateCheckout();

  const currentTier = getPricingDisplayTierFromSubscriptionTier(subscription?.tier);
  const lifecycle = resolveBillingLifecycle(subscription);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isYearly, setIsYearly] = useState(() => {
    const fallback: BillingInterval = lifecycle === 'PAID' ? 'monthly' : 'yearly';
    return readBillingIntervalPreference(fallback) === 'yearly';
  });

  useEffect(() => {
    const fallback: BillingInterval = lifecycle === 'PAID' ? 'monthly' : 'yearly';
    setIsYearly(readBillingIntervalPreference(fallback) === 'yearly');
  }, [lifecycle]);

  const setBillingInterval = (interval: BillingInterval) => {
    setIsYearly(interval === 'yearly');
    persistBillingIntervalPreference(interval);
  };

  const handleUpgrade = async (displayTier: PricingDisplayTier) => {
    const subscriptionTier = PRICING_DISPLAY_TIER_TO_SUBSCRIPTION_TIER[displayTier];
    if (!subscriptionTier) return;
    const billingInterval: BillingInterval = isYearly ? 'yearly' : 'monthly';

    setErrorMessage(null);

    trackPlanSelected({
      ...buildPlanSelectedProps(displayTier, billingInterval, 'compare'),
      agency_id: agencyId,
    });

    try {
      const result = await createCheckout.mutateAsync({
        tier: subscriptionTier,
        billingInterval,
        surface: 'compare',
        successUrl: `${window.location.origin}/settings?tab=billing&checkout=success`,
        cancelUrl: `${window.location.origin}/settings?tab=billing&checkout=cancel`,
      });
      if (result?.checkoutUrl) {
        window.location.assign(result.checkoutUrl);
      } else {
        setErrorMessage('Checkout session did not return a valid URL. Please try again.');
      }
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Failed to start checkout. Please try again.');
    }
  };

  const tierIndex = PRICING_DISPLAY_TIER_ORDER.indexOf(currentTier);

  return (
    <section className="border-2 border-border rounded-lg shadow-brutalist p-6 bg-card">
      {/* Section Header */}
      <div className="mb-6">
        <div className="inline-block mb-3">
          <div className="bg-coral/10 text-danger-ink border-2 border-coral/30 px-3 py-1 font-mono text-xs font-bold uppercase tracking-wider inline-block">
            Compare Plans
          </div>
        </div>
        <h2 className="font-display text-xl font-semibold text-ink mb-1">
          Find the right plan for your agency
        </h2>
        <p className="text-sm text-muted-foreground font-mono">
          Scale your client onboarding without the complexity
        </p>
      </div>

      {errorMessage && (
        <div className="mb-6 p-3 bg-coral/10 border border-coral/20 rounded-lg flex items-start gap-2">
          <AlertCircle className="h-5 w-5 text-danger-ink flex-shrink-0 mt-0.5" />
          <p className="text-sm text-danger-ink">{errorMessage}</p>
        </div>
      )}

      {/* Monthly/Yearly Toggle */}
      <div className="flex flex-col items-center gap-3 mb-8">
        <div className="relative inline-flex items-center gap-2 bg-card border-2 border-border-hard dark:border-white p-1 shadow-brutalist-sm">
          <button
            onClick={() => setBillingInterval('monthly')}
            className={`relative px-6 py-3 min-h-[44px] font-bold uppercase tracking-wider text-xs transition-all ${
              !isYearly
                ? 'bg-coral text-black shadow-[2px_2px_0px_var(--shadow-hard)]'
                : 'text-gray-600 dark:text-gray-400 hover:text-ink dark:hover:text-white'
            }`}
          >
            Monthly
          </button>
          <button
            onClick={() => setBillingInterval('yearly')}
            className={`relative px-6 py-3 min-h-[44px] font-bold uppercase tracking-wider text-xs transition-all ${
              isYearly
                ? 'bg-coral text-black shadow-[2px_2px_0px_var(--shadow-hard)]'
                : 'text-gray-600 dark:text-gray-400 hover:text-ink dark:hover:text-white'
            }`}
          >
            <span className="inline-flex items-center gap-2">
              Yearly
              <span className="rounded-full border border-black/20 bg-white px-2 py-0.5 text-[10px] font-bold tracking-wider text-danger-ink">
                2 Months Free
              </span>
            </span>
          </button>
        </div>
        <p className="text-sm text-gray-500 dark:text-gray-400 font-mono">
          {isYearly
            ? 'Pay for 10 months, get 12. Cancel anytime.'
            : 'Billed monthly. Switch to yearly and get 2 months free.'}
        </p>
      </div>

      {/* Trust signals */}
      <div className="flex flex-wrap items-center gap-4 mb-8 text-xs font-mono text-muted-foreground pb-6 border-b-2 border-border">
        <span className="flex items-center gap-1.5">
          <Check size={14} color="rgb(var(--teal))" />
          Cancel anytime
        </span>
        <span className="flex items-center gap-1.5">
          <Check size={14} color="rgb(var(--teal))" />
          14-day free trial on all plans
        </span>
        <span className="flex items-center gap-1.5">
          <Check size={14} color="rgb(var(--teal))" />
          No credit card for trial
        </span>
        <span className="flex items-center gap-1.5 ml-auto text-success-ink">
          <Check size={14} color="rgb(var(--teal))" />
          Pays for itself in 1 onboard
        </span>
      </div>

      {/* Mobile-Friendly Tier Summary */}
      <div className="md:hidden mb-8">
        <div className="border-2 border-black bg-card p-4 shadow-brutalist-sm">
          <div className="space-y-3 font-mono text-sm">
            <div className="flex justify-between items-center py-2 border-b border-gray-200">
              <div>
                <span className="font-bold text-ink">Starter</span>
                <span className="block text-xs text-gray-500">
                  {PRICING_DISPLAY_TIER_DETAILS.STARTER.persona}
                </span>
              </div>
              <span className="text-gray-600">{isYearly ? '$24/mo' : '$29/mo'}</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-gray-200 bg-coral/5 -mx-2 px-2 rounded">
              <div>
                <span className="font-bold text-danger-ink">Growth</span>
                <span className="text-xs text-danger-ink/70 block">Most Popular</span>
              </div>
              <span className="text-gray-600">{isYearly ? '$66/mo' : '$79/mo'}</span>
            </div>
            <div className="flex justify-between items-center py-2">
              <div>
                <span className="font-bold text-ink">Scale</span>
                <span className="block text-xs text-gray-500">
                  {PRICING_DISPLAY_TIER_DETAILS.SCALE.persona}
                </span>
              </div>
              <span className="text-gray-600">{isYearly ? '$124/mo' : '$149/mo'}</span>
            </div>
          </div>
          <p className="text-xs text-gray-500 mt-4 text-center font-mono">
            Full plan details available on larger screens
          </p>
        </div>
      </div>

      {/* Pricing Grid - Hidden on mobile, shown on md+ */}
      <div className="hidden md:grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-5 pt-2">
        {PRICING_DISPLAY_TIER_ORDER.map((tier, index) => {
          const pricing = tierPricing[tier];
          const tierName = PRICING_DISPLAY_TIER_DETAILS[tier].name;
          const persona = PRICING_DISPLAY_TIER_DETAILS[tier].persona;
          const description = PRICING_DISPLAY_TIER_DETAILS[tier].description;
          const features = tierFeatures[tier];
          const isCurrentTier = tier === currentTier;
          const isRecommended = tier === 'GROWTH'; // Growth is the most popular tier
          const canUpgrade = index > tierIndex;

          // Calculate display price based on billing period
          const yearlyPrice = pricing.yearly;
          const monthlyDisplayPrice = Math.round(pricing.monthly);
          const yearlyMonthlyEquivalent = Math.round(yearlyPrice / 12);
          const displayPrice = isYearly ? yearlyMonthlyEquivalent : monthlyDisplayPrice;
          const alternatePrice = isYearly ? `$${yearlyPrice} billed yearly` : 'billed monthly';

          return (
            <div
              key={tier}
              className={`relative border-2 rounded-lg transition-all ${
                isCurrentTier
                  ? 'border-indigo-500 bg-indigo-50/50 shadow-brutalist-sm'
                  : isRecommended
                  ? 'border-coral bg-card shadow-brutalist'
                  : 'border-slate-300 bg-card hover:shadow-brutalist-sm'
              }`}
            >
              {/* Recommended Badge */}
              {isRecommended && !isCurrentTier && (
                <div className="absolute top-3 right-3 bg-coral text-white border-2 border-black px-2 py-1 font-mono text-xs font-bold uppercase tracking-wider shadow-brutalist-sm z-10">
                  Most Popular
                </div>
              )}

              {/* Tier Header */}
              <div className="p-4 border-b-2 border-border">
                {/* Persona Label */}
                <span className={`font-mono text-[10px] font-bold uppercase tracking-widest ${
                  isRecommended ? 'text-danger-ink' : 'text-gray-500'
                }`}>
                  {persona}
                </span>
                <h3 className="font-dela text-lg text-ink mt-1 mb-0.5">{tierName}</h3>
                <p className="text-xs text-muted-foreground font-mono mb-3">
                  {description}
                </p>
                <div className="flex items-baseline gap-1">
                  <span className="font-dela text-3xl text-ink">
                    ${displayPrice}
                  </span>
                  <span className="text-xs text-muted-foreground font-mono">/mo</span>
                </div>
                <p className="text-xs text-muted-foreground font-mono mt-1">
                  {alternatePrice}
                </p>
              </div>

              {/* Features List */}
              <div className="p-4">
                <ul className="space-y-1 mb-4">
                  {features.map((feature, featureIndex) => (
                    <li
                      key={featureIndex}
                      className="flex flex-col gap-0.5 py-0.5"
                    >
                      <div className="flex items-start gap-2 text-sm">
                        {feature.included ? (
                          <Check
                            size={14}
                            className="mt-0.5 flex-shrink-0"
                            color="rgb(var(--coral))"
                          />
                        ) : (
                          <X size={14} className="mt-0.5 flex-shrink-0 text-muted-foreground dark:text-white/50" />
                        )}
                        <span
                          className={
                            feature.included
                              ? 'text-foreground dark:text-white'
                              : 'line-through text-muted-foreground dark:text-white/50'
                          }
                        >
                          {feature.name}
                        </span>
                      </div>
                      {/* Value context */}
                      {feature.included && feature.value && (
                        <span className="text-xs font-mono text-gray-500 ml-6">
                          {feature.value}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>

                {/* CTA Button */}
                {isCurrentTier ? (
                  <div className="text-center py-2 text-sm font-medium text-indigo-600 bg-indigo-100 rounded-lg border border-indigo-300">
                    Current Plan
                  </div>
                ) : canUpgrade ? (
                  <Button
                    onClick={() => handleUpgrade(tier)}
                    disabled={createCheckout.isPending}
                    variant={isRecommended ? 'brutalist' : 'secondary'}
                    size="sm"
                    className="w-full"
                    rightIcon={<ArrowRight size={16} />}
                  >
                    Start Free Trial
                  </Button>
                ) : (
                  <div className="text-center py-2 text-sm text-muted-foreground border border-border rounded-lg">
                    —
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
