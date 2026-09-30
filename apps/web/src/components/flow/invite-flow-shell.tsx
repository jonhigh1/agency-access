import type { ReactNode } from 'react';
import { RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui';
import { trackInviteProgressCheckRequested } from '@/lib/analytics/invite-events';
import {
  INVITE_CHIP_STATUS_BY_PLATFORM_STATUS,
  type InvitePlatformChecklistEntry,
} from '@/lib/invite/platform-status';
import { InvitePlatformQueueItem } from './invite-platform-queue-item';

interface InviteFlowShellProps {
  title: string;
  description?: string;
  header?: ReactNode;
  /**
   * The flow's one progress surface (R3): a named-platform checklist with each
   * platform's actual state and next action. No percentage, no step counter,
   * and a completion icon only on done entries.
   */
  checklist?: InvitePlatformChecklistEntry[];
  /**
   * Check again (KTD7): refetches the invite payload BEFORE any result renders.
   * The shell only raises the request; the caller owns the fetch and swaps the
   * checklist entries once fresh data arrives.
   */
  onRefresh?: () => void;
  /** True while the caller's refresh is in flight. */
  isRefreshing?: boolean;
  /** Set when the refresh itself failed, so stale entries never read as fresh. */
  refreshError?: string | null;
  children: ReactNode;
}

/**
 * Single-column invite frame (Variant A): one truthful header, one progress
 * surface (the checklist), then one stage on screen. No rail, no dock, no
 * step-chip wall, no percentage bar.
 */
export function InviteFlowShell({
  title,
  description,
  header,
  checklist,
  onRefresh,
  isRefreshing = false,
  refreshError = null,
  children,
}: InviteFlowShellProps) {
  return (
    <div className="min-h-screen bg-paper">
      <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
        <header className="mb-8">
          {header ? (
            header
          ) : (
            <>
              <h1 className="text-2xl font-bold tracking-tight text-ink font-display">{title}</h1>
              {description ? (
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{description}</p>
              ) : null}
            </>
          )}

          {checklist && checklist.length > 0 ? (
            <div className="mt-5 border-t-2 border-black pt-3">
              <div className="flex items-center justify-between gap-3">
                <p className="label-micro">Your progress</p>
                {onRefresh ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      // U11: the shell raises the request; the page owns the
                      // fetch. One event per click, from the handler.
                      trackInviteProgressCheckRequested();
                      onRefresh();
                    }}
                    disabled={isRefreshing}
                    leftIcon={<RefreshCw className="h-3.5 w-3.5" aria-hidden />}
                  >
                    {isRefreshing ? 'Checking…' : 'Check again'}
                  </Button>
                ) : null}
              </div>
              <ul className="mt-1" aria-label="Request progress" aria-live="polite">
                {checklist.map((entry) => (
                  <li key={entry.platform}>
                    <InvitePlatformQueueItem
                      platform={entry.platform}
                      platformName={entry.platformName}
                      description={entry.copy}
                      status={INVITE_CHIP_STATUS_BY_PLATFORM_STATUS[entry.status]}
                      isActive={entry.isActive}
                    />
                  </li>
                ))}
              </ul>
              {refreshError ? (
                <p className="label-nano mt-1 text-danger-ink" role="status">
                  {refreshError}
                </p>
              ) : null}
            </div>
          ) : null}
        </header>

        {children}
      </div>
    </div>
  );
}
