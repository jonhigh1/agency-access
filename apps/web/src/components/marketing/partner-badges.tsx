import { PlatformIcon } from '@/components/ui/platform-icon';

// Labels are Jon's explicit call (2026-10-10): display as "Official Partner" for both
// programs. Keep them config-driven so a correction to exact portal tier names is a
// one-line change. Swap in portal-exported badge assets later without touching call sites.
const PARTNER_BADGES = [
  { id: 'google', platform: 'google', label: 'Google Official Partner' },
  { id: 'meta', platform: 'meta', label: 'Meta Official Partner' },
] as const;

export function PartnerBadges({ className = '' }: { className?: string }) {
  return (
    <div className={`flex flex-wrap items-center gap-3 ${className}`} data-testid="partner-badges">
      {PARTNER_BADGES.map((badge) => (
        <span
          key={badge.id}
          data-testid="partner-badge-chip"
          className="inline-flex items-center gap-2 rounded-none border border-black/15 bg-card px-3 py-1.5"
        >
          <PlatformIcon platform={badge.platform} size="sm" />
          <span className="font-mono text-[11px] font-bold uppercase tracking-[0.10em] text-ink/70">
            {badge.label}
          </span>
        </span>
      ))}
    </div>
  );
}
