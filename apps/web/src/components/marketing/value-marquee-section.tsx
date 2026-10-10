'use client';

import { m, useReducedMotion } from 'framer-motion';
import { useMobile } from '@/hooks/use-mobile';
import type { MarketingStats } from '@/lib/api/marketing-stats';

// Homepage proof counters — same production aggregate the pricing banner uses.
const USAGE_STATS = [
  { key: 'activePlatformAuthorizations' as const, label: 'Active Platform Connections' },
  { key: 'completedAccessRequests' as const, label: 'Completed Access Requests' },
  { key: 'tokenRefreshes' as const, label: 'Tokens Auto-Refreshed' },
];

const valueHighlights = [
  {
    badge: '01',
    title: 'One Link',
    detail: 'One link replaces 47 emails across Meta, Google, LinkedIn, and more.',
  },
  {
    badge: '02',
    title: 'Built-In Token Refresh',
    detail: 'Access never drops. Tokens auto-refresh before expiration.',
  },
  {
    badge: '03',
    title: 'White-Label',
    detail: 'Your logo and colors, with official platform authorization.',
  },
  {
    badge: '04',
    title: 'Audit Logs Included',
    detail: 'Track who accessed what, when, and from where.',
  },
  {
    badge: '05',
    title: '5-Minute Setup',
    detail: 'Replace a full day of onboarding with a 5-minute flow.',
  },
  {
    badge: '06',
    title: 'Platform Coverage',
    detail: 'Meta Ads, Google Ads, GA4, LinkedIn, TikTok — one flow, all platforms.',
  },
];

// Duplicate for seamless marquee loop (desktop only)
const marqueeHighlights = [...valueHighlights, ...valueHighlights, ...valueHighlights];

export function ValueMarqueeSection({ stats }: { stats?: MarketingStats | null }) {
  const isMobile = useMobile();
  const prefersReducedMotion = useReducedMotion();
  return (
    <section className="py-12 sm:py-16 border-y-2 border-black bg-paper relative overflow-hidden">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 relative z-10 mb-8 sm:mb-12">
        <p className="text-[10px] sm:text-[11px] font-black uppercase tracking-[0.25em] sm:tracking-[0.3em] text-center text-ink font-mono">
          Built for faster onboarding. Cleaner handoffs. No exceptions.
        </p>
        {stats && (
          <div
            className="mt-6 flex flex-wrap items-center justify-center gap-x-10 gap-y-4"
            data-testid="usage-stats-row"
          >
            {USAGE_STATS.map(({ key, label }) => (
              <div key={key} className="text-center">
                <div className="font-mono font-bold text-lg sm:text-xl text-ink">
                  {stats[key].toLocaleString('en-US')}
                </div>
                <div className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink/50">
                  {label}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Marquee container - static grid on mobile, animated marquee on desktop */}
      <div className="relative overflow-hidden">
        {isMobile ? (
          // Static grid for mobile
          <div className="grid grid-cols-1 gap-4 px-4 sm:px-6 lg:px-8">
            {valueHighlights.map((item, i) => (
              <div
                key={`${item.title}-${i}`}
                className="flex items-start gap-3 px-4 py-4 border-2 border-black bg-card shadow-[4px_4px_0px_#000] rounded-none hover:shadow-[6px_6px_0px_#000] hover:translate-x-[-2px] hover:translate-y-[-2px] transition-all duration-200 cursor-default touch-feedback"
              >
                <div className="w-8 h-8 border-2 border-black bg-coral flex items-center justify-center font-black text-xs text-white rounded-none flex-shrink-0">
                  {item.badge}
                </div>
                <div className="min-w-0">
                  <p className="font-dela text-base tracking-tight font-bold text-ink">
                    {item.title}
                  </p>
                  <p className="font-mono text-xs text-gray-600 mt-1 leading-relaxed">
                    {item.detail}
                  </p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          // Marquee track - infinite scroll animation for desktop
          <m.div
            initial={{ x: 0 }}
            animate={prefersReducedMotion ? { x: 0 } : { x: '-50%' }}
            transition={{
              duration: prefersReducedMotion ? 0 : 30,
              ease: 'linear',
              repeat: prefersReducedMotion ? 0 : Infinity,
            }}
            className="flex gap-6 sm:gap-12 whitespace-nowrap animate-marquee marketing-marquee"
          >
            {marqueeHighlights.map((item, i) => (
              <div
                key={`${item.title}-${i}`}
                data-marquee-duplicate={i >= valueHighlights.length ? 'true' : undefined}
                className="flex items-center gap-4 px-6 py-4 border-2 border-black bg-card shadow-[4px_4px_0px_#000] rounded-none hover:shadow-[6px_6px_0px_#000] hover:translate-x-[-2px] hover:translate-y-[-2px] transition-all duration-200 cursor-default touch-feedback flex-shrink-0 min-w-[420px]"
              >
                <div className="w-10 h-10 border-2 border-black bg-coral flex items-center justify-center font-black text-sm text-white rounded-none flex-shrink-0">
                  {item.badge}
                </div>
                <div className="min-w-0">
                  <p className="font-dela text-lg tracking-tight font-bold text-ink truncate">
                    {item.title}
                  </p>
                  <p className="font-mono text-xs sm:text-sm text-gray-600 leading-relaxed">
                    {item.detail}
                  </p>
                </div>
              </div>
            ))}
          </m.div>
        )}
      </div>
    </section>
  );
}
