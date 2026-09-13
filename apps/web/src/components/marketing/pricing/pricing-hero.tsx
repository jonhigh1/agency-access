'use client';

import { SignUpButton } from '@/components/lazy-clerk-auth-buttons';
import { Button } from '@/components/ui/button';
import { ArrowRight } from 'lucide-react';
import { m } from 'framer-motion';
import { SocialProofSection } from '../social-proof-section';

// Helper to set Growth tier (STARTER in backend) for trial signup
const handleTrialSignup = () => {
  localStorage.setItem('selectedSubscriptionTier', 'STARTER');
  localStorage.setItem('selectedBillingInterval', 'yearly');
};

export function PricingHero() {
  return (
    <section className="pt-10 sm:pt-12 md:pt-16 lg:pt-20 pb-12 sm:pb-16 bg-paper relative overflow-hidden">
      {/* Background Pattern - Diagonal Lines */}
      <div className="absolute inset-0 opacity-5 pointer-events-none">
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: 'repeating-linear-gradient(45deg, #000 0, #000 1px, transparent 0, transparent 50%)',
            backgroundSize: '20px 20px',
          }}
        />
      </div>

      <div className="container mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <m.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="text-center max-w-4xl mx-auto"
        >
          {/* Badge */}
          <m.div
            initial={{ opacity: 0, rotate: -3 }}
            animate={{ opacity: 1, rotate: -3 }}
            transition={{ delay: 0.1, duration: 0.5 }}
            className="inline-block mb-6"
          >
            <div className="inline-flex items-center gap-2 bg-coral text-white border-2 border-black px-4 py-2 font-mono text-xs font-bold uppercase tracking-widest shadow-brutalist">
              <span>Simple Pricing</span>
            </div>
          </m.div>

          {/* Headline */}
          <h1 className="font-dela text-4xl sm:text-5xl md:text-6xl lg:text-7xl tracking-tight mb-6 sm:mb-8 leading-[1.1] text-ink">
            AuthHub Pricing: Automate{' '}
            <span className="text-danger-ink italic">OAuth Client Onboarding</span>{' '}
            in 5 Minutes
          </h1>

          {/* Subheading */}
          <p className="text-base sm:text-lg md:text-xl lg:text-2xl mb-8 sm:mb-12 text-gray-600 leading-relaxed px-2 font-mono max-w-3xl mx-auto">
            Replace 2-3 days of manual client onboarding with a 5-minute automated flow.
            <span className="block mt-2 text-ink font-sans">
              Transparent pricing. No hidden fees. Cancel anytime.
            </span>
          </p>

          {/* CTAs */}
          <m.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.5 }}
            className="flex flex-col sm:flex-row gap-4 sm:gap-6 justify-center items-center mb-12 sm:mb-16 px-2"
          >
            <SignUpButton mode="modal">
              <Button
                variant="brutalist"
                size="xl"
                className="w-full sm:w-auto px-8 sm:px-12"
                rightIcon={<ArrowRight size={20} />}
                onClick={handleTrialSignup}
              >
                Start 14-Day Free Trial
              </Button>
            </SignUpButton>
            <Button
              variant="secondary"
              size="xl"
              className="w-full sm:w-auto font-bold uppercase tracking-wider text-xs"
              onClick={() => {
                const calculatorSection = document.getElementById('savings-calculator');
                calculatorSection?.scrollIntoView({ behavior: 'smooth' });
              }}
            >
              Calculate Your Savings
            </Button>
          </m.div>

        </m.div>
      </div>

      {/* Social Proof - Full Width */}
      <m.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5, duration: 0.6 }}
        className="w-full"
      >
        <SocialProofSection />
      </m.div>
    </section>
  );
}
