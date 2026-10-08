'use client';

/**
 * Inline agency Meta Business Portfolio panel for the onboarding platform step.
 *
 * Shown when Meta is selected. Access requests that include Meta need the
 * agency's own Meta connection plus a selected Business Portfolio, so instead
 * of failing on Continue we let the agency connect right here. "Connect"
 * reuses the existing agency Meta OAuth flow; the shared /platforms/callback
 * page handles portfolio selection and then returns to this step.
 */

import { AlertCircle, CheckCircle2, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PlatformIcon } from '@/components/ui/platform-icon';
import type { MetaPortfolioReadiness } from '@/lib/onboarding/meta-readiness';

export interface MetaPortfolioPanelProps {
  readiness: MetaPortfolioReadiness;
  justConnected?: boolean;
  connecting?: boolean;
  onConnect: () => void;
  onRetry: () => void;
}

export function MetaPortfolioPanel({ readiness, justConnected, connecting, onConnect, onRetry }: MetaPortfolioPanelProps) {
  const headingId = 'onboarding-meta-portfolio-heading';

  return (
    <section
      aria-labelledby={headingId}
      aria-live="polite"
      data-testid="meta-portfolio-panel"
      data-status={readiness.status}
      className="mt-6 rounded-lg border-2 border-black bg-card p-5 shadow-brutalist-sm"
    >
      <div className="flex items-start gap-4">
        <div className="mt-0.5 flex-shrink-0">
          <PlatformIcon platform="meta" size="md" />
        </div>
        <div className="min-w-0 flex-1">
          <h3 id={headingId} className="font-semibold text-ink">
            Your agency&apos;s Meta Business Portfolio
          </h3>

          {(readiness.status === 'idle' || readiness.status === 'loading') && (
            <p className="mt-1 text-sm text-ink/70">Checking your Meta connection…</p>
          )}

          {readiness.status === 'not_connected' && (
            <>
              <p className="mt-1 text-sm text-ink/70">
                Meta grants your client&apos;s Pages and ad accounts to your agency&apos;s Business Portfolio.
                Connect it once and pick the portfolio, and you&apos;ll come straight back here.
              </p>
              <div className="mt-4 flex flex-wrap items-center gap-3">
                <Button variant="primary" size="md" onClick={onConnect} isLoading={connecting} disabled={connecting}>
                  Connect Meta Business Portfolio
                </Button>
                <span className="text-xs text-ink/60">Or deselect Meta to continue with your other platforms.</span>
              </div>
            </>
          )}

          {readiness.status === 'needs_portfolio' && (
            <>
              <p className="mt-1 text-sm text-ink/70">
                Meta is connected, but no Business Portfolio is selected yet. Choose the portfolio that should
                receive client access.
              </p>
              <div className="mt-4 flex flex-wrap items-center gap-3">
                <Button variant="primary" size="md" onClick={onConnect} isLoading={connecting} disabled={connecting}>
                  Choose Business Portfolio
                </Button>
                <span className="text-xs text-ink/60">Or deselect Meta to continue with your other platforms.</span>
              </div>
            </>
          )}

          {readiness.status === 'ready' && (
            <p className="mt-1 flex items-center gap-2 text-sm text-success-ink">
              <CheckCircle2 className="h-4 w-4 flex-shrink-0" aria-hidden="true" />
              <span>
                {justConnected ? 'Meta connected. ' : 'Connected: '}
                <span className="font-semibold">{readiness.portfolioName || 'Business Portfolio selected'}</span>
              </span>
            </p>
          )}

          {readiness.status === 'error' && (
            <>
              <p className="mt-1 flex items-start gap-2 text-sm text-red-900">
                <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" aria-hidden="true" />
                <span>We couldn&apos;t check your Meta connection. {readiness.message}</span>
              </p>
              <div className="mt-4 flex flex-wrap items-center gap-3">
                <Button variant="secondary" size="sm" onClick={onRetry} leftIcon={<RefreshCw className="h-4 w-4" aria-hidden="true" />}>
                  Check again
                </Button>
                <Button variant="ghost" size="sm" onClick={onConnect} disabled={connecting}>
                  Connect Meta
                </Button>
              </div>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
