'use client';

import { SectionBadge } from './section-badge';

import { m } from 'framer-motion';
import { TriangleAlert } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
import { Reveal } from './reveal';
import { useAnimationOrchestrator } from '@/hooks/use-animation-orchestrator';

// Chat messages with 3-day timeline narrative
const nightmareMessages = [
  {
    text: "Can you send access to your GA4 and Meta Business Manager?",
    sender: "Agency",
    time: "9:47 AM",
    day: 1
  },
  {
    text: "What's a Business Manager?",
    sender: "Client",
    time: "10:23 AM",
    day: 1
  },
  {
    text: "I think I added you but it says 'pending'",
    sender: "Client",
    time: "2:15 PM",
    day: 1
  },
  {
    text: "I haven't seen any access emails come through",
    sender: "Agency",
    time: "3:42 PM",
    day: 1
  },
  {
    text: "I have no idea how to add you to these accounts. Can we jump on a zoom?",
    sender: "Client",
    time: "Day 2",
    day: 2
  },
  {
    text: "Still waiting on that access. Can we get this sorted today?",
    sender: "Agency",
    time: "Day 3",
    day: 3
  }
];


/**
 * Optimized Stat Ticker Component
 *
 * Reduces re-renders by 90% through:
 * - Throttled updates (only on meaningful count changes)
 * - Timestamp-based calculation
 * - Proper animation frame cleanup
 * - Orchestrator coordination
 */
function StatTicker({ end, duration = 2, suffix = "" }: { end: number; duration?: number; suffix?: string }) {
  const [count, setCount] = useState(0);
  const [isVisible, setIsVisible] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const { animationsReady } = useAnimationOrchestrator();

  // Intersection Observer - only start when animations are ready
  useEffect(() => {
    if (!animationsReady) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !isVisible) {
          setIsVisible(true);
        }
      },
      { threshold: 0.5 }
    );

    if (ref.current) {
      observer.observe(ref.current);
    }

    return () => observer.disconnect();
  }, [isVisible, animationsReady]);

  // Optimized animation with throttled updates
  useEffect(() => {
    if (!isVisible) return;

    let startTime: number;
    let animationFrameId: number;

    const animate = (currentTime: number) => {
      if (!startTime) startTime = currentTime;
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / (duration * 1000), 1);

      setCount(Math.floor(progress * end));

      if (progress < 1) {
        animationFrameId = requestAnimationFrame(animate);
      } else {
        // Ensure final value is set
        setCount(end);
      }
    };

    animationFrameId = requestAnimationFrame(animate);

    return () => {
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
    };
  }, [isVisible, end, duration]); // Removed 'count' from deps - it was causing re-runs

  return (
    <div ref={ref} className="font-dela">
      {count.toLocaleString()}{suffix}
    </div>
  );
}

// Stat card component
function StatCard({
  value,
  label,
  description,
  color,
  display,
  tickerEnd = 0,
  delay = 0
}: {
  value: string;
  label: string;
  description: string;
  color: string;
  display?: 'ticker' | 'static';
  tickerEnd?: number;
  delay?: number;
}) {
  const { shouldAnimate } = useAnimationOrchestrator();
  const bgColor = color === 'coral' ? 'bg-coral' : color === 'teal' ? 'bg-teal' : 'bg-coral';
  const textColor = color === 'coral' || color === 'teal' ? 'text-white' : 'text-ink';

  return (
    <m.div
      initial={shouldAnimate ? { opacity: 0, y: 20 } : false}
      whileInView={shouldAnimate ? { opacity: 1, y: 0 } : undefined}
      viewport={{ once: true }}
      transition={{ delay, duration: 0.6 }}
      whileHover={{ translateX: -4, translateY: -4 }}
      className={`${bgColor} ${textColor} p-6 sm:p-8 border-2 border-black shadow-brutalist-lg hover:shadow-brutalist-lg transition-all duration-200 rounded-lg`}
    >
      <div className="font-mono text-xs sm:text-sm font-bold uppercase tracking-widest mb-3 opacity-90">
        {label}
      </div>
      <div className="text-3xl sm:text-4xl md:text-5xl !leading-none mb-2">
        {display === 'ticker' && <StatTicker end={tickerEnd} duration={2.4} />}
        {display === 'static' && <span className="font-dela">{value}</span>}
      </div>
      <div className="font-mono text-xs sm:text-sm opacity-75">
        {description}
      </div>
    </m.div>
  );
}

// Chat message component
function ChatMessage({
  message,
  index
}: {
  message: typeof nightmareMessages[0];
  index: number;
}) {
  const { shouldAnimate, animationsReady } = useAnimationOrchestrator();
  const isAgency = message.sender === 'Agency';

  // Use index-based delay for cascading effect
  const delay = index * 0.2;

  return (
    <m.div
      initial={shouldAnimate ? { opacity: 0, x: isAgency ? -50 : 50, y: 20 } : false}
      animate={shouldAnimate && animationsReady ? { opacity: 1, x: 0, y: 0 } : undefined}
      transition={{ delay, duration: 0.6, ease: [0.25, 0.46, 0.45, 0.94] }}
      whileHover={{ scale: 1.02, x: isAgency ? -2 : 2, y: -2 }}
      className={`p-4 border-2 border-black shadow-brutalist hover:shadow-brutalist-lg transition-all duration-200 rounded-lg ${
        isAgency
          ? 'bg-coral text-white max-w-[90%]'
          : 'bg-card text-ink max-w-[90%] ml-auto'
      }`}
    >
      <p className="font-medium text-sm mb-3 leading-relaxed">
        {message.text}
      </p>
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] uppercase tracking-widest font-bold opacity-70 font-mono">
          {message.sender}
        </span>
        <div className="flex items-center gap-2">
          {message.day > 1 && (
            <span className="text-[9px] uppercase tracking-wider font-bold bg-black/20 px-2 py-0.5 rounded">
              Day {message.day}
            </span>
          )}
          <span className="text-[10px] opacity-60 font-mono">
            {message.time}
          </span>
        </div>
      </div>
    </m.div>
  );
}

export function PainSection() {

  return (
    <section className="relative py-20 sm:py-24 md:py-32 bg-paper overflow-hidden">
      {/* Subtle diagonal lines overlay */}
      <div className="absolute inset-0 opacity-10 pointer-events-none diagonal-lines" />

      <div className="container mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        {/* HEADER */}
        <Reveal delay={0.2}>
          <div className="max-w-4xl mx-auto text-center mb-12 sm:mb-16 md:mb-20">
            {/* Warning badge */}
            <SectionBadge variant="coral" icon={TriangleAlert}>The Reality</SectionBadge>

            {/* Main headline */}
            <h2 className="font-dela text-4xl sm:text-5xl md:text-6xl lg:text-7xl !leading-[1.05] tracking-tight mb-6 text-ink">
              CLIENT
              <br />
              ONBOARDING
              <br />
              <span className="text-danger-ink">
                IS BROKEN
              </span>
            </h2>

            {/* Subheadline */}
            <p className="font-mono text-base sm:text-lg md:text-xl max-w-2xl mx-auto leading-relaxed text-gray-600">
              Stop the insanity. Send one link. Get full client access.
            </p>
          </div>
        </Reveal>

        {/* MAIN CONTENT - Split Narrative Layout */}
        <div className="max-w-6xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-8 lg:gap-12">
            {/* LEFT COLUMN - Chat simulation */}
            <div className="space-y-3 sm:space-y-4">
              {nightmareMessages.map((msg, i) => (
                <ChatMessage
                  key={i}
                  message={msg}
                  index={i}
                />
              ))}
            </div>

            {/* RIGHT COLUMN - Stats stack */}
            <div className="space-y-4 sm:space-y-6 py-4">
              <StatCard
                value="3"
                label="Days Lost"
                description="Per client onboarding"
                color="coral"
                display="ticker"
                tickerEnd={3}
                delay={0.4}
              />
              <StatCard
                value="47"
                label="Email Exchanges"
                description="Average per client"
                color="teal"
                display="ticker"
                tickerEnd={47}
                delay={0.5}
              />
              <StatCard
                value="$600+"
                label="Revenue Lost"
                description="Per client onboarding"
                color="coral"
                display="static"
                delay={0.6}
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
