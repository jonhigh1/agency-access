'use client';

/**
 * Inline agency Meta Business Portfolio panel for the onboarding platform step.
 *
 * Shown when Meta is selected. Access requests that include Meta need the
 * agency's own Meta connection plus a selected Business Portfolio, so instead
 * of failing on Continue we let the agency connect right here. "Connect"
 * reuses the existing agency Meta OAuth flow; the shared /platforms/callback
 * page handles portfolio selection and then returns to this step.
 *
 * Never a dead end: an agency without a portfolio gets a link to create one in
 * a new tab plus "Check again", and every non-ready state offers "Skip Meta
 * for now" so Continue is always reachable.
 */

import { AlertCircle, CheckCircle2, ExternalLink, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PlatformIcon } from '@/components/ui/platform-icon';
import { META_CREATE_BUSINESS_PORTFOLIO_URL, type MetaPortfolioReadiness } from '@/lib/onboarding/meta-readiness';

export interface MetaPortfolioPanelProps {
  readiness: MetaPortfolioReadiness;
  justConnected?: boolean;
  connecting?: boolean;
  onConnect: () => void;
  onRetry: () => void;
  /** Deselect Meta so the agency can continue now and connect it later from Connections. */
  onSkip?: () => void;
}

export function CreateBusinessPortfolioHint({ guidance }: { guidance: string }) {
  return (
    <p className="mt-3 text-sm text-ink/70" data-testid="meta-create-portfolio-hint">
      No Business Portfolio yet?{' '}
      <a
        href={META_CREATE_BUSINESS_PORTFOLIO_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1 font-semibold text-ink underline underline-offset-2"
      >
        Create a Business Portfolio
        <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
        <span className="sr-only">(opens in a new tab)</span>
      </a>{' '}
      {guidance}
    </p>
  );
}

export function MetaPortfolioPanel({ readiness, justConnected, connecting, onConnect, onRetry, onSkip }: MetaPortfolioPanelProps) {
  const headingId = 'onboarding-meta-portfolio-heading';
  const checkAgain = (
    <Button
      variant="secondary"
      size="sm"
      onClick={onRetry}
      disabled={connecting}
      leftIcon={<RefreshCw className="h-4 w-4" aria-hidden="true" />}
    >
      Check again
    </Button>
  );


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
                {checkAgain}
              </div>
              <CreateBusinessPortfolioHint guidance="It opens in a new tab. Once it's created, come back and connect it here." />
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
                {checkAgain}
              </div>
              <CreateBusinessPortfolioHint guidance="It opens in a new tab. Once it's created, come back and choose it here." />
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
                {checkAgain}
                <Button variant="ghost" size="sm" onClick={onConnect} disabled={connecting}>
                  Connect Meta
                </Button>
              </div>
            </>
          )}

          {readiness.status !== 'ready' && onSkip && (
            <div className="mt-4 border-t-2 border-black/10 pt-3">
              <Button variant="ghost" size="sm" onClick={onSkip} disabled={connecting} data-testid="meta-skip">
                Skip Meta for now, connect later
              </Button>
              <p className="mt-1 text-xs text-ink/60">
                Continue with your other platforms. You can connect Meta later from Connections.
              </p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
