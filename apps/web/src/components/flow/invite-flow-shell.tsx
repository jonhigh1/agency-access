import { ReactNode } from 'react';
import { Check } from 'lucide-react';

interface InviteFlowShellProps {
  title: string;
  description?: string;
  header?: ReactNode;
  step?: number;
  totalSteps?: number;
  steps?: string[];
  children: ReactNode;
}

/**
 * Single-column invite frame (Variant A): one truthful header, one slim
 * progress line, then one stage on screen. No rail, no dock, no step-chip wall.
 */
export function InviteFlowShell({
  title,
  description,
  header,
  step = 1,
  totalSteps,
  steps = ['Setup', 'Connect', 'Done'],
  children,
}: InviteFlowShellProps) {
  const hasProgress = typeof totalSteps === 'number' && totalSteps > 0;
  const safeStep = hasProgress ? Math.max(1, Math.min(step, Math.max(1, totalSteps))) : 1;
  const progress = hasProgress ? Math.round((safeStep / (totalSteps as number)) * 100) : 0;

  return (
    <div className="min-h-screen bg-paper">
      <div className="mx-auto max-w-xl px-4 py-8 sm:px-6 lg:px-8">
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

          {hasProgress ? (
          <div className="mt-5 border-t-2 border-black pt-3">
            <div
              className="h-1.5 w-full overflow-hidden bg-muted/40"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={progress}
              aria-label={`Step ${safeStep} of ${totalSteps}`}
            >
              <div
                className="h-full bg-coral transition-all duration-300 ease-out"
                style={{ width: `${progress}%` }}
              />
            </div>
            <div className="mt-2 flex items-center justify-between">
              <span className="label-nano">
                Step {safeStep} of {totalSteps}
                {steps[safeStep - 1] ? ` · ${steps[safeStep - 1]}` : ''}
              </span>
              <span className="label-nano flex items-center gap-1 text-success-ink">
                <Check className="h-3 w-3" aria-hidden />
                {progress}% complete
              </span>
            </div>
          </div>
          ) : null}
        </header>

        {children}
      </div>
    </div>
  );
}
