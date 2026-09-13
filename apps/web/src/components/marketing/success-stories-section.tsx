'use client';

import { useState } from 'react';
import { m, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight, TrendingUp, Clock, Users } from 'lucide-react';

// Data structure for case studies
const CASE_STUDIES = [
  {
    company: 'Pillar AI Agency',
    industry: 'AI Automation',
    location: 'Austin, TX',
    image: 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?q=80&w=800',
    quote:
      'We were spending days just trying to get access to client accounts before we could even start building automations. AuthHub changed everything. Now our clients connect their platforms in 5 minutes, and we can start building workflows the same day. That used to take a week.',
    author: 'AJ S.',
    role: 'Co-Founder',
    metrics: [
      { label: 'Platform Connection Time', before: '2-3 days', after: '< 5 min', icon: Clock },
      { label: 'Automation Setup Speed', before: '1 week', after: 'Same day', icon: TrendingUp },
      { label: 'Active Client Projects', before: '12', after: '38', icon: Users },
    ],
  },
  // {
  //   company: 'Scale Media Agency',
  //   industry: 'Paid Social',
  //   location: 'New York, NY',
  //   image: 'https://images.unsplash.com/photo-1551434678-e076c223a692?q=80&w=800',
  //   quote:
  //     'We scaled from 15 to 45 clients without hiring more staff. The automated OAuth flow handles everything. No more password sharing, no more security risks.',
  //   author: 'Marcus Chen',
  //   role: 'CEO',
  //   metrics: [
  //     { label: 'Time Per Onboarding', before: '2+ hours', after: '5 min', icon: Clock },
  //     { label: 'Client Satisfaction', before: '3.8/5', after: '4.9/5', icon: CheckCircle },
  //     { label: 'Team Capacity', before: '15 clients', after: '45 clients', icon: Users },
  //   ],
  // },
  // {
  //   company: 'Apex Digital',
  //   industry: 'Full-Service Agency',
  //   location: 'San Francisco, CA',
  //   image: 'https://images.unsplash.com/photo-1522071820081-009f0129c71c?q=80&w=800',
  //   quote:
  //     'From chaos to organized in 1 week. Every OAuth token stored securely, every client connected in minutes. Our team can finally focus on strategy instead of admin.',
  //   author: 'Emily Rodriguez',
  //   role: 'Operations Director',
  //   metrics: [
  //     { label: 'Admin Hours/Week', before: '12 hrs', after: '2 hrs', icon: Clock },
  //     { label: 'Token Security', before: 'Email sharing', after: 'Bank-level', icon: CheckCircle },
  //     { label: 'New Client Ramp-up', before: '1 week', after: 'Same day', icon: TrendingUp },
  //   ],
  // },
];

// Simple reveal animation component
function Reveal({ children }: { children: React.ReactNode }) {
  return (
    <m.div
      initial={{ opacity: 0, y: 50 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-100px' }}
      transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </m.div>
  );
}

export function SuccessStoriesSection() {
  const [currentIndex, setCurrentIndex] = useState(0);

  const handlePrev = () => {
    setCurrentIndex((prev) => (prev === 0 ? CASE_STUDIES.length - 1 : prev - 1));
  };

  const handleNext = () => {
    setCurrentIndex((prev) => (prev === CASE_STUDIES.length - 1 ? 0 : prev + 1));
  };

  const currentStudy = CASE_STUDIES[currentIndex];

  return (
    <section className="py-20 md:py-32 bg-paper border-y-2 border-black relative overflow-hidden">
      {/* Diagonal lines background */}
      <div className="absolute inset-0 opacity-20 -z-10 diagonal-lines" />

      <div className="px-4 md:px-8 max-w-[1400px] mx-auto relative z-10">
        {/* Section Header */}
        <Reveal>
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 border-2 border-black bg-coral text-paper px-4 sm:px-6 py-2 text-[10px] sm:text-xs font-bold uppercase tracking-widest font-mono shadow-brutalist rounded-[0.75rem] mb-6">
              Real Results
            </div>
            <h2 className="font-dela text-4xl md:text-6xl tracking-tighter text-ink mt-2 mb-4">
              What Changes
            </h2>
            <p className="text-gray-600 text-lg max-w-2xl mx-auto">
              When onboarding takes 5 minutes instead of 3 days, everything changes.
            </p>
          </div>
        </Reveal>

        {/* Carousel Content */}
        <div className="relative">
          <AnimatePresence mode="wait">
            <m.div
              key={currentIndex}
              initial={{ opacity: 0, x: 100 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -100 }}
              transition={{ duration: 0.5 }}
              className="grid md:grid-cols-2 gap-6 sm:gap-8 md:gap-12 items-center"
            >
              {/* Company Info Card */}
              <m.div
                whileHover={{ y: -2, boxShadow: '6px 6px 0px #000', x: -2 }}
                className="relative aspect-[4/3] bg-paper border-2 border-black rounded-[0.75rem] overflow-hidden shadow-brutalist hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px] transition-all duration-200 group order-2 md:order-1"
              >
                <img
                  src={currentStudy.image}
                  alt={currentStudy.company}
                  className="absolute inset-0 w-full h-full object-cover opacity-90 group-hover:opacity-100 transition-opacity group-hover:scale-105 duration-500"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />
                <div className="absolute bottom-0 left-0 right-0 p-6">
                  <div className="inline-block bg-coral text-black px-3 py-1 rounded-[0.5rem] font-dela text-xs border-2 border-black mb-3">
                    {currentStudy.industry}
                  </div>
                  <h3 className="font-dela text-2xl sm:text-3xl text-white mb-1">{currentStudy.company}</h3>
                  <p className="text-white/70 font-mono text-sm">{currentStudy.location}</p>
                </div>
              </m.div>

              {/* Testimonial & Metrics */}
              <div className="order-1 md:order-2">
                {/* Quote Card */}
                <div className="bg-card border-2 border-black rounded-[0.75rem] p-6 sm:p-8 shadow-brutalist mb-6 relative hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px] transition-all duration-200">
                  <div className="absolute top-4 sm:top-6 left-4 sm:left-8 text-danger-ink/10 font-dela text-4xl sm:text-6xl leading-none select-none -z-0">
                    &ldquo;
                  </div>
                  <div className="relative z-10">
                    <p className="font-display text-base sm:text-lg md:text-xl lg:text-2xl italic leading-tight text-ink mb-6">
                      {currentStudy.quote}
                    </p>
                    <div className="flex items-center gap-3 sm:gap-4">
                      <div className="w-12 h-12 sm:w-14 sm:h-14 border-2 border-black bg-coral flex items-center justify-center font-black text-white text-sm sm:text-base rounded-[0.5rem]">
                        {currentStudy.author
                          .split(' ')
                          .map((name) => name[0])
                          .join('')}
                      </div>
                      <div className="text-left">
                        <p className="font-black text-sm sm:text-base text-ink">{currentStudy.author}</p>
                        <p className="text-gray-600 text-[10px] sm:text-xs uppercase tracking-[0.15em] sm:tracking-[0.2em] font-bold font-mono">
                          {currentStudy.role}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Metrics Cards */}
                <div className="grid grid-cols-1 gap-3 sm:gap-4">
                  {currentStudy.metrics.map((metric, i) => {
                    const Icon = metric.icon;
                    return (
                      <m.div
                        key={metric.label}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        whileHover={{ y: -2, boxShadow: '6px 6px 0px #000', x: -2 }}
                        transition={{ delay: i * 0.1 }}
                        className="bg-card border-2 border-black rounded-[0.5rem] p-4 sm:p-5 shadow-[4px_4px_0px_#000] hover:shadow-[6px_6px_0px_#000] hover:translate-x-[-2px] hover:translate-y-[-2px] transition-all duration-200"
                      >
                        <div className="flex items-center justify-between gap-3 sm:gap-4">
                          <div className="flex items-center gap-3 sm:gap-4 flex-1 min-w-0">
                            <div className="w-10 h-10 sm:w-12 sm:h-12 border-2 border-black bg-teal flex items-center justify-center flex-shrink-0">
                              <Icon size={16} className="text-white sm:hidden" strokeWidth={2.5} />
                              <Icon size={20} className="text-white hidden sm:block" strokeWidth={2.5} />
                            </div>
                            <span className="font-black text-sm sm:text-base uppercase tracking-wider text-ink">
                              {metric.label}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
                            <span className="text-gray-400 line-through font-mono text-xs sm:text-sm">
                              {metric.before}
                            </span>
                            <span className="text-danger-ink font-dela text-lg sm:text-xl">→</span>
                            <span className="text-ink font-dela text-base sm:text-xl">{metric.after}</span>
                          </div>
                        </div>
                      </m.div>
                    );
                  })}
                </div>
              </div>
            </m.div>
          </AnimatePresence>

          {/* Navigation Controls */}
          <div className="flex items-center justify-center gap-3 sm:gap-4 mt-8 sm:mt-12">
            <m.button
              onClick={handlePrev}
              whileHover={{ x: 2, y: 2 }}
              whileTap={{ x: 2, y: 2 }}
              className="w-12 h-12 bg-card border-2 border-black rounded-none flex items-center justify-center shadow-[4px_4px_0px_#000] hover:shadow-none transition-shadow touch-feedback"
              aria-label="Previous case study"
            >
              <ChevronLeft size={24} className="text-ink" strokeWidth={2.5} />
            </m.button>

            <div className="flex gap-2">
              {CASE_STUDIES.map((_, index) => (
                <button
                  key={index}
                  onClick={() => setCurrentIndex(index)}
                  className={`h-2 rounded-none border-2 border-black transition-all ${
                    index === currentIndex ? 'w-8 bg-coral' : 'w-2 bg-muted'
                  }`}
                  aria-label={`Go to case study ${index + 1}`}
                />
              ))}
            </div>

            <m.button
              onClick={handleNext}
              whileHover={{ x: 2, y: 2 }}
              whileTap={{ x: 2, y: 2 }}
              className="w-12 h-12 bg-card border-2 border-black rounded-none flex items-center justify-center shadow-[4px_4px_0px_#000] hover:shadow-none transition-shadow touch-feedback"
              aria-label="Next case study"
            >
              <ChevronRight size={24} className="text-ink" strokeWidth={2.5} />
            </m.button>
          </div>
        </div>
      </div>
    </section>
  );
}
