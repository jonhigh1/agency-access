'use client';

/**
 * UpgradeModal Component
 *
 * Modal shown when users hit their quota limits.
 * Shows current usage, tier comparison, and upgrade CTA.
 */

import { useEffect } from 'react';
import { m, AnimatePresence } from 'framer-motion';
import { X, TrendingUp, Check, ArrowRight } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@clerk/nextjs';
import { SUBSCRIPTION_TIER_NAMES, TIER_LIMITS } from '@agency-platform/shared';
import type { QuotaExceededError } from '@/lib/query/quota';
import { subscriptionTierToPlanSlug, trackCapHit } from '@/lib/analytics/billing';

interface UpgradeModalProps {
  isOpen: boolean;
  onClose: () => void;
  quotaError: QuotaExceededError;
}

export function UpgradeModal({
  isOpen,
  onClose,
  quotaError,
}: UpgradeModalProps) {
  const router = useRouter();
  const { orgId, userId } = useAuth();
  const agencyId = orgId ?? userId ?? null;

  const metric = quotaError?.metric;
  const limit = quotaError?.limit;
  const used = quotaError?.used ?? 0;
  const errorTier = quotaError?.currentTier;

  useEffect(() => {
    if (!quotaError || !isOpen || metric !== 'clients' || limit === 'unlimited' || !errorTier) {
      return;
    }

    trackCapHit({
      agency_id: agencyId,
      plan: subscriptionTierToPlanSlug(errorTier),
      clients_used: used,
      plan_cap: limit as number,
    });
  }, [agencyId, errorTier, isOpen, limit, metric, quotaError, used]);

  if (!quotaError) return null;

  const {
    remaining,
    suggestedTier,
    upgradeUrl,
  } = quotaError;

  // Get metric display name
  const metricNames: Record<string, string> = {
    clients: 'Clients',
    members: 'Team Members',
    access_requests: 'Access Requests',
    templates: 'Templates',
    client_onboards: 'Client Onboards (yearly)',
    platform_audits: 'Platform Audits (yearly)',
    team_seats: 'Team Seats',
  };

  const metricName = metricNames[metric] || metric;
  const limitDisplay = limit === 'unlimited' ? 'Unlimited' : limit.toString();

  // Get suggested tier info
  const suggestedTierConfig = suggestedTier
    ? TIER_LIMITS[suggestedTier]
    : null;

  // Compute progress bar values before rendering
  const percentage = limit === 'unlimited'
    ? 0
    : Math.min(100, (used / (limit as number)) * 100);

  const progressWidth = `${percentage}%`;

  let progressClassName = 'h-full';
  if (remaining === 0 || remaining === 'unlimited') {
    progressClassName += ' bg-coral';
  } else if (typeof remaining === 'number' && remaining > (limit as number) * 0.2) {
    progressClassName += ' bg-teal';
  } else {
    progressClassName += ' bg-warning';
  }

  const handleUpgrade = () => {
    if (upgradeUrl) {
      window.location.href = upgradeUrl;
    } else if (suggestedTier) {
      router.push(`/checkout?tier=${suggestedTier}` as any);
    }
    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <m.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
          onClick={onClose}
        >
          <m.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            onClick={(e) => e.stopPropagation()}
            className="bg-card rounded-lg shadow-brutalist max-w-lg w-full border-2 border-black"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-black/10">
              <h2 className="text-lg font-semibold text-ink">Upgrade Required</h2>
              <button
                onClick={onClose}
                className="p-1 hover:bg-muted rounded-lg transition-colors"
              >
                <X className="h-5 w-5 text-muted-foreground" />
              </button>
            </div>

            {/* Content */}
            <div className="p-6">
              {/* Limit reached message */}
              <div className="flex items-center gap-3 mb-6">
                <div className="p-3 bg-coral/20 rounded-full">
                  <TrendingUp className="h-6 w-6 text-danger-ink" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-ink">
                    You've reached your {metricName} limit
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    Upgrade to continue adding more {metricName.toLowerCase()}
                  </p>
                </div>
              </div>

              {/* Current usage display */}
              <div className="bg-muted border-2 border-black rounded-lg p-4 mb-6">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm font-medium text-foreground">
                    {SUBSCRIPTION_TIER_NAMES[errorTier]} Plan
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {used} / {limitDisplay} used
                  </span>
                </div>

                <div className="w-full bg-border rounded-full h-3 overflow-hidden">
                  <m.div
                    initial={{ width: 0 }}
                    animate={{ width: progressWidth }}
                    transition={{ duration: 0.5 }}
                    className={progressClassName}
                  />
                </div>

                {/* Suggested tier comparison */}
                {suggestedTier && suggestedTierConfig && (
                  <div className="border-2 border-black/10 rounded-lg p-4 mb-6">
                    <h4 className="text-sm font-semibold text-ink mb-3">
                      Upgrade to {SUBSCRIPTION_TIER_NAMES[suggestedTier]} for more:
                    </h4>
                    <ul className="space-y-2">
                      <li className="flex items-center gap-2 text-sm text-foreground">
                        <Check className="h-4 w-4 text-success-ink" />
                        <span>
                          Up to <strong>{suggestedTierConfig.clients === -1 ? 'unlimited' : suggestedTierConfig.clients}</strong> clients
                        </span>
                      </li>
                      <li className="flex items-center gap-2 text-sm text-foreground">
                        <Check className="h-4 w-4 text-success-ink" />
                        <span>
                          Up to <strong>{suggestedTierConfig.members === -1 ? 'unlimited' : suggestedTierConfig.members}</strong> team members
                        </span>
                      </li>
                      <li className="flex items-center gap-2 text-sm text-foreground">
                        <Check className="h-4 w-4 text-success-ink" />
                        <span>
                          Up to <strong>{suggestedTierConfig.accessRequests === -1 ? 'unlimited' : suggestedTierConfig.accessRequests}</strong> access requests
                        </span>
                      </li>
                      {suggestedTierConfig.priceYearly && (
                        <li className="flex items-center gap-2 text-sm text-foreground pt-2 border-t border-black/10">
                          <span className="font-medium">
                            ${suggestedTierConfig.priceYearly}/month
                          </span>
                          <span className="text-xs text-muted-foreground">
                            (billed annually)
                          </span>
                        </li>
                      )}
                    </ul>
                  </div>
                )}

                {/* Features list for suggested tier */}
                {suggestedTierConfig?.features && (
                  <div className="mb-6">
                    <h4 className="text-sm font-semibold text-ink mb-2">
                      Additional features:
                    </h4>
                    <div className="flex flex-wrap gap-2">
                      {suggestedTierConfig.features.map((feature) => {
                        const formattedFeature = feature
                          .replace(/_/g, ' ')
                          .replace(/\b\w/g, (char: string) => char.toUpperCase());
                        return (
                          <span
                            key={feature}
                            className="px-2 py-1 bg-teal/10 text-success-ink text-xs rounded-md border border-teal/20"
                          >
                            {formattedFeature}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="flex justify-end gap-3 px-6 py-4 border-t-2 border-black/10 bg-muted rounded-b-lg">
                <button
                  onClick={onClose}
                  className="px-4 py-2 border-2 border-black text-foreground rounded-lg hover:bg-muted transition-colors"
                >
                  Maybe Later
                </button>
                <button
                  onClick={handleUpgrade}
                  className="px-4 py-2 bg-coral text-white rounded-lg hover:bg-coral/90 transition-colors flex items-center gap-2 shadow-brutalist"
                >
                  Upgrade Now
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          </m.div>
        </m.div>
      )}
    </AnimatePresence>
  );
}
