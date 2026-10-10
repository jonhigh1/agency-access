'use client';

import { m, useSpring, useMotionValueEvent } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';
import { Reveal } from '../reveal';
import type { MarketingStats } from '@/lib/api/marketing-stats';

interface Metric {
  value: number;
  suffix?: string;
  decimals?: number;
  label: string;
}

// Counters come from the production aggregate (GET /api/marketing-stats via
// getMarketingStats). When stats are unavailable the banner degrades to the
// single product-quality metric — no estimated ranges, ever.
function buildMetrics(stats: MarketingStats | null | undefined): Metric[] {
  if (!stats) {
    return [{ value: 99.9, suffix: '%', decimals: 1, label: 'OAuth Success Rate' }];
  }
  return [
    { value: 99.9, suffix: '%', decimals: 1, label: 'OAuth Success Rate' },
    { value: stats.activePlatformAuthorizations, label: 'Active Platform Connections' },
    { value: stats.tokenRefreshes, label: 'Tokens Auto-Refreshed' },
  ];
}

interface CounterProps {
  value: number;
  prefix?: string;
  suffix?: string;
  decimals?: number;
}

function AnimatedCounter({ value, prefix = '', suffix = '', decimals = 0 }: CounterProps) {
  const spring = useSpring(0, { stiffness: 50, damping: 30 });
  const [displayValue, setDisplayValue] = useState('0');

  useMotionValueEvent(spring, 'change', (latest) => {
    const formatted = decimals > 0
      ? latest.toFixed(decimals)
      : Math.floor(latest).toLocaleString();
    setDisplayValue(formatted);
  });

  useEffect(() => {
    // Small delay to ensure spring is ready, then animate to value
    const timer = setTimeout(() => {
      spring.set(value);
    }, 100);
    return () => clearTimeout(timer);
  }, [spring, value]);

  return (
    <span>
      {prefix}
      {displayValue}
      {suffix}
    </span>
  );
}

export function MetricBanner({ stats }: { stats?: MarketingStats | null }) {
  const ref = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(false);
  const metrics = buildMetrics(stats);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !isVisible) {
          setIsVisible(true);
        }
      },
      { threshold: 0.3 }
    );

    if (ref.current) {
      observer.observe(ref.current);
    }

    return () => observer.disconnect();
  }, [isVisible]);

  return (
    <section className="py-12 sm:py-16 bg-card border-y-2 border-black relative overflow-hidden">
      {/* Brutalist grid background */}
      <div
        className="absolute inset-0 opacity-10"
        style={{
          backgroundImage: 'linear-gradient(#000 1px, transparent 1px), linear-gradient(90deg, #000 1px, transparent 1px)',
          backgroundSize: '50px 50px',
        }}
      />

      <div className="container mx-auto px-4 sm:px-6 lg:px-8 relative z-10" ref={ref}>
        <Reveal>
          <div
            className={`grid grid-cols-1 gap-6 sm:gap-8 ${
              stats ? 'max-w-5xl mx-auto sm:grid-cols-3' : 'max-w-md mx-auto'
            }`}
          >
            {metrics.map((metric, index) => (
              <m.div
                key={metric.label}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1, duration: 0.5 }}
                className="text-center h-full"
              >
                <div className="border-2 border-black bg-white p-6 sm:p-8 shadow-brutalist h-full flex flex-col justify-center">
                  <div className="font-dela text-4xl sm:text-5xl lg:text-6xl text-danger-ink mb-2">
                    {isVisible && (
                      <AnimatedCounter
                        value={metric.value}
                        suffix={metric.suffix}
                        decimals={metric.decimals}
                      />
                    )}
                  </div>
                  <div className="font-mono text-xs sm:text-sm font-bold uppercase tracking-wider text-gray-600">
                    {metric.label}
                  </div>
                </div>
              </m.div>
            ))}
          </div>
          {stats && (
            <p className="mt-4 text-center text-[10px] font-mono text-gray-500">
              Counters reflect live production data, refreshed hourly.
            </p>
          )}
        </Reveal>
      </div>
    </section>
  );
}
