'use client';

import { SignUpButton } from '@/components/lazy-clerk-auth-buttons';
import { Button } from '@/components/ui/button';
import { Globe, Link2, ShieldCheck, Workflow } from 'lucide-react';
import { m } from 'framer-motion';
import { useState } from 'react';
import { Reveal } from '@/components/marketing/reveal';
import { ScheduleDemoModal } from '@/components/marketing/schedule-demo-modal';
import { useAnimationOrchestrator } from '@/hooks/use-animation-orchestrator';

const platforms = ['Meta Ads', 'Google Ads', 'GA4', 'LinkedIn Ads'];

const handleTrialSignup = () => {
  localStorage.setItem('selectedSubscriptionTier', 'STARTER');
  localStorage.setItem('selectedBillingInterval', 'yearly');
};

export function HeroCopyRewriteHeroSection() {
  const [isDemoModalOpen, setIsDemoModalOpen] = useState(false);
  const { shouldAnimate } = useAnimationOrchestrator();

  return (
    <section className="relative min-h-screen overflow-hidden border-b-2 border-black bg-paper">
      <div className="absolute inset-0 opacity-30 pointer-events-none -z-10 diagonal-lines" />
      <div
        className="absolute inset-0 opacity-5 pointer-events-none -z-10"
        style={{
          backgroundImage:
            'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 200 200\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'noiseFilter\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.65\' numOctaves=\'3\' stitchTiles=\'stitch\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23noiseFilter)\' opacity=\'1\'/%3E%3C/svg%3E")',
        }}
      />

      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16 md:py-20">
        <div className="grid lg:grid-cols-12 gap-8 lg:gap-16 items-center">
          <div className="lg:col-span-7 flex flex-col items-start gap-6 z-10 text-center lg:text-left w-full">
            <Reveal delay={0.2}>
              <div className="inline-flex items-center gap-2 border-2 border-black bg-coral text-ink px-4 sm:px-6 py-2 text-[10px] sm:text-xs font-bold uppercase tracking-widest font-mono shadow-brutalist -rotate-2 hover:rotate-0 transition-transform rounded-[0.75rem]">
                <Workflow size={14} />
                Built for small agency owners and operators
              </div>
            </Reveal>

            <Reveal delay={0.3}>
              <h1 className="font-dela text-4xl sm:text-5xl md:text-6xl lg:text-7xl !leading-[1.05] tracking-tight text-ink relative">
                <div className="mb-2 sm:mb-3 md:mb-4">
                  <span className="inline-block">
                    YOUR KICKOFF IS READY.
                  </span>
                </div>
                <div className="mb-2 sm:mb-3 md:mb-4">
                  <span className="inline-block">
                    YOUR CLIENT&apos;S
                  </span>
                </div>
                <div>
                  <span className="inline-block">ACCESS ISN&apos;T.</span>
                </div>
              </h1>
            </Reveal>

            <Reveal delay={0.4}>
              <p className="font-mono text-lg sm:text-xl md:text-2xl max-w-2xl mx-auto lg:mx-0 leading-tight opacity-90 mt-4 text-ink">
                Send one branded link. New clients authorize Meta, Google Ads, GA4,
                and LinkedIn in minutes. Your team starts work the same day.
              </p>
            </Reveal>

            <Reveal delay={0.45}>
              <div className="flex flex-wrap justify-center gap-2 lg:justify-start">
                {platforms.map((platform) => (
                  <span
                    key={platform}
                    className="rounded-[0.65rem] border-2 border-black bg-card px-3 py-2 text-xs font-bold uppercase tracking-wide text-ink shadow-[3px_3px_0px_#000]"
                  >
                    {platform}
                  </span>
                ))}
              </div>
            </Reveal>

            <div className="w-full px-2 sm:px-0">
              <Reveal delay={0.5}>
                <div className="flex flex-col sm:flex-row gap-4 w-full mt-6 self-stretch">
                  <SignUpButton mode="modal">
                    <Button
                      variant="brutalist"
                      size="xl"
                      className="w-full sm:w-auto text-center sm:min-w-[180px] px-8 sm:px-10"
                      onClick={handleTrialSignup}
                    >
                      Start Free Trial
                    </Button>
                  </SignUpButton>
                  <Button
                    variant="secondary"
                    size="xl"
                    className="w-full sm:w-auto text-center sm:min-w-[180px] px-8 sm:px-10"
                    onClick={() => setIsDemoModalOpen(true)}
                  >
                    Schedule Demo
                  </Button>
                </div>
              </Reveal>
            </div>
          </div>

          <div className="hidden lg:block lg:col-span-5 relative mt-12 lg:mt-0 min-h-[400px] lg:min-h-[600px] flex items-center justify-center order-first lg:order-last">
            <div className="absolute inset-0 bg-coral rounded-[3rem] border-[3px] border-black rotate-3 z-0 shadow-brutalist-lg opacity-20" />
            <div className="absolute inset-0 border-2 border-black border-dashed rounded-[3rem] -rotate-3 z-0" />

            <m.div
              initial={shouldAnimate ? { opacity: 0, x: 50, y: 20 } : false}
              animate={shouldAnimate ? { opacity: 1, x: 0, y: 0 } : undefined}
              transition={{ delay: 1.0, duration: 0.6, ease: [0.25, 0.46, 0.45, 0.94] }}
              className="absolute top-10 right-0 z-20 bg-paper border-2 border-black p-4 rounded-xl shadow-brutalist max-w-[220px] rotate-6"
            >
              <div className="flex items-center gap-3">
                <div className="bg-teal/20 p-2 rounded-lg border border-black text-success-ink">
                  <Link2 className="w-6 h-6" />
                </div>
                <div className="text-ink">
                  <div className="font-dela text-sm">One branded request</div>
                  <div className="text-xs font-mono">
                    Clients connect all platforms in minutes
                  </div>
                </div>
              </div>
            </m.div>

            <m.div
              initial={shouldAnimate ? { opacity: 0, scale: 0.8, x: -30 } : false}
              animate={shouldAnimate ? { opacity: 1, scale: 1, x: 0 } : undefined}
              transition={{ delay: 1.2, duration: 0.6, ease: [0.25, 0.46, 0.45, 0.94] }}
              className="absolute bottom-20 -left-4 z-20 bg-ink text-paper border-2 border-black px-4 py-2 rounded-[0.75rem] shadow-brutalist -rotate-6"
            >
              <div className="flex items-center gap-2 font-dela text-sm">
                <ShieldCheck className="w-4 h-4" /> Track status without email
              </div>
            </m.div>

            <m.div
              initial={shouldAnimate ? { opacity: 0, scale: 0.9 } : false}
              animate={shouldAnimate ? { opacity: 1, scale: 1 } : undefined}
              transition={{ delay: 0.8, duration: 0.8 }}
              className="relative bg-paper rounded-[2rem] border-2 border-black overflow-hidden z-10 w-full aspect-[4/5] shadow-brutalist-lg group"
            >
              <div className="absolute inset-0 p-6">
                <div className="flex items-center gap-2 mb-6">
                  <div className="w-3 h-3 rounded-full bg-black" />
                  <div className="w-3 h-3 rounded-full bg-black" />
                  <div className="w-3 h-3 rounded-full bg-black" />
                </div>

                <div className="border-2 border-black bg-card rounded-none p-6 shadow-brutalist-sm">
                  <div className="flex items-center justify-center mb-6">
                    <div className="w-16 h-16 border-2 border-black bg-coral flex items-center justify-center text-white shadow-brutalist relative">
                      <Globe size={32} />
                    </div>
                  </div>
                  <h3 className="text-center font-dela text-2xl md:text-3xl mb-2 text-ink">
                    Client onboarding request
                  </h3>
                  <p className="text-center text-gray-600 mb-6 text-sm font-mono">
                    Choose the platforms you need and send one request.
                  </p>
                  <div className="space-y-3 mb-6">
                    {platforms.map((platform, index) => (
                      <m.div
                        key={platform}
                        initial={shouldAnimate ? { opacity: 0, y: 20 } : false}
                        animate={shouldAnimate ? { opacity: 1, y: 0 } : undefined}
                        transition={{
                          delay: 1.0 + index * 0.15,
                          duration: 0.5,
                          ease: [0.25, 0.46, 0.45, 0.94],
                        }}
                        className="flex items-center justify-between p-3 border-2 border-black bg-gray-50 rounded-none shadow-brutalist-sm"
                      >
                        <span className="text-sm font-bold text-ink">{platform}</span>
                        <div className="w-5 h-5 rounded-[0.5rem] bg-teal/20 border-2 border-black flex items-center justify-center flex-shrink-0">
                          <ShieldCheck size={14} />
                        </div>
                      </m.div>
                    ))}
                  </div>
                  <Button variant="brutalist" className="w-full h-12 text-sm font-bold">
                    Send branded link
                  </Button>
                </div>
              </div>
            </m.div>
          </div>
        </div>
      </div>

      <ScheduleDemoModal isOpen={isDemoModalOpen} onClose={() => setIsDemoModalOpen(false)} />
    </section>
  );
}
