'use client';

import { SignUpButton } from '@/components/lazy-clerk-auth-buttons';
import { Button } from '@/components/ui/button';
import { ArrowRight, Check, X } from 'lucide-react';
import { m } from 'framer-motion';
import { buildPlanSelectedProps, trackPlanSelected } from '@/lib/analytics/billing';

interface Feature {
  name: string;
  included: boolean;
  value?: string; // Why this matters - optional context
}

interface PricingTierCardProps {
  // Supports both display aliases and backend tiers during naming transition.
  tier?: 'GROWTH' | 'SCALE' | 'STARTER' | 'AGENCY'; // Used for tier selection
  name: string;
  description: string;
  persona?: string; // Who this is for - e.g., "For small teams"
  yearlyPrice: number;
  monthlyPrice: number;
  isYearly: boolean;
  isPopular?: boolean;
  isPro?: boolean;
  hasTrial?: boolean; // Whether this tier has a free trial (default: true for paid tiers)
  features: Feature[];
  buttonText: string;
  buttonVariant?: 'brutalist' | 'secondary';
  billingInterval?: 'monthly' | 'yearly'; // Pass through for checkout
}

export function PricingTierCard({
  tier,
  name,
  description,
  persona,
  yearlyPrice,
  monthlyPrice,
  isYearly,
  isPopular = false,
  isPro = false,
  hasTrial = true, // Default to true for paid tiers
  features,
  buttonText,
  buttonVariant = 'brutalist',
  billingInterval = 'monthly',
}: PricingTierCardProps) {
  // AGENCY is the pre-rename alias for the SCALE tier.
  const backendTier = tier === 'AGENCY' ? 'SCALE' : tier;

  // Store selected tier and billing interval when user clicks CTA
  const handleTierSelect = () => {
    if (backendTier) {
      localStorage.setItem('selectedSubscriptionTier', backendTier);
      localStorage.setItem('selectedBillingInterval', billingInterval);

      trackPlanSelected({
        ...buildPlanSelectedProps(backendTier, billingInterval, 'pricing'),
      });

      // Notify providers to update Clerk sign-up subtitle dynamically
      window.dispatchEvent(new CustomEvent('tierSelected', { detail: { tier: backendTier, displayName: name } }));
    }
  };
  const yearlyDiscountedPrice = yearlyPrice;
  const monthlyDisplayPrice = Math.round(monthlyPrice);
  const yearlyMonthlyEquivalent = Math.round(yearlyDiscountedPrice / 12);
  const displayPrice = isYearly ? yearlyMonthlyEquivalent : monthlyDisplayPrice;
  const period = isYearly ? '/mo equiv.' : '/mo';
  const alternatePrice = isYearly
    ? `$${monthlyDisplayPrice}/mo billed monthly · $${yearlyDiscountedPrice}/yr billed yearly`
    : `$${yearlyMonthlyEquivalent}/mo equiv. with annual billing · $${yearlyDiscountedPrice}/yr`;

  const cardBaseClasses = `relative border-2 ${
    isPro
      ? 'bg-ink border-teal text-paper'
      : 'bg-card border-black'
  }`;

  const textColorClass = isPro ? 'text-paper' : 'text-ink';
  const textColorMutedClass = isPro ? 'text-gray-400' : 'text-gray-600';

  return (
    <m.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5 }}
      className={`${cardBaseClasses} shadow-brutalist p-6 sm:p-8 flex flex-col`}
    >
      {/* Most Popular Badge */}
      {isPopular && (
        <div className="absolute -top-3 -right-3 bg-coral text-white border-2 border-black px-3 py-1.5 font-mono text-xs font-bold uppercase tracking-wider shadow-brutalist-sm rotate-3 z-10">
          Most Popular
        </div>
      )}

      {/* Persona Label */}
      {persona && (
        <div className={`mb-3 inline-block`}>
          <span className={`font-mono text-[10px] font-bold uppercase tracking-widest ${
            isPopular ? 'text-danger-ink' : 'text-gray-500'
          }`}>
            {persona}
          </span>
        </div>
      )}

      {/* Tier Name & Description */}
      <div className="mb-6">
        <h3 className={`font-dela text-2xl sm:text-3xl mb-2 ${textColorClass}`}>
          {name}
        </h3>
        <p className={`text-sm font-mono ${textColorMutedClass}`}>
          {description}
        </p>
      </div>

      {/* Price */}
      <div className="mb-6">
        <div className="flex items-baseline gap-2">
          <span className={`font-dela text-4xl sm:text-5xl ${textColorClass}`}>
            ${displayPrice}
          </span>
          <span className={`font-mono text-sm ${textColorMutedClass}`}>
            {period}
          </span>
        </div>
        <div className={`font-mono text-xs ${textColorMutedClass} mt-1`}>
          {alternatePrice}
        </div>
      </div>

      {/* CTA Button */}
      <div className="mb-8">
        <SignUpButton mode="modal">
          <Button
            variant={buttonVariant}
            size="lg"
            className="w-full"
            rightIcon={<ArrowRight size={18} />}
            onClick={handleTierSelect}
          >
            {buttonText}
          </Button>
        </SignUpButton>
      </div>

      {/* Features List */}
      <div className="flex-1">
        <ul className="space-y-1 sm:space-y-1.5">
          {features.map((feature, index) => (
            <li
              key={index}
              className={`flex flex-col gap-0.5 py-1 ${
                feature.included ? '' : 'opacity-50'
              }`}
            >
              <div className="flex items-start gap-3">
                {feature.included ? (
                  <Check
                    size={16}
                    className="mt-0.5 flex-shrink-0"
                    style={{ color: isPro ? 'rgb(var(--teal))' : 'rgb(var(--coral))' }}
                  />
                ) : (
                  <X size={16} className="mt-0.5 flex-shrink-0 text-gray-400" />
                )}
                <span className={`text-sm ${
                  feature.included
                    ? (isPro ? 'text-gray-300' : 'text-gray-700')
                    : 'line-through text-gray-400'
                }`}>
                  {feature.name}
                </span>
              </div>
              {/* Value context - only show for included features with value */}
              {feature.included && feature.value && (
                <span className={`text-xs font-mono ml-7 ${
                  isPro ? 'text-gray-500' : 'text-gray-500'
                }`}>
                  {feature.value}
                </span>
              )}
            </li>
          ))}
        </ul>
      </div>

      {/* Trust Badges - Show for paid tiers with trial */}
      {hasTrial && (
        <div className={`mt-6 pt-6 border-t-2 ${isPro ? 'border-gray-700' : 'border-black'} space-y-2`}>
        <div className={`flex items-center gap-2 text-xs font-mono ${textColorMutedClass}`}>
          <Check
            size={12}
            style={{ color: isPro ? 'rgb(var(--teal))' : 'rgb(var(--coral))' }}
          />
          <span>14-day free trial</span>
        </div>
        <div className={`flex items-center gap-2 text-xs font-mono ${textColorMutedClass}`}>
          <Check
            size={12}
            style={{ color: isPro ? 'rgb(var(--teal))' : 'rgb(var(--coral))' }}
          />
          <span>Cancel anytime</span>
        </div>
        <div className={`flex items-center gap-2 text-xs font-mono ${textColorMutedClass}`}>
          <Check
            size={12}
            style={{ color: isPro ? 'rgb(var(--teal))' : 'rgb(var(--coral))' }}
          />
          <span>No credit card required</span>
        </div>
      </div>
      )}
    </m.div>
  );
}
