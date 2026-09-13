'use client';

/**
 * Plan Comparison
 *
 * Tier comparison grid with upgrade CTAs, rendered as a settings group.
 * Matches the marketing site pricing tiers at https://www.authhub.co/pricing
 * Layout contract (KTD8): `lg:grid-cols-2 xl:grid-cols-3`, no horizontal
 * scroll, badge inside card bounds, one shadow (the recommended tier CTA).
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
import { SettingsGroup, SettingsRow } from '../settings-row';
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

  const intervalNote = isYearly
    ? 'Pay for 10 months, get 12. Cancel anytime.'
    : 'Billed monthly. Switch to yearly and get 2 months free.';

  const monthlyEquivalent = (tier: PricingDisplayTier) =>
    isYearly ? Math.round(tierPricing[tier].yearly / 12) : Math.round(tierPricing[tier].monthly);

  const toggleClass = (active: boolean) =>
    `px-6 py-3 min-h-[44px] text-sm font-semibold transition-colors duration-150 ${
      active ? 'bg-ink text-paper' : 'text-muted-foreground hover:text-ink'
    }`;

  return (
    <SettingsGroup
      title="Compare plans"
      description="Find the right plan for your agency. Scale your client onboarding without the complexity."
    >
      {errorMessage && (
        <SettingsRow label="Checkout error">
          <p className="flex items-start gap-2 text-sm text-danger-ink">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{errorMessage}</span>
          </p>
        </SettingsRow>
      )}

      <SettingsRow label="Billing interval" description={intervalNote}>
        <div className="inline-flex max-w-full flex-wrap items-center border border-black bg-card dark:border-white">
          <button type="button" onClick={() => setBillingInterval('monthly')} className={toggleClass(!isYearly)}>
            Monthly
          </button>
          <button type="button" onClick={() => setBillingInterval('yearly')} className={toggleClass(isYearly)}>
            <span className="inline-flex items-center gap-2">
              Yearly
              <span className="rounded-full border border-black/20 bg-paper px-2 py-0.5 font-mono text-[10px] font-bold tracking-wider text-ink">
                2 Months Free
              </span>
            </span>
          </button>
        </div>
      </SettingsRow>

      <SettingsRow label="Included on every plan">
        <ul className="grid gap-x-6 gap-y-2 font-mono text-xs text-muted-foreground sm:grid-cols-2">
          <li className="flex items-center gap-1.5">
            <Check size={14} color="rgb(var(--teal))" />
            Cancel anytime
          </li>
          <li className="flex items-center gap-1.5">
            <Check size={14} color="rgb(var(--teal))" />
            14-day free trial on all plans
          </li>
          <li className="flex items-center gap-1.5">
            <Check size={14} color="rgb(var(--teal))" />
            No credit card for trial
          </li>
          <li className="flex items-center gap-1.5">
            <Check size={14} color="rgb(var(--teal))" />
            Pays for itself in 1 onboard
          </li>
        </ul>
      </SettingsRow>

      {/* Mobile tier summary — full grid appears at md and up */}
      <div className="py-5 md:hidden">
        <div className="border border-border bg-card p-4">
          <div className="space-y-3 font-mono text-sm">
            {PRICING_DISPLAY_TIER_ORDER.map((tier) => {
              const isRecommended = tier === 'GROWTH';
              return (
                <div
                  key={tier}
                  className={`flex items-center justify-between gap-3 py-2 hairline-b last:border-b-0 ${
                    isRecommended ? 'bg-coral/5 -mx-2 px-2' : ''
                  }`}
                >
                  <div className="min-w-0">
                    <span className={`font-bold ${isRecommended ? 'text-danger-ink' : 'text-ink'}`}>
                      {PRICING_DISPLAY_TIER_DETAILS[tier].name}
                    </span>
                    <span className={`block text-xs ${isRecommended ? 'text-danger-ink/70' : 'text-muted-foreground'}`}>
                      {isRecommended ? 'Most Popular' : PRICING_DISPLAY_TIER_DETAILS[tier].persona}
                    </span>
                  </div>
                  <span className="shrink-0 text-muted-foreground">${monthlyEquivalent(tier)}/mo</span>
                </div>
              );
            })}
          </div>
          <p className="mt-4 text-center font-mono text-xs text-muted-foreground">
            Full plan details available on larger screens
          </p>
        </div>
      </div>

      {/* Pricing grid — hidden on mobile, shown on md+ */}
      <div className="hidden md:grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-5 py-5">
        {PRICING_DISPLAY_TIER_ORDER.map((tier, index) => {
          const pricing = tierPricing[tier];
          const tierName = PRICING_DISPLAY_TIER_DETAILS[tier].name;
          const persona = PRICING_DISPLAY_TIER_DETAILS[tier].persona;
          const description = PRICING_DISPLAY_TIER_DETAILS[tier].description;
          const features = tierFeatures[tier];
          const isCurrentTier = Boolean(subscription?.tier) && tier === currentTier;
          const isRecommended = tier === 'GROWTH'; // Growth is the most popular tier
          const canUpgrade = index > tierIndex;

          // Calculate display price based on billing period
          const yearlyPrice = pricing.yearly;
          const displayPrice = monthlyEquivalent(tier);
          const alternatePrice = isYearly ? `$${yearlyPrice} billed yearly` : 'billed monthly';

          return (
            <div
              key={tier}
              className={`relative bg-card ${
                isCurrentTier
                  ? 'border-2 border-ink'
                  : isRecommended
                    ? subscription?.tier
                      ? 'border border-coral'
                      : 'border-2 border-ink'
                    : 'border border-border'
              }`}
            >
              {/* Recommended Badge */}
              {isRecommended && !isCurrentTier && (
                <div className="absolute top-3 right-3 z-10 border border-black bg-ink px-2 py-1 font-mono text-xs font-bold uppercase tracking-wider text-paper">
                  Most Popular
                </div>
              )}

              {/* Tier Header */}
              <div className="p-4 hairline-b">
                {/* Persona Label */}
                <span
                  className="font-mono text-[10px] font-bold uppercase tracking-widest text-muted-foreground"
                >
                  {persona}
                </span>
                <h3 className="mt-1 mb-0.5 font-display text-lg font-semibold text-ink">{tierName}</h3>
                <p className="mb-3 font-mono text-xs text-muted-foreground">{description}</p>
                <div className="flex items-baseline gap-1">
                  <span className="font-display text-3xl font-semibold text-ink">${displayPrice}</span>
                  <span className="font-mono text-xs text-muted-foreground">/mo</span>
                </div>
                <p className="mt-1 font-mono text-xs text-muted-foreground">{alternatePrice}</p>
              </div>

              {/* Features List */}
              <div className="p-4">
                <ul className="mb-4 space-y-1">
                  {features.map((feature, featureIndex) => (
                    <li key={featureIndex} className="flex flex-col gap-0.5 py-0.5">
                      <div className="flex items-start gap-2 text-sm">
                        {feature.included ? (
                          <Check size={14} className="mt-0.5 shrink-0" color="rgb(var(--coral))" />
                        ) : (
                          <X size={14} className="mt-0.5 shrink-0 text-muted-foreground dark:text-white/50" />
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
                        <span className="ml-6 font-mono text-xs text-muted-foreground">{feature.value}</span>
                      )}
                    </li>
                  ))}
                </ul>

                {/* CTA Button */}
                {isCurrentTier ? (
                  <div className="border border-ink py-2 text-center text-sm font-medium text-ink">
                    Current Plan
                  </div>
                ) : canUpgrade ? (
                  <Button
                    onClick={() => handleUpgrade(tier)}
                    disabled={createCheckout.isPending}
                    variant={isRecommended ? 'primary' : 'secondary'}
                    size="sm"
                    className="w-full"
                    rightIcon={<ArrowRight size={16} />}
                  >
                    Start Free Trial
                  </Button>
                ) : (
                  <div className="border border-border py-2 text-center text-sm text-muted-foreground">—</div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </SettingsGroup>
  );
}
