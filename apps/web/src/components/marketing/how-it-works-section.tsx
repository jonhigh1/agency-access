'use client';

import { m, useScroll, useTransform } from 'framer-motion';
import { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { SignUpButton } from '@/components/lazy-clerk-auth-buttons';
import { ArrowRight, Clock, Check, Zap, Link2, Shield, Users, BarChart3 } from 'lucide-react';
import { Reveal } from './reveal';
import { ScheduleDemoModal } from './schedule-demo-modal';
import { useAnimationOrchestrator } from '@/hooks/use-animation-orchestrator';

// Helper to set Growth tier (STARTER in backend) for trial signup
const handleTrialSignup = () => {
  localStorage.setItem('selectedSubscriptionTier', 'STARTER');
  localStorage.setItem('selectedBillingInterval', 'yearly');
};

const steps = [
  {
    number: 1,
    title: 'Generate Link',
    description: 'Select platforms (Meta, Google, LinkedIn) and get your branded authorization link in seconds.',
    icon: Link2,
    color: 'coral',
    time: '30 seconds',
  },
  {
    number: 2,
    title: 'Client Authorizes',
    description: 'Send the link. Client clicks and grants access through our secure OAuth flow.',
    icon: Shield,
    color: 'coral',
    time: '2 minutes',
  },
  {
    number: 3,
    title: 'Select Assets',
    description: 'Client chooses which ad accounts, pages, and properties to share with your agency.',
    icon: Users,
    color: 'teal',
    time: '1 minute',
  },
  {
    number: 4,
    title: 'Instant Access',
    description: 'Start working immediately. Access never expires, no more chasing clients for permissions.',
    icon: BarChart3,
    color: 'coral',
    time: 'Permanent',
  },
];

export function HowItWorksSection() {
  const sectionRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ['start end', 'end start'],
  });

  const lineHeight = useTransform(scrollYProgress, [0, 1], ['0%', '100%']);
  const [hoveredStep, setHoveredStep] = useState<number | null>(null);
  const [isDemoModalOpen, setIsDemoModalOpen] = useState(false);
  const { shouldAnimate } = useAnimationOrchestrator();

  return (
    <section
      id="how-it-works"
      ref={sectionRef}
      className="py-16 sm:py-20 md:py-24 lg:py-32 relative overflow-hidden bg-paper border-y-2 border-black"
    >
      {/* Checkerboard background with coral accents */}
      <div
        className="absolute inset-0 opacity-[0.02] -z-10"
        style={{
          backgroundImage: `
            repeating-conic-gradient(#000 0% 25%, transparent 0% 50%)
          `,
          backgroundSize: '40px 40px',
        }}
      />

      {/* Animated gradient blob */}
      <m.div
        className="absolute top-20 right-10 w-96 h-96 bg-coral/5 rounded-full blur-3xl -z-10"
        initial={shouldAnimate ? { scale: 1, opacity: 0.05 } : false}
        animate={shouldAnimate ? {
          scale: [1, 1.2, 1],
          opacity: [0.05, 0.1, 0.05],
        } : undefined}
        transition={{
          duration: 8,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
      />

      {/* Noise texture overlay */}
      <div
        className="absolute inset-0 opacity-5 pointer-events-none -z-10"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
        }}
      />

      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          {/* Section Header */}
          <Reveal delay={0.2}>
            <div className="text-center mb-12 sm:mb-16 md:mb-20">
              {/* Badge */}
              <div className="inline-flex items-center gap-2 border-2 border-black bg-ink text-paper px-4 sm:px-6 py-2 text-[10px] sm:text-xs font-bold uppercase tracking-widest font-mono shadow-brutalist rounded-[0.75rem] mb-6 sm:mb-8">
                <Clock size={14} />
                5-Minute Setup
              </div>

              {/* Main headline */}
              <h2 className="font-dela text-4xl sm:text-5xl md:text-6xl lg:text-7xl tracking-tight mb-4 sm:mb-6 text-ink leading-[1.1]">
                <span className="inline-block">From 47 emails</span>
                <br />
                <span className="text-danger-ink">to 1 link</span>
              </h2>

              {/* Subheadline */}
              <p className="font-mono text-base sm:text-lg md:text-xl max-w-2xl mx-auto text-gray-600 leading-relaxed">
                Replace three days of back-and-forth emails with a single link. Your client authorizes their platforms. You get instant access. Everyone wins.
              </p>
            </div>
          </Reveal>

          {/* Marquee Banner - Time Savings */}
          <Reveal delay={0.3}>
            <div className="mb-12 sm:mb-16 md:mb-20 overflow-hidden border-y-2 border-black bg-ink py-3">
              <div className="flex whitespace-nowrap animate-marquee">
                {[...Array(6)].map((_, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-4 mx-8 text-paper font-dela text-xl sm:text-2xl"
                  >
                    <span className="text-danger-ink">2-3 DAYS</span>
                    <ArrowRight size={16} className="text-danger-ink" />
                    <span className="font-mono text-sm">becomes</span>
                    <ArrowRight size={16} className="text-danger-ink" />
                    <span className="text-danger-ink">5 MINUTES</span>
                  </div>
                ))}
              </div>
            </div>
          </Reveal>

          {/* Timeline Layout */}
          <div className="relative">
            {/* Vertical Progress Line */}
            <div className="absolute left-4 sm:left-8 md:left-1/2 top-0 bottom-0 w-1 bg-gray-200 -z-10 hidden md:block" />
            <m.div
              className="absolute left-4 sm:left-8 md:left-1/2 top-0 w-1 bg-coral -z-10 hidden md:block origin-top"
              style={{ height: lineHeight }}
            />

            {/* Steps */}
            <div className="space-y-8 sm:space-y-12">
              {steps.map((step, index) => (
                <Reveal key={step.number} delay={0.4 + index * 0.1}>
                  <m.div
                    initial={shouldAnimate ? { opacity: 0, y: 50 } : false}
                    whileInView={shouldAnimate ? { opacity: 1, y: 0 } : undefined}
                    viewport={{ once: true, margin: '-50px' }}
                    transition={{ delay: index * 0.15, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
                    className={`relative flex flex-col ${index % 2 === 0 ? 'md:flex-row' : 'md:flex-row-reverse'} items-center gap-6 sm:gap-8`}
                    onMouseEnter={() => setHoveredStep(step.number)}
                    onMouseLeave={() => setHoveredStep(null)}
                  >
                    {/* Step Number Indicator */}
                    <div className="hidden md:flex absolute left-1/2 -translate-x-1/2 w-12 h-12 items-center justify-center z-20">
                      <m.div
                        className="w-12 h-12 border-2 border-black bg-card flex items-center justify-center shadow-brutalist font-dela text-lg font-black text-ink"
                        animate={{
                          backgroundColor: hoveredStep === step.number ? `rgb(var(--${step.color}))` : '#fff',
                          color: hoveredStep === step.number ? '#fff' : 'rgb(var(--ink))',
                          scale: hoveredStep === step.number ? 1.1 : 1,
                        }}
                        transition={{ duration: 0.2 }}
                      >
                        {step.number}
                      </m.div>
                    </div>

                    {/* Content Card */}
                    <div className={`flex-1 w-full ${index % 2 === 0 ? 'md:pr-16' : 'md:pl-16'}`}>
                      <m.div
                        className="bg-card border-2 border-black p-6 sm:p-8 rounded-none shadow-brutalist hover:shadow-brutalist-lg hover:-translate-x-1 hover:-translate-y-1 transition-all duration-200 relative group"
                        whileHover={{ y: -4, boxShadow: '8px 8px 0px #000' }}
                      >
                        {/* Time Badge */}
                        <div
                          className={`absolute -top-3 ${index % 2 === 0 ? 'md:-right-3' : 'md:-left-3'} right-3 border-2 border-black px-3 py-1 text-[10px] font-black uppercase tracking-wider font-mono text-white shadow-brutalist-sm`}
                          style={{ backgroundColor: `rgb(var(--${step.color}))` }}
                        >
                          {step.time}
                        </div>

                        {/* Icon & Title */}
                        <div className="flex items-start gap-4 mb-4">
                          <div
                            className="p-3 border-2 border-black flex-shrink-0"
                            style={{ backgroundColor: `rgb(var(--${step.color}) / 0.1)` }}
                          >
                            <step.icon
                              size={24}
                              className={`text-${step.color}`}
                              style={{ color: `rgb(var(--${step.color}))` }}
                            />
                          </div>
                          <div className="flex-1">
                            <h3 className="font-dela text-2xl sm:text-3xl font-black text-ink mb-2 uppercase tracking-tight">
                              {step.title}
                            </h3>
                            <p className="text-gray-600 leading-relaxed font-mono text-sm sm:text-base">
                              {step.description}
                            </p>
                          </div>
                        </div>

                        {/* Visual Preview (shown on hover) */}
                        <m.div
                          initial={shouldAnimate ? { opacity: 0, height: 0 } : false}
                          animate={{
                            opacity: hoveredStep === step.number ? 1 : 0,
                            height: hoveredStep === step.number ? 'auto' : 0,
                          }}
                          className="overflow-hidden"
                        >
                          <div className="pt-4 border-t-2 border-black/10 mt-4">
                            <div className="bg-gray-50 border-2 border-black/20 p-4 rounded-none">
                              <div className="flex items-center gap-2 text-xs font-mono text-gray-500 mb-2">
                                <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                                LIVE PREVIEW
                              </div>
                              <div className="space-y-2">
                                <div className="h-2 bg-black/10 rounded w-3/4" />
                                <div className="h-2 bg-black/10 rounded w-1/2" />
                                <div className="h-2 bg-black/10 rounded w-2/3" />
                              </div>
                            </div>
                          </div>
                        </m.div>

                        {/* Hover Arrow */}
                        <m.div
                          className="absolute -bottom-2 -right-2 w-10 h-10 bg-coral border-2 border-black flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                          animate={{ rotate: hoveredStep === step.number ? 45 : 0 }}
                        >
                          <ArrowRight size={16} className="text-black" />
                        </m.div>
                      </m.div>
                    </div>

                    {/* Empty div for layout balance */}
                    <div className="flex-1 hidden md:block" />
                  </m.div>
                </Reveal>
              ))}
            </div>
          </div>

          {/* Stats Bar - Animated Counters */}
          <Reveal delay={1.2}>
            <div className="mt-16 sm:mt-20 md:mt-24 grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6">
              {[
                { value: 'Auto', label: 'Token Refresh', icon: Check, color: 'teal' },
                { value: '8+', label: 'Platforms', icon: Zap, color: 'coral' },
                { value: '1 Link', label: 'Per Client', icon: Users, color: 'coral' },
                { value: '5 min', label: 'Avg Setup', icon: Clock, color: 'coral' },
              ].map((stat, i) => (
                <m.div
                  key={stat.label}
                  initial={shouldAnimate ? { opacity: 0, y: 20 } : false}
                  whileInView={shouldAnimate ? { opacity: 1, y: 0 } : undefined}
                  viewport={{ once: true, margin: '-50px' }}
                  transition={{ delay: 1.3 + i * 0.1, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
                  className="bg-card border-2 border-black p-4 sm:p-6 rounded-none shadow-brutalist hover:shadow-brutalist-lg hover:-translate-y-1 transition-all duration-200 text-center group"
                >
                  <div className={`flex items-center justify-center mb-2`}>
                    <div
                      className="p-2 border-2 border-black"
                      style={{ backgroundColor: `rgb(var(--${stat.color}) / 0.1)` }}
                    >
                      <stat.icon
                        size={20}
                        className={`text-${stat.color}`}
                        style={{ color: `rgb(var(--${stat.color}))` }}
                      />
                    </div>
                  </div>
                  <div className="font-dela text-2xl sm:text-3xl font-black text-ink mb-1">
                    {stat.value}
                  </div>
                  <div className="text-xs sm:text-sm font-mono text-gray-600 uppercase tracking-wider">
                    {stat.label}
                  </div>
                </m.div>
              ))}
            </div>
          </Reveal>

          {/* CTA Section */}
          <Reveal delay={1.5}>
            <m.div
              initial={shouldAnimate ? { opacity: 0, y: 20 } : false}
              whileInView={shouldAnimate ? { opacity: 1, y: 0 } : undefined}
              viewport={{ once: true, margin: '-50px' }}
              transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
              className="mt-12 sm:mt-16 md:mt-20 text-center"
            >
              <div className="inline-block bg-card text-ink border-2 border-black p-8 sm:p-12 rounded-none shadow-brutalist-lg relative overflow-hidden group">
                {/* Brutalist grid background */}
                <div
                  className="absolute inset-0 opacity-10"
                  style={{
                    backgroundImage: 'linear-gradient(#000 1px, transparent 1px), linear-gradient(90deg, #000 1px, transparent 1px)',
                    backgroundSize: '50px 50px'
                  }}
                />

                <div className="relative z-10">
                  <h3 className="font-dela text-2xl sm:text-3xl md:text-4xl mb-4 tracking-tight text-ink">
                    Cut onboarding from 3 days to 5 minutes.
                  </h3>
                  <p className="font-mono text-sm sm:text-base mb-6 text-gray-600 max-w-md mx-auto">
                    Start your free trial and send your first client link today.
                  </p>
                  <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center">
                    <SignUpButton mode="modal">
                      <Button
                        variant="brutalist"
                        size="lg"
                        className="bg-coral text-white border-2 border-black hover:bg-coral/90 hover:translate-x-[4px] hover:translate-y-[4px] hover:shadow-brutalist-sm"
                        rightIcon={<Zap size={18} />}
                        onClick={handleTrialSignup}
                      >
                        Start Free Trial
                      </Button>
                    </SignUpButton>
                    <Button
                      variant="secondary"
                      size="lg"
                      className="bg-transparent text-ink border-2 border-black hover:bg-ink hover:text-paper hover:translate-x-[4px] hover:translate-y-[4px] hover:shadow-brutalist-sm"
                      onClick={() => setIsDemoModalOpen(true)}
                    >
                      Schedule Demo
                    </Button>
                  </div>
                </div>
              </div>
            </m.div>
          </Reveal>
        </div>
      </div>

      <ScheduleDemoModal isOpen={isDemoModalOpen} onClose={() => setIsDemoModalOpen(false)} />
    </section>
  );
}
