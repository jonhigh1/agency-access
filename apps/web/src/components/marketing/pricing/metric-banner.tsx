'use client';

import { m, useSpring, useMotionValueEvent } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';
import { Reveal } from '../reveal';

interface Metric {
  value?: number;
  displayValue?: string;
  prefix?: string;
  suffix?: string;
  decimals?: number;
  label: string;
}

const metrics: Metric[] = [
  { value: 99.9, suffix: '%', decimals: 1, label: 'OAuth Success Rate' },
  { displayValue: '2-4', label: 'Estimated Hours Saved / Client' },
  { displayValue: '15-30', label: 'Estimated Emails Reduced / Client' },
];

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

export function MetricBanner() {
  const ref = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(false);

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
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 sm:gap-8 max-w-5xl mx-auto">
            {metrics.map((metric, index) => (
              <m.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1, duration: 0.5 }}
                className="text-center h-full"
              >
                <div className="border-2 border-black bg-white p-6 sm:p-8 shadow-brutalist h-full flex flex-col justify-center">
                  <div className="font-dela text-4xl sm:text-5xl lg:text-6xl text-danger-ink mb-2">
                    {metric.displayValue ? (
                      <span>{metric.displayValue}</span>
                    ) : (
                      isVisible && metric.value !== undefined && (
                      <AnimatedCounter
                        value={metric.value}
                        prefix={metric.prefix}
                        suffix={metric.suffix}
                        decimals={metric.decimals}
                      />
                      )
                    )}
                  </div>
                  <div className="font-mono text-xs sm:text-sm font-bold uppercase tracking-wider text-gray-600">
                    {metric.label}
                  </div>
                </div>
              </m.div>
            ))}
          </div>
          <p className="mt-4 text-center text-[10px] font-mono text-gray-500">
            Estimated ranges are based on typical multi-platform onboarding workflows.
          </p>
        </Reveal>
      </div>
    </section>
  );
}
