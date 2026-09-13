'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ChevronDown, ChevronRight, ExternalLink } from 'lucide-react';
import { PLATFORM_NAMES } from '@agency-platform/shared';
import type {
  ClientDetailPlatformGroup,
  ClientDetailPlatformProduct,
  Platform,
} from '@agency-platform/shared';
import { Card, EmptyState, PlatformIcon, StatusBadge, Button } from '@/components/ui';
import {
  formatConnectedProgress,
  getPlatformGroupBadgeConfig,
  getProductBadgeConfig,
} from './status-presentation';
import { formatMediumDate } from '@/lib/format';

interface RequestedAccessBoardProps {
  platformGroups: ClientDetailPlatformGroup[];
  initialExpandedPlatformGroup?: Platform;
}

function renderStatusBadge(
  config:
    | ReturnType<typeof getPlatformGroupBadgeConfig>
    | ReturnType<typeof getProductBadgeConfig>
) {
  if ('status' in config) {
    return <StatusBadge status={config.status} size="sm" />;
  }

  return (
    <StatusBadge badgeVariant={config.badgeVariant} size="sm">
      {config.label}
    </StatusBadge>
  );
}

function formatPlatformLabel(platform: string): string {
  return PLATFORM_NAMES[platform as Platform] || platform.replace(/_/g, ' ');
}

function ProductRow({ product }: { product: ClientDetailPlatformProduct }) {
  const badgeConfig = getProductBadgeConfig(product.status);

  return (
    <div className="grid gap-3 rounded-lg border border-border/70 bg-paper/40 px-4 py-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
      <div className="min-w-0">
        <p className="text-sm font-medium text-foreground">{formatPlatformLabel(product.product)}</p>
        {product.note ? (
          <p className="mt-1 text-xs text-muted-foreground">{product.note}</p>
        ) : null}
      </div>
      <div className="justify-self-start sm:justify-self-end">{renderStatusBadge(badgeConfig)}</div>
    </div>
  );
}

export function RequestedAccessBoard({
  platformGroups,
  initialExpandedPlatformGroup,
}: RequestedAccessBoardProps) {
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>(() =>
    initialExpandedPlatformGroup
      ? { [initialExpandedPlatformGroup]: true }
      : {}
  );

  useEffect(() => {
    if (!initialExpandedPlatformGroup) {
      return;
    }

    setExpandedGroups((current) => ({
      ...current,
      [initialExpandedPlatformGroup]: true,
    }));
  }, [initialExpandedPlatformGroup]);

  const toggleGroup = (platformGroup: string) => {
    setExpandedGroups((current) => ({
      ...current,
      [platformGroup]: !current[platformGroup],
    }));
  };

  return (
    <Card className="border-black/10 shadow-sm">
      <div className="border-b border-border px-6 py-4">
        <h3 className="text-lg font-semibold text-foreground font-display">Requested Access</h3>
        <p className="text-sm text-muted-foreground">
          Review platform-group progress before digging into request history.
        </p>
      </div>

      <div className="p-6">
        {platformGroups.length === 0 ? (
          <Card className="border-dashed border-border/70 bg-muted/10">
            <EmptyState
              title="No requested platforms yet"
              description="Create an access request to start tracking grouped platform progress for this client."
            />
          </Card>
        ) : (
          <div className="space-y-4">
            {platformGroups.map((group) => {
              const platformLabel = formatPlatformLabel(group.platformGroup);
              const badgeConfig = getPlatformGroupBadgeConfig(group.status);
              const isExpanded = !!expandedGroups[group.platformGroup];

              return (
                <div
                  key={group.platformGroup}
                  className="rounded-xl border border-border bg-card"
                >
                  <div className="grid gap-4 px-4 py-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start sm:px-5">
                    <div className="min-w-0">
                      <div className="flex items-center gap-3">
                        <PlatformIcon platform={group.platformGroup} size="sm" />
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-foreground">{platformLabel}</p>
                          {group.latestRequestedAt ? (
                            <p className="text-xs text-muted-foreground">
                              Last requested {formatMediumDate(group.latestRequestedAt)}
                            </p>
                          ) : null}
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                      <p className="text-sm font-medium text-foreground">
                        {formatConnectedProgress(group.fulfilledCount, group.requestedCount)}
                      </p>
                      {renderStatusBadge(badgeConfig)}
                      {group.latestRequestId ? (
                        <Button asChild variant="secondary" size="sm">
                          <Link href={`/access-requests/${group.latestRequestId}` as any}>
                            View request
                            <ExternalLink className="h-3.5 w-3.5" />
                          </Link>
                        </Button>
                      ) : null}
                      <button
                        type="button"
                        onClick={() => toggleGroup(group.platformGroup)}
                        aria-expanded={isExpanded}
                        aria-controls={`platform-group-${group.platformGroup}`}
                        className="inline-flex min-h-[36px] items-center gap-1 rounded-none border border-border px-3 text-xs font-medium text-foreground transition-colors hover:bg-muted/50"
                        aria-label={`${isExpanded ? 'Collapse' : 'Expand'} ${platformLabel} details`}
                      >
                        {isExpanded ? (
                          <ChevronDown className="h-3.5 w-3.5" />
                        ) : (
                          <ChevronRight className="h-3.5 w-3.5" />
                        )}
                        Details
                      </button>
                    </div>
                  </div>

                  {isExpanded ? (
                    <div
                      id={`platform-group-${group.platformGroup}`}
                      className="border-t border-border px-4 py-4 sm:px-5"
                    >
                      <div className="space-y-3">
                        {group.products.map((product) => (
                          <ProductRow key={`${group.platformGroup}-${product.product}`} product={product} />
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </Card>
  );
}
