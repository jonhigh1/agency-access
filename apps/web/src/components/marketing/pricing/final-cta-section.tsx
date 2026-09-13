'use client';

import { SignUpButton } from '@/components/lazy-clerk-auth-buttons';
import { Button } from '@/components/ui/button';
import { ArrowRight, Check } from 'lucide-react';
import { m } from 'framer-motion';
import { Reveal } from '../reveal';

// Helper to set Growth tier (STARTER in backend) for trial signup
const handleTrialSignup = () => {
  localStorage.setItem('selectedSubscriptionTier', 'STARTER');
  localStorage.setItem('selectedBillingInterval', 'yearly');
};

export function FinalCTASection() {
  return (
    <section className="py-16 sm:py-20 md:py-24 bg-card relative overflow-hidden">
      {/* Background Accents */}
      <div className="absolute top-0 left-0 w-full h-full opacity-5">
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: 'radial-gradient(circle, #000 2px, transparent 2px)',
            backgroundSize: '40px 40px',
          }}
        />
      </div>

      <div className="container mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <Reveal>
          <m.div
            initial={{ opacity: 0, scale: 0.98 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true, margin: '-50px' }}
            transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
            className="relative border-2 border-black bg-paper p-8 sm:p-12 md:p-16 lg:p-20 overflow-hidden text-center shadow-brutalist-lg max-w-4xl mx-auto"
          >
            {/* Background Accents - Brutalist */}
            <div className="absolute top-0 right-0 w-64 h-64 sm:w-96 sm:h-96 bg-coral/5 -z-0" />
            <div className="absolute bottom-0 left-0 w-48 h-48 sm:w-64 sm:h-64 bg-teal/5 -z-0" />
            <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-coral/5 rounded-full blur-3xl -z-0" />

            <div className="relative z-10">
              {/* Headline */}
              <h2 className="font-dela text-3xl sm:text-4xl md:text-5xl lg:text-6xl tracking-tight mb-6 sm:mb-8 leading-[1.1] text-ink">
                Ready to reclaim{' '}
                <span className="text-danger-ink italic">your time?</span>
              </h2>

              <p className="text-base sm:text-lg md:text-xl lg:text-2xl mb-8 sm:mb-12 text-gray-600 leading-relaxed px-2 font-mono max-w-2xl mx-auto">
                Teams use AuthHub to onboard clients faster and stay out of email threads.
                <span className="block mt-2 text-ink font-sans">
                  Start your free trial today.
                </span>
              </p>

              {/* CTAs */}
              <div className="flex flex-col sm:flex-row gap-4 sm:gap-6 justify-center items-center mb-8 sm:mb-12 px-2">
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
                <a
                  href="https://cal.com/pillar-ai/authhub-demo"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Button
                    variant="secondary"
                    size="xl"
                    className="w-full sm:w-auto font-bold uppercase tracking-wider text-xs"
                  >
                    Schedule a Demo
                  </Button>
                </a>
              </div>

              {/* Trust Badges */}
              <div className="flex flex-wrap items-center justify-center gap-4 sm:gap-6 md:gap-8 text-[10px] sm:text-xs font-black uppercase tracking-wider text-gray-600 font-mono">
                <div className="flex items-center gap-2">
                  <Check size={16} className="text-danger-ink" />
                  <span>14-day free trial</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check size={16} className="text-danger-ink" />
                  <span>No credit card required</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check size={16} className="text-danger-ink" />
                  <span>Cancel anytime</span>
                </div>
              </div>
            </div>
          </m.div>
        </Reveal>
      </div>
    </section>
  );
}
