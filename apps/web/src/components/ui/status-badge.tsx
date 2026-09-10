/**
 * Status Badge Component
 *
 * Displays status indicators with Acid Brutalism design system.
 * Supports both status-based and variant-based APIs.
 */

import { CheckCircle2, AlertCircle, XCircle, Clock } from 'lucide-react';

export type StatusType =
  | 'pending'
  | 'authorized'
  | 'expired'
  | 'cancelled'
  | 'past_due'
  | 'healthy'
  | 'expiring'
  | 'unknown'
  | 'active'
  | 'trialing'
  | 'incomplete'
  | 'incomplete_expired'
  | 'revoked'
  | 'invalid';

export type StatusVariant = 'success' | 'warning' | 'default' | 'danger';

interface StatusBadgeProps {
  status?: StatusType;
  badgeVariant?: StatusVariant;
  size?: 'sm' | 'md' | 'lg';
  icon?: React.ReactNode;
  children?: React.ReactNode;
}

const SUCCESS_BADGE = 'bg-teal/10 text-success-ink border border-teal/30';
const WARNING_BADGE = 'bg-warning/10 text-warning border border-warning/30';
const DANGER_BADGE = 'bg-coral/10 text-danger-ink border border-coral/30';
const NEUTRAL_BADGE = 'bg-muted/10 text-muted-foreground border border-border';

const STATUS_CONFIG: Record<
  StatusType,
  { label: string; className: string; icon: React.ReactNode }
> = {
  pending: {
    label: 'Pending',
    className: WARNING_BADGE,
    icon: <Clock className="h-3 w-3" />,
  },
  authorized: {
    label: 'Authorized',
    className: SUCCESS_BADGE,
    icon: <CheckCircle2 className="h-3 w-3" />,
  },
  active: {
    label: 'Active',
    className: SUCCESS_BADGE,
    icon: <CheckCircle2 className="h-3 w-3" />,
  },
  trialing: {
    label: 'Trialing',
    className: WARNING_BADGE,
    icon: <Clock className="h-3 w-3" />,
  },
  incomplete: {
    label: 'Incomplete',
    className: WARNING_BADGE,
    icon: <Clock className="h-3 w-3" />,
  },
  incomplete_expired: {
    label: 'Incomplete Expired',
    className: DANGER_BADGE,
    icon: <AlertCircle className="h-3 w-3" />,
  },
  past_due: {
    label: 'Past Due',
    className: WARNING_BADGE,
    icon: <AlertCircle className="h-3 w-3" />,
  },
  cancelled: {
    label: 'Cancelled',
    className: NEUTRAL_BADGE,
    icon: <XCircle className="h-3 w-3" />,
  },
  revoked: {
    label: 'Revoked',
    className: DANGER_BADGE,
    icon: <XCircle className="h-3 w-3" />,
  },
  invalid: {
    label: 'Invalid',
    className: DANGER_BADGE,
    icon: <AlertCircle className="h-3 w-3" />,
  },
  expired: {
    label: 'Expired',
    className: DANGER_BADGE,
    icon: <XCircle className="h-3 w-3" />,
  },
  healthy: {
    label: 'Healthy',
    className: SUCCESS_BADGE,
    icon: <CheckCircle2 className="h-3 w-3" />,
  },
  expiring: {
    label: 'Expiring Soon',
    className: WARNING_BADGE,
    icon: <AlertCircle className="h-3 w-3" />,
  },
  unknown: {
    label: 'Unknown',
    className: NEUTRAL_BADGE,
    icon: <Clock className="h-3 w-3" />,
  },
};

const VARIANT_CONFIG: Record<StatusVariant, { label: string; className: string }> = {
  success: {
    label: 'Success',
    className: SUCCESS_BADGE,
  },
  warning: {
    label: 'Warning',
    className: WARNING_BADGE,
  },
  default: {
    label: 'Default',
    className: NEUTRAL_BADGE,
  },
  danger: {
    label: 'Danger',
    // Design system danger family: coral/10 fill, danger-ink text (AA on white).
    className: DANGER_BADGE,
  },
};

const SIZE_CLASSES: Record<
  NonNullable<StatusBadgeProps['size']>,
  string
> = {
  sm: 'px-2 py-0.5 text-xs',
  md: 'px-2.5 py-1 text-xs',
  lg: 'px-3 py-1.5 text-sm',
};

// Non-identity aliases only; any other string is used as-is and falls back to STATUS_CONFIG.unknown
const stringToStatusType: Record<string, StatusType> = {
  canceled: 'cancelled',
};

export function StatusBadge({ status, badgeVariant, size = 'md', icon, children }: StatusBadgeProps) {
  // Normalize string status to StatusType
  const statusType = typeof status === 'string' ? (stringToStatusType[status] ?? status) : status;

  // Support variant-based API (for generic badges)
  if (badgeVariant) {
    const config = VARIANT_CONFIG[badgeVariant];
    return (
      <span
        className={`inline-flex items-center gap-1.5 rounded-sm font-mono font-medium uppercase tracking-wider border ${config.className} ${
          SIZE_CLASSES[size]
        }`}
      >
        {icon}
        {children || config.label}
      </span>
    );
  }

  // Support status-based API (for specific platform statuses)
  if (statusType) {
    const config = STATUS_CONFIG[statusType] || STATUS_CONFIG.unknown;
    return (
      <span
        className={`inline-flex items-center gap-1.5 rounded-sm font-mono font-medium uppercase tracking-wider border ${config.className} ${
          SIZE_CLASSES[size]
        }`}
      >
        {config.icon}
        {config.label}
      </span>
    );
  }

  // Fallback for unexpected usage
  return null;
}
