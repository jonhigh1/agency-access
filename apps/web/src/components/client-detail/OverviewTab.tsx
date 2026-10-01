'use client';

/**
 * OverviewTab Component
 *
 * Displays access requests list with status filtering.
 * Shows each request with platforms, status badge, and dates.
 */

import { useState, useMemo } from 'react';
import { ExternalLink } from 'lucide-react';
import { Card, EmptyState, PlatformIcon, StatusBadge, SingleSelect } from '@/components/ui';
import type {
  ClientAccessRequest,
  ClientDetailPlatformGroup,
  Platform,
} from '@agency-platform/shared';
import Link from 'next/link';
import { RequestedAccessBoard } from './RequestedAccessBoard';
import { formatMediumDate } from '@/lib/format';

interface OverviewTabProps {
  platformGroups: ClientDetailPlatformGroup[];
  accessRequests: ClientAccessRequest[];
  initialExpandedPlatformGroup?: Platform;
}

type StatusFilter = 'all' | 'connected' | 'pending' | 'expired' | 'revoked';

export function OverviewTab({
  platformGroups,
  accessRequests,
  initialExpandedPlatformGroup,
}: OverviewTabProps) {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

  // Filter access requests based on selected status
  const filteredRequests = useMemo(() => {
    if (statusFilter === 'all') return accessRequests;

    return accessRequests.filter((request) => {
      switch (statusFilter) {
        case 'connected':
          return request.connectionStatus === 'active' || request.status === 'completed';
        case 'pending':
          return request.status === 'pending' || request.status === 'partial';
        case 'expired':
          return request.status === 'expired' || request.connectionStatus === 'expired';
        case 'revoked':
          return request.status === 'revoked' || request.connectionStatus === 'revoked';
        default:
          return true;
      }
    });
  }, [accessRequests, statusFilter]);

  const statusFilterOptions: { value: StatusFilter; label: string }[] = [
    { value: 'all', label: 'All Status' },
    { value: 'connected', label: 'Connected' },
    { value: 'pending', label: 'Pending' },
    { value: 'expired', label: 'Expired' },
    { value: 'revoked', label: 'Revoked' },
  ];

  return (
    <div className="space-y-6">
      <RequestedAccessBoard
        platformGroups={platformGroups}
        initialExpandedPlatformGroup={initialExpandedPlatformGroup}
      />

      <section>
        {/* Filter bar */}
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold text-foreground font-display">Access Requests</h3>

          {/* Status filter */}
          <div>
            <SingleSelect
              options={statusFilterOptions}
              value={statusFilter}
              onChange={(v) => setStatusFilter(v as StatusFilter)}
              ariaLabel="Filter access requests by status"
              className="min-w-[140px]"
            />
          </div>
        </div>

        {/* Access requests list */}
        {filteredRequests.length === 0 ? (
          <Card className="border-dashed border-border/70 bg-muted/10">
            <EmptyState
              title="No access requests found"
              description={statusFilter === 'all'
                ? 'Create a new access request to invite this client to authorize platforms.'
                : 'No access requests match this status. Choose another status to see more requests.'}
            />
          </Card>
        ) : (
          <div className="space-y-4">
            {filteredRequests.map((request) => (
              <Card
                key={request.id}
                className="p-5 border-black/10 hover:border-border transition-colors"
              >
                <div className="flex items-start justify-between">
                  {/* Left side: Name and platforms */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-2">
                      <h4 className="text-base font-semibold text-foreground">
                        {request.name}
                      </h4>
                      <span className="inline-flex items-center gap-1.5">
                        <span className="label-nano text-muted-foreground">Request</span>
                        <StatusBadge status={request.status} size="sm" />
                      </span>
                      {request.connectionStatus ? (
                        <span className="inline-flex items-center gap-1.5">
                          <span className="label-nano text-muted-foreground">Connection</span>
                          <StatusBadge status={request.connectionStatus} size="sm" />
                        </span>
                      ) : null}
                    </div>

                    {/* Platforms */}
                    <div className="flex flex-wrap gap-2 mb-3">
                      {request.platforms.length > 0 ? (
                        request.platforms.map((platform) => (
                          <PlatformIcon
                            key={platform}
                            platform={platform as Platform}
                            size="sm"
                          />
                        ))
                      ) : (
                        <span className="text-sm text-muted-foreground italic">No platforms</span>
                      )}
                    </div>

                    {/* Dates */}
                    <div className="flex gap-6 text-sm text-muted-foreground">
                      <div>
                        <span className="font-medium text-muted">Created:</span>{' '}
                        {formatMediumDate(request.createdAt)}
                      </div>
                      {request.authorizedAt && (
                        <div>
                          <span className="font-medium text-muted">Authorized:</span>{' '}
                          {formatMediumDate(request.authorizedAt)}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Right side: View details */}
                  <Link
                    href={`/access-requests/${request.id}` as any}
                    className="inline-flex items-center gap-1 text-sm text-primary hover:text-primary/90 ml-4 min-h-[44px]"
                  >
                    View details
                    <ExternalLink className="h-3.5 w-3.5" />
                  </Link>
                </div>
              </Card>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
