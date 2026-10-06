'use client';

import type { MetaConnectionErrorPresentation } from '@agency-platform/shared';
import { AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface MetaConnectionErrorPanelProps {
  error: MetaConnectionErrorPresentation;
  onRetry?: () => void;
  retryLabel?: string;
}

export function MetaConnectionErrorPanel({
  error,
  onRetry,
  retryLabel = 'Try again',
}: MetaConnectionErrorPanelProps) {
  return (
    <div
      className="border border-danger-ink bg-[rgb(var(--coral))]/10 p-4 my-3"
      role="alert"
      aria-live="polite"
    >
      <div className="flex items-start gap-3">
        <div className="w-8 h-8 border-2 border-[var(--coral)] bg-[var(--coral)]/20 flex items-center justify-center flex-shrink-0">
          <AlertCircle className="w-5 h-5 text-danger-ink" aria-hidden="true" />
        </div>

        <div className="flex-1 space-y-3">
          <div>
            <h3 className="font-bold text-danger-ink mb-1 font-display">{error.title}</h3>
            <p className="text-sm text-danger-ink">{error.message}</p>
            <p className="mt-2 text-xs font-mono text-danger-ink/90">
              Support code: <span className="font-semibold">{error.code}</span>
            </p>
          </div>

          {error.nextSteps.length > 0 ? (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-danger-ink mb-1">
                What to do next
              </p>
              <ol className="list-decimal list-inside space-y-1 text-sm text-danger-ink">
                {error.nextSteps.map((step) => (
                  <li key={step}>{step}</li>
                ))}
              </ol>
            </div>
          ) : null}

          {onRetry ? (
            <Button variant="brutalist" size="sm" onClick={onRetry}>
              {retryLabel}
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
