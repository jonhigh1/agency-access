'use client';

import { m } from 'framer-motion';

interface PricingToggleProps {
  isYearly: boolean;
  onToggle: (value: boolean) => void;
}

export function PricingToggle({ isYearly, onToggle }: PricingToggleProps) {
  return (
    <div className="flex flex-col items-center gap-3 mb-8 sm:mb-12">
      {/* Toggle */}
      <m.div
        initial={{ opacity: 0, y: 10 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.4 }}
        className="relative inline-flex items-center gap-2 sm:gap-2 bg-card border-2 border-border-hard dark:border-white p-1 shadow-brutalist-sm"
      >
        <button
          onClick={() => onToggle(false)}
          className={`relative px-6 sm:px-8 py-3 min-h-[48px] font-bold uppercase tracking-wider text-xs transition-all touch-feedback ${
            !isYearly
              ? 'bg-coral text-black shadow-[2px_2px_0px_var(--shadow-hard)]'
              : 'text-gray-600 dark:text-gray-400 hover:text-ink dark:hover:text-white'
          }`}
        >
          Monthly
        </button>
        <button
          onClick={() => onToggle(true)}
          className={`relative px-6 sm:px-8 py-3 min-h-[48px] font-bold uppercase tracking-wider text-xs transition-all touch-feedback ${
            isYearly
              ? 'bg-coral text-black shadow-[2px_2px_0px_var(--shadow-hard)]'
              : 'text-gray-600 dark:text-gray-400 hover:text-ink dark:hover:text-white'
          }`}
        >
          <span className="inline-flex items-center gap-2">
            Yearly
            <span className="rounded-full border border-black/20 bg-white px-2 py-0.5 text-[10px] font-bold tracking-wider text-danger-ink">
              Save ~17%
            </span>
          </span>
        </button>

      </m.div>

      {/* Helper Text */}
      <p className="text-sm text-gray-500 dark:text-gray-400 font-mono">
        {isYearly
          ? 'Save ~17% with annual billing (pay for 10, get 12). Cancel anytime.'
          : 'Billed monthly. Switch to yearly for ~17% off (2 months free).'}
      </p>
    </div>
  );
}
