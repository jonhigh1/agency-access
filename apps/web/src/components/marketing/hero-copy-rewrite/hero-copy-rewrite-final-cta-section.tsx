'use client';

import { SignUpButton } from '@/components/lazy-clerk-auth-buttons';
import { Button } from '@/components/ui/button';
import { ArrowRight, Check } from 'lucide-react';
import { m } from 'framer-motion';
import { useEffect, useState } from 'react';
import { ScheduleDemoModal } from '@/components/marketing/schedule-demo-modal';

const handleTrialSignup = () => {
  localStorage.setItem('selectedSubscriptionTier', 'STARTER');
  localStorage.setItem('selectedBillingInterval', 'yearly');
};

export function HeroCopyRewriteFinalCtaSection() {
  const [hasScrolled, setHasScrolled] = useState(false);
  const [isDemoModalOpen, setIsDemoModalOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setHasScrolled(window.scrollY > 50);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <section className="py-16 sm:py-20 md:py-24 lg:py-32 bg-paper relative">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <m.div
          initial={{ opacity: 0, scale: 0.98 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true, margin: '-50px' }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="relative rounded-none border-2 border-black bg-card p-8 sm:p-12 md:p-16 lg:p-24 overflow-hidden text-center shadow-brutalist-lg"
        >
          <div className="absolute top-0 right-0 w-64 h-64 sm:w-96 sm:h-96 bg-coral/5 -z-0" />
          <div className="absolute bottom-0 left-0 w-48 h-48 sm:w-64 sm:h-64 bg-teal/5 -z-0" />

          <div className="relative z-10 max-w-3xl mx-auto">
            <h2 className="font-dela text-3xl sm:text-4xl md:text-5xl lg:text-6xl tracking-tight mb-6 sm:mb-8 leading-[1.1] text-ink">
              The agency that starts work on day one.
            </h2>
            <p className="text-base sm:text-lg md:text-xl lg:text-2xl mb-8 sm:mb-12 text-gray-600 leading-relaxed px-2 font-mono">
              Send your first branded request, get access in minutes, and start
              the work you were hired to do.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 sm:gap-6 justify-center items-center mb-8 sm:mb-12 px-2">
              <SignUpButton mode="modal">
                <Button
                  variant="brutalist"
                  size="xl"
                  className="w-full sm:w-auto px-8 sm:px-12"
                  rightIcon={<ArrowRight size={20} />}
                  onClick={handleTrialSignup}
                >
                  Start Free Trial
                </Button>
              </SignUpButton>
              <Button
                variant="secondary"
                size="xl"
                className="w-full sm:w-auto font-bold uppercase tracking-wider text-xs"
                onClick={() => setIsDemoModalOpen(true)}
              >
                Schedule Demo
              </Button>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-4 sm:gap-6 md:gap-8 text-[10px] sm:text-xs font-black uppercase tracking-wider text-gray-600 font-mono">
              <div className="flex items-center gap-1.5 sm:gap-2">
                <Check size={14} className="text-danger-ink sm:hidden" />
                <Check size={16} className="text-danger-ink hidden sm:block" />
                <span className="hidden xs:inline">No credit card required</span>
                <span className="xs:hidden">No card required</span>
              </div>
              <div className="flex items-center gap-1.5 sm:gap-2">
                <Check size={14} className="text-danger-ink sm:hidden" />
                <Check size={16} className="text-danger-ink hidden sm:block" />
                <span>14-day free trial</span>
              </div>
              <div className="flex items-center gap-1.5 sm:gap-2">
                <Check size={14} className="text-danger-ink sm:hidden" />
                <Check size={16} className="text-danger-ink hidden sm:block" />
                <span>Cancel anytime</span>
              </div>
            </div>
          </div>
        </m.div>
      </div>

      <div
        className={`fixed bottom-0 left-0 right-0 z-40 p-4 bg-gradient-to-t from-white via-white to-transparent md:hidden pointer-events-none transition-all duration-300 ${
          hasScrolled ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-full pointer-events-none'
        }`}
      >
        <div className="pointer-events-auto">
          <SignUpButton mode="modal">
            <Button
              variant="brutalist"
              size="lg"
              className="w-full touch-feedback-bounce"
              rightIcon={<ArrowRight size={18} />}
              onClick={handleTrialSignup}
            >
              Start Free Trial
            </Button>
          </SignUpButton>
        </div>
      </div>

      <ScheduleDemoModal isOpen={isDemoModalOpen} onClose={() => setIsDemoModalOpen(false)} />
    </section>
  );
}
