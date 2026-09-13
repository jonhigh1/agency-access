'use client';

import { SignUpButton } from '@/components/lazy-clerk-auth-buttons';
import { Button } from '@/components/ui/button';
import { Globe, ShieldCheck, Zap, TrendingUp, Check } from 'lucide-react';
import { m } from 'framer-motion';
import { Reveal } from './reveal';
import { ScheduleDemoModal } from './schedule-demo-modal';
import { useState } from 'react';
import { useAnimationOrchestrator } from '@/hooks/use-animation-orchestrator';

// Helper to set Growth tier (STARTER in backend) for trial signup
const handleTrialSignup = () => {
  localStorage.setItem('selectedSubscriptionTier', 'STARTER');
  localStorage.setItem('selectedBillingInterval', 'yearly');
};

export function HeroSection() {
  const [isDemoModalOpen, setIsDemoModalOpen] = useState(false);
  const { shouldAnimate } = useAnimationOrchestrator();

  return (
    <section className="relative min-h-screen overflow-hidden bg-paper border-b-2 border-black">
      {/* Diagonal lines background pattern */}
      <div className="absolute inset-0 opacity-30 pointer-events-none -z-10 diagonal-lines" />

      {/* Noise texture overlay */}
      <div className="absolute inset-0 opacity-5 pointer-events-none -z-10"
           style={{
             backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)' opacity='1'/%3E%3C/svg%3E")`
           }}
      />

      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16 md:py-20">
        <div className="grid lg:grid-cols-12 gap-8 lg:gap-16 items-center">
          {/* Left Column - Content */}
          <div className="lg:col-span-7 flex flex-col items-start gap-6 z-10 text-center lg:text-left w-full">
            {/* Badge - Tilted with rotation */}
            <Reveal delay={0.2}>
              <div className="inline-flex items-center gap-2 border-2 border-black bg-ink text-paper px-4 sm:px-6 py-2 text-[10px] sm:text-xs font-bold uppercase tracking-widest font-mono shadow-brutalist -rotate-2 hover:rotate-0 transition-transform rounded-[0.75rem]">
                <Globe size={14} />
                Client Access Platform
              </div>
            </Reveal>

            {/* Main Headline - Tighter leading */}
            <Reveal delay={0.3}>
              <h1 className="font-dela text-4xl sm:text-5xl md:text-6xl lg:text-7xl !leading-[1.1] tracking-tight text-ink relative">
                Send one link. Your client is live in{' '}
                <span className="relative inline-block">
                  <span className="text-danger-ink">5 minutes.</span>
                  <svg
                    className="absolute -bottom-2 md:-bottom-3 left-0 w-full"
                    viewBox="0 0 200 16"
                    fill="none"
                    style={{ marginTop: '8px' }}
                  >
                    <m.path
                      d="M2 10Q100 -2 198 10"
                      stroke="rgb(var(--coral))"
                      strokeWidth="6"
                      strokeLinecap="round"
                      initial={shouldAnimate ? { pathLength: 0 } : false}
                      animate={shouldAnimate ? { pathLength: 1 } : undefined}
                      transition={{ duration: 1.5, delay: 1 }}
                    />
                  </svg>
                </span>
              </h1>
            </Reveal>

            {/* Subheadline */}
            <Reveal delay={0.4}>
              <p className="font-mono text-lg sm:text-xl md:text-2xl max-w-xl mx-auto lg:mx-0 leading-tight opacity-90 mt-4 text-ink">
                Your client authorizes Meta, Google, GA4, LinkedIn, and more through one link. Your team and your AI agents start work the same day.
              </p>
            </Reveal>

            {/* CTAs */}
            <div className="w-full px-2 sm:px-0">
              <Reveal delay={0.5}>
                <div className="flex flex-col sm:flex-row gap-4 sm:gap-4 w-full mt-6 self-stretch">
                  <SignUpButton mode="modal">
                    <Button
                      variant="brutalist"
                      size="xl"
                      className="w-full sm:w-auto text-center sm:min-w-[180px] px-8 sm:px-10"
                      rightIcon={<Zap size={18} />}
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

            {/* Hallmark · component: trust strip · genre: brutalist/editorial · theme: project tokens
             * states: static (non-interactive) · contrast: pass
             * copy: real customers only — no invented metrics */}
            <Reveal delay={0.6}>
              <div className="w-full px-2 sm:px-0 mt-4 pt-5 border-t border-black/10">
                <div className="flex flex-wrap items-baseline justify-center lg:justify-start gap-x-5 sm:gap-x-7 gap-y-2">
                  <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-ink/40">
                    Trusted by marketing agencies
                  </span>
                  <span aria-hidden="true" className="text-ink/20 font-mono text-xs">/</span>
                  <span className="font-dela text-base sm:text-lg tracking-tight text-ink/50">
                    Pillar AI
                  </span>
                  <span className="font-mono text-xs sm:text-sm uppercase tracking-[0.14em] text-ink/50">
                    Elite Edge Media
                  </span>
                  <span className="text-base sm:text-lg font-semibold tracking-tight text-ink/50">
                    Digital One
                  </span>
                </div>
              </div>
            </Reveal>

          </div>

          {/* Right Column - Dashboard Mockup with Floating Cards - Hidden on mobile */}
          <div className="hidden lg:block lg:col-span-5 relative mt-12 lg:mt-0 min-h-[400px] lg:min-h-[600px] flex items-center justify-center order-first lg:order-last">
            {/* Background shapes */}
            <div
              className="absolute inset-0 bg-acid rounded-[3rem] border-[3px] border-black rotate-3 z-0 shadow-brutalist-lg opacity-20 animate-pulse"
              style={{ animationDuration: '4s' }}
            />
            <div className="absolute inset-0 border-2 border-black border-dashed rounded-[3rem] -rotate-3 z-0" />

            {/* Floating Card 1 - Top Right */}
            <m.div
              initial={shouldAnimate ? { opacity: 0, x: 50, y: 20 } : false}
              animate={shouldAnimate ? { opacity: 1, x: 0, y: 0 } : undefined}
              transition={{ delay: 1.0, duration: 0.6, ease: [0.25, 0.46, 0.45, 0.94] }}
              className="absolute top-10 right-0 z-20 bg-paper border-2 border-black p-4 rounded-xl shadow-brutalist max-w-[200px] rotate-6 group"
            >
              <div className="animate-float-pillar">
                <div className="flex items-center gap-3">
                  <div className="bg-teal/20 p-2 rounded-lg border border-black text-success-ink">
                    <TrendingUp className="w-6 h-6" />
                  </div>
                  <div className="text-ink">
                    <div className="font-dela text-sm">Client Activation</div>
                    <div className="text-xs font-mono">Live in 5 Minutes</div>
                  </div>
                </div>
              </div>
            </m.div>

            {/* Floating Card 2 - Bottom Left */}
            <m.div
              initial={shouldAnimate ? { opacity: 0, scale: 0.8, x: -30 } : false}
              animate={shouldAnimate ? { opacity: 1, scale: 1, x: 0 } : undefined}
              transition={{ delay: 1.2, duration: 0.6, ease: [0.25, 0.46, 0.45, 0.94] }}
              className="absolute bottom-20 -left-4 z-20 bg-ink text-paper border-2 border-black px-4 py-2 rounded-[0.75rem] shadow-brutalist -rotate-6"
            >
              <div className="animate-float-pillar" style={{ animationDelay: '1s' }}>
                <div className="flex items-center gap-2 font-dela text-sm">
                  <Check className="w-4 h-4" /> Built for Humans + Agents
                </div>
              </div>
            </m.div>

            {/* Main Dashboard Preview */}
            <m.div
              initial={shouldAnimate ? { opacity: 0, scale: 0.9 } : false}
              animate={shouldAnimate ? { opacity: 1, scale: 1 } : undefined}
              transition={{ delay: 0.8, duration: 0.8 }}
              className="relative bg-paper rounded-[2rem] border-2 border-black overflow-hidden z-10 w-full aspect-[4/5] shadow-brutalist-lg group"
            >
              {/* Dashboard mockup */}
              <div className="absolute inset-0 p-6">
                {/* Window Controls */}
                <div className="flex items-center gap-2 mb-6">
                  <div className="w-3 h-3 rounded-full bg-black" />
                  <div className="w-3 h-3 rounded-full bg-black" />
                  <div className="w-3 h-3 rounded-full bg-black" />
                </div>

                {/* OAuth Authorization Card */}
                <div className="border-2 border-black bg-card rounded-none p-6 shadow-brutalist-sm">
                  <div className="flex items-center justify-center mb-6">
                    <div className="w-16 h-16 border-2 border-black bg-coral flex items-center justify-center text-white shadow-brutalist relative">
                      <Globe size={32} />
                      <div className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-acid border-2 border-black animate-pulse" />
                    </div>
                  </div>
                   <h3 className="text-center font-dela text-2xl md:text-3xl mb-2 text-ink">Client Access Request</h3>
                  <p className="text-center text-gray-600 mb-6 text-sm font-mono">AuthHub is requesting access to:</p>
                  <div className="space-y-3 mb-6">
                    {['Meta Ads', 'Google Ads', 'GA4', 'LinkedIn Ads'].map((p, i) => (
                      <m.div
                        key={p}
                        initial={shouldAnimate ? { opacity: 0, y: 20 } : false}
                        animate={shouldAnimate ? { opacity: 1, y: 0 } : undefined}
                        transition={{ delay: 1.0 + (i * 0.15), duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] }}
                        className="flex items-center justify-between p-3 border-2 border-black bg-gray-50 rounded-none shadow-brutalist-sm"
                      >
                        <span className="text-sm font-bold text-ink">{p}</span>
                        <div className="w-5 h-5 rounded-[0.5rem] bg-teal/20 border-2 border-black flex items-center justify-center flex-shrink-0">
                          <ShieldCheck size={14} />
                        </div>
                      </m.div>
                    ))}
                  </div>
                  <Button variant="brutalist" className="w-full h-12 text-sm font-bold group-hover:shadow-none group-hover:translate-x-[2px] group-hover:translate-y-[2px] transition-all">
                    Grant Access
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
