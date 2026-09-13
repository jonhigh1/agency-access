'use client';

import { ReactNode, useCallback, useEffect, useMemo, useState } from 'react';
import { Check, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

export interface ManualStepAction {
  label: string;
  onClick?: () => void | Promise<void>;
  href?: string;
  external?: boolean;
  disabled?: boolean;
  disabledReason?: string;
  loading?: boolean;
  loadingLabel?: string;
}

export interface ManualCompletionGate {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  requiredMessage?: string;
}

export interface ManualStepConfig {
  id: string;
  title: string;
  description?: string;
  content: ReactNode;
  primaryAction: ManualStepAction;
  completionGate?: ManualCompletionGate;
  helpContent?: ReactNode;
}

interface ManualChecklistWizardProps {
  platformName: string;
  steps: ManualStepConfig[];
  onStepView?: (payload: { stepId: string; stepIndex: number; totalSteps: number }) => void;
  onStepAdvanced?: (payload: {
    fromStepId: string;
    toStepId: string;
    fromStepIndex: number;
    toStepIndex: number;
    totalSteps: number;
  }) => void;
  onStepStateChange?: (payload: {
    stepId: string;
    stepTitle: string;
    stepIndex: number;
    totalSteps: number;
    actionLabel: string;
    blockedReason?: string;
    actionDisabled: boolean;
  }) => void;
}

export function ManualChecklistWizard({
  platformName,
  steps,
  onStepView,
  onStepAdvanced,
  onStepStateChange,
}: ManualChecklistWizardProps) {
  const [stepIndex, setStepIndex] = useState(0);
  const [validationError, setValidationError] = useState<string | null>(null);

  const totalSteps = steps.length;
  const currentStep = steps[stepIndex];

  useEffect(() => {
    if (!currentStep) return;
    onStepView?.({ stepId: currentStep.id, stepIndex, totalSteps });
  }, [currentStep, onStepView, stepIndex, totalSteps]);

  useEffect(() => {
    if (!currentStep) return;

    const blockedReason = currentStep.primaryAction.disabled
      ? currentStep.primaryAction.disabledReason || 'This step is currently unavailable.'
      : currentStep.completionGate && !currentStep.completionGate.checked
      ? currentStep.completionGate.requiredMessage || 'Please confirm completion before continuing.'
      : undefined;

    onStepStateChange?.({
      stepId: currentStep.id,
      stepTitle: currentStep.title,
      stepIndex,
      totalSteps,
      actionLabel: currentStep.primaryAction.label,
      blockedReason,
      actionDisabled: Boolean(
        currentStep.primaryAction.disabled ||
          currentStep.primaryAction.loading ||
          (currentStep.completionGate && !currentStep.completionGate.checked)
      ),
    });
  }, [currentStep, onStepStateChange, stepIndex, totalSteps]);

  const canGoBack = stepIndex > 0;
  const isLastStep = stepIndex === totalSteps - 1;

  const advanceStep = useCallback(() => {
    if (isLastStep) return;

    const nextStepIndex = stepIndex + 1;
    const nextStep = steps[nextStepIndex];
    if (!nextStep || !currentStep) return;

    onStepAdvanced?.({
      fromStepId: currentStep.id,
      toStepId: nextStep.id,
      fromStepIndex: stepIndex,
      toStepIndex: nextStepIndex,
      totalSteps,
    });

    setStepIndex(nextStepIndex);
    setValidationError(null);
  }, [currentStep, isLastStep, onStepAdvanced, stepIndex, steps, totalSteps]);

  const handleBack = useCallback(() => {
    if (!canGoBack) return;
    setStepIndex((prev) => prev - 1);
    setValidationError(null);
  }, [canGoBack]);

  const handlePrimaryAction = useCallback(async () => {
    if (!currentStep) return;

    const gate = currentStep.completionGate;
    if (gate && !gate.checked) {
      setValidationError(gate.requiredMessage || 'Please confirm completion before continuing.');
      return;
    }

    setValidationError(null);

    if (currentStep.primaryAction.href) {
      if (currentStep.primaryAction.external) {
        window.open(currentStep.primaryAction.href, '_blank', 'noopener,noreferrer');
      } else {
        window.location.assign(currentStep.primaryAction.href);
      }
      return;
    }

    if (currentStep.primaryAction.onClick) {
      await currentStep.primaryAction.onClick();
      return;
    }

    advanceStep();
  }, [advanceStep, currentStep]);

  const primaryDisabled = useMemo(() => {
    if (!currentStep) return true;
    if (currentStep.primaryAction.disabled || currentStep.primaryAction.loading) return true;
    if (currentStep.completionGate && !currentStep.completionGate.checked) return true;
    return false;
  }, [currentStep]);

  if (!currentStep) {
    return null;
  }

  const stepStatusLabel = `${stepIndex + 1} of ${totalSteps}`;
  const completedSteps = stepIndex;
  const progressPercent = Math.max(0, Math.min(100, Math.round((completedSteps / Math.max(1, totalSteps)) * 100)));

  return (
    <div className="rounded-lg border-2 border-black bg-card shadow-brutalist overflow-hidden">
      <div className="border-b border-border bg-paper px-4 py-4 sm:px-5 sm:py-5">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{platformName} Checklist</p>
        <div className="mt-2 flex items-start justify-between gap-3">
          <h2 className="text-base font-semibold text-ink font-display sm:text-lg">{currentStep.title}</h2>
        </div>
        {currentStep.description ? (
          <p
            data-hide-on-mobile-description="true"
            className="mt-2 hidden text-sm text-muted-foreground sm:block"
          >
            {currentStep.description}
          </p>
        ) : null}
        <div className="mt-3 sm:mt-4">
          <div className="flex items-center justify-between text-xs font-medium text-muted-foreground">
            <span>Step {stepStatusLabel}</span>
            <span>{completedSteps} of {totalSteps} completed</span>
          </div>
          <div
            data-hide-on-mobile-progress="true"
            className="mt-2 hidden h-2 overflow-hidden rounded-full bg-border/70 sm:block"
          >
            <div
              className="h-full rounded-full bg-coral transition-all duration-200"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>
      </div>

      <div className="space-y-3 px-4 py-4 sm:space-y-4 sm:px-5 sm:py-5">
        <div className="rounded-lg border border-border bg-paper px-3 py-3 sm:px-4 sm:py-4">
          {currentStep.content}
        </div>

        {currentStep.completionGate ? (
          <label className="flex items-start gap-3 rounded-lg border border-border bg-paper px-3 py-3 cursor-pointer">
            <input
              type="checkbox"
              checked={currentStep.completionGate.checked}
              onChange={(event) => {
                currentStep.completionGate?.onChange(event.target.checked);
                if (event.target.checked) {
                  setValidationError(null);
                }
              }}
              className="mt-1 h-4 w-4 rounded border-border text-danger-ink focus:ring-ring"
            />
            <span className="text-sm font-medium text-foreground">{currentStep.completionGate.label}</span>
          </label>
        ) : null}

        {validationError ? (
          <div className="rounded-lg border border-coral/30 bg-coral/10 px-3 py-2 text-sm text-danger-ink">
            {validationError}
          </div>
        ) : null}

        {currentStep.helpContent ? (
          <details className="rounded-lg border border-border bg-card px-3 py-2">
            <summary className="cursor-pointer text-sm font-medium text-foreground">Need help with this step?</summary>
            <div className="mt-2 text-sm text-muted-foreground">{currentStep.helpContent}</div>
          </details>
        ) : null}
      </div>

      <div className="hidden lg:block sticky bottom-4 z-10 px-5 pb-4">
        <div className="rounded-lg border border-border bg-paper px-3 py-3 flex items-center justify-between gap-3">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={handleBack}
            disabled={!canGoBack || currentStep.primaryAction.loading}
          >
            Back
          </Button>

          <Button
            type="button"
            variant="primary"
            size="sm"
            onClick={() => void handlePrimaryAction()}
            disabled={primaryDisabled}
          >
            {currentStep.primaryAction.loading
              ? currentStep.primaryAction.loadingLabel || 'Processing...'
              : currentStep.primaryAction.label}
            {!currentStep.primaryAction.loading ? <ChevronRight className="h-4 w-4" /> : null}
          </Button>
        </div>
      </div>

      <div className="border-t border-border bg-paper px-4 py-3 lg:hidden">
        <div className="mx-auto max-w-3xl flex items-center gap-3">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="flex-1"
            onClick={handleBack}
            disabled={!canGoBack || currentStep.primaryAction.loading}
          >
            Back
          </Button>
          <Button
            type="button"
            variant="primary"
            size="sm"
            className="flex-[1.4]"
            onClick={() => void handlePrimaryAction()}
            disabled={primaryDisabled}
          >
            {currentStep.primaryAction.loading
              ? currentStep.primaryAction.loadingLabel || 'Processing...'
              : currentStep.primaryAction.label}
          </Button>
        </div>
      </div>

      <div className="border-t border-border bg-paper px-5 py-3 flex items-center gap-2 text-xs text-muted-foreground">
        <Check className="h-4 w-4 text-success-ink" />
        Credentials are never requested in this flow.
      </div>
    </div>
  );
}
