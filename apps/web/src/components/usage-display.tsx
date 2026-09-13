'use client';

/**
 * UsageDisplay Component
 *
 * Progress bar widget showing quota usage for a specific metric.
 *
 * Usage:
 * ```tsx
 * <UsageDisplay
 *   metric="clients"
 *   used={3}
 *   limit={5}
 *   showUpgradeNudge={remaining <= 1}
 * />
 * ```
 */

import { type MetricType } from '@agency-platform/shared';
import { AlertTriangle, TrendingUp } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface UsageDisplayProps {
  metric: MetricType;
  used: number;
  limit: number | 'unlimited';
  showUpgradeNudge?: boolean;
  onUpgradeClick?: () => void;
  size?: 'sm' | 'md' | 'lg';
}

export function UsageDisplay({
  metric,
  used,
  limit,
  showUpgradeNudge = false,
  onUpgradeClick,
  size = 'md',
}: UsageDisplayProps) {
  // Get metric display name
  const metricNames: Record<MetricType, string> = {
    access_requests: 'Access Requests',
    clients: 'Clients',
    members: 'Team Members',
    templates: 'Templates',
    client_onboards: 'Client Onboards',
    platform_audits: 'Platform Audits',
    team_seats: 'Team Seats',
  };

  const metricName = metricNames[metric];
  const isUnlimited = limit === 'unlimited';
  const remaining = isUnlimited ? 'unlimited' : Math.max(0, (limit as number) - used);
  const percentage = isUnlimited ? 0 : Math.min(100, (used / (limit as number)) * 100);

  // Size variants
  const sizeClasses = {
    sm: {
      bar: 'h-1.5',
      text: 'text-xs',
      padding: 'p-2',
    },
    md: {
      bar: 'h-2',
      text: 'text-sm',
      padding: 'p-3',
    },
    lg: {
      bar: 'h-3',
      text: 'text-base',
      padding: 'p-4',
    },
  };

  const currentSize = sizeClasses[size];

  // Determine bar color based on percentage
  const getBarColor = () => {
    if (isUnlimited) return 'bg-teal';
    if (percentage >= 100) return 'bg-coral';
    if (percentage >= 80) return 'bg-yellow-500';
    return 'bg-teal';
  };

  const getTextColor = () => {
    if (isUnlimited) return 'text-success-ink';
    if (percentage >= 100) return 'text-danger-ink';
    if (percentage >= 80) return 'text-yellow-600';
    return 'text-gray-600';
  };

  return (
    <div className={`${currentSize.padding} bg-card border border-black/10 rounded-lg`}>
      {/* Header with metric name and count */}
      <div className="flex justify-between items-center mb-2">
        <span className={`${currentSize.text} font-medium text-ink`}>
          {metricName}
        </span>
        <span className={`${currentSize.text} ${getTextColor()}`}>
          {isUnlimited ? (
            'Unlimited'
          ) : (
            <>
              {used} / {limit} used
              {remaining === 0 && ' · Limit reached'}
            </>
          )}
        </span>
      </div>

      {/* Progress bar */}
      {!isUnlimited && (
        <div className="w-full bg-gray-200 rounded-full overflow-hidden">
          <div
            className={`${currentSize.bar} ${getBarColor()} rounded-full transition-all duration-500`}
            style={{ width: `${percentage}%` }}
          />
        </div>
      )}

      {/* Upgrade nudge when near/at limit */}
      {showUpgradeNudge && !isUnlimited && remaining !== 'unlimited' && (remaining as number) <= 1 && (
        <button
          onClick={onUpgradeClick}
          className="mt-2 w-full flex items-center justify-center gap-2 px-3 py-2 bg-coral/10 border border-coral/30 rounded-none hover:bg-coral/20 transition-colors"
        >
          <TrendingUp className="h-4 w-4 text-danger-ink" />
          <span className={`${currentSize.text} text-danger-ink font-medium`}>
            {remaining === 0 ? 'Limit reached — Upgrade now' : '1 remaining — Upgrade soon'}
          </span>
        </button>
      )}

      {/* Warning when at limit */}
      {percentage >= 100 && !showUpgradeNudge && (
        <div className="mt-2 flex items-center gap-2 text-danger-ink">
          <AlertTriangle className="h-4 w-4" />
          <span className={`${currentSize.text} font-medium`}>
            Limit reached
          </span>
        </div>
      )}
    </div>
  );
}

/**
 * Compact inline version for dashboard header
 */
export function UsageDisplayInline({
  metric,
  used,
  limit,
  onClick,
}: {
  metric: MetricType;
  used: number;
  limit: number | 'unlimited';
  onClick?: () => void;
}) {
  const isUnlimited = limit === 'unlimited';
  const percentage = isUnlimited ? 0 : Math.min(100, (used / (limit as number)) * 100);

  const metricShortNames: Record<MetricType, string> = {
    access_requests: 'Requests',
    clients: 'Clients',
    members: 'Members',
    templates: 'Templates',
    client_onboards: 'Onboards',
    platform_audits: 'Audits',
    team_seats: 'Seats',
  };

  const shortName = metricShortNames[metric];

  return (
    <Button
      variant="secondary"
      size="sm"
      onClick={onClick}
      className="gap-2"
    >
      <span className="text-xs text-gray-600">{shortName}:</span>
      <span className="text-xs font-medium text-ink">
        {isUnlimited ? '∞' : `${used}/${limit}`}
      </span>
      {!isUnlimited && percentage >= 80 && (
        <span className={`h-2 w-2 rounded-full ${
          percentage >= 100 ? 'bg-coral' : 'bg-yellow-500'
        }`} />
      )}
    </Button>
  );
}
