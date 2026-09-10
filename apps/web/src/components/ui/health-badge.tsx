/**
 * Health Badge Component
 *
 * Specialized badge for token health status.
 * Displays visual indicators for healthy, expiring, and expired tokens.
 */

import { CheckCircle2, AlertCircle, XCircle, Clock } from 'lucide-react';
import { formatTimeUntilExpiry } from '@/lib/token-health';

export type HealthStatus = 'healthy' | 'expiring' | 'expired' | 'unknown';

interface HealthBadgeProps {
  health: HealthStatus;
  size?: 'sm' | 'md' | 'lg';
}

const HEALTH_CONFIG: Record<
  HealthStatus,
  { label: string; className: string; icon: React.ReactNode }
> = {
  healthy: {
    label: 'Healthy',
    className: 'bg-teal/10 text-success-ink border-teal/30',
    icon: <CheckCircle2 className="h-4 w-4" />,
  },
  expiring: {
    label: 'Expiring Soon',
    className: 'bg-warning/10 text-warning border-warning/30',
    icon: <AlertCircle className="h-4 w-4" />,
  },
  expired: {
    label: 'Expired',
    className: 'bg-coral/10 text-danger-ink border-coral/30',
    icon: <XCircle className="h-4 w-4" />,
  },
  unknown: {
    label: 'Unknown',
    className: 'bg-muted/10 text-muted-foreground border-border',
    icon: <Clock className="h-4 w-4" />,
  },
};

const SIZE_CLASSES: Record<
  NonNullable<HealthBadgeProps['size']>,
  string
> = {
  sm: 'px-2 py-1 text-xs gap-1',
  md: 'px-3 py-1.5 text-sm gap-2',
  lg: 'px-4 py-2 text-base gap-2',
};

export function HealthBadge({ health, size = 'md' }: HealthBadgeProps) {
  const config = HEALTH_CONFIG[health];

  return (
    <div
      className={`inline-flex items-center rounded-full font-medium border ${config.className} ${SIZE_CLASSES[size]}`}
    >
      {config.icon}
      {config.label}
    </div>
  );
}

/**
 * Expiration Countdown Component
 *
 * Displays human-readable expiration time with urgency indicators.
 */

interface ExpirationCountdownProps {
  /**
   * Legacy day-granular estimate from getTokenHealth. Retained for call-site
   * compatibility; the render below derives urgency from `expiresAt` alone.
   */
  daysUntilExpiry: number;
  /**
   * Sub-day horizons render minute-level truth ("Expires in 42m", "Expired
   * 12m ago") instead of day-rounded copy. Hourly tokens make the day-granular
   * path lie twice, so callers holding the real date pass it. An explicit null
   * (token never expires) renders "Unknown".
   */
  expiresAt: Date | string | null;
}

const DAY_MS = 24 * 60 * 60 * 1000;

export function ExpirationCountdown({ expiresAt }: ExpirationCountdownProps) {
  // One clock for both the copy and the urgency class so the two can never
  // disagree. Urgency comes from the raw offset, not from sniffing the copy:
  // expired -> danger, still inside its first day -> warning, otherwise muted.
  // A null or unparseable expiry makes the offset NaN, which falls to muted.
  const now = new Date();
  const copy = formatTimeUntilExpiry(expiresAt, now);
  const expiryDate = typeof expiresAt === 'string' ? new Date(expiresAt) : expiresAt;
  const msUntilExpiry = expiryDate ? expiryDate.getTime() - now.getTime() : Number.NaN;
  const isPast = msUntilExpiry <= 0;
  const isSubDay = !isPast && msUntilExpiry <= DAY_MS;
  const ink = isPast
    ? 'text-danger-ink font-medium'
    : isSubDay
      ? 'text-warning font-medium'
      : 'text-muted-foreground';

  return <span className={`text-sm ${ink}`}>{copy}</span>;
}
