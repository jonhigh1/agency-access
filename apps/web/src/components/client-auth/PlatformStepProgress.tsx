'use client';

/**
 * PlatformStepProgress - Brutalist 3-4 step progress indicator
 *
 * Acid Brutalism Design:
 * - Bold step numbers with hard borders
 * - Coral for current step (brand accent)
 * - Teal for completed steps (success)
 * - Minimal animation (brutalist restraint)
 * - Clear visual hierarchy
 */

import { m } from 'framer-motion';
import { Check } from 'lucide-react';

interface PlatformStepProgressProps {
  currentStep: 1 | 2 | 3 | 4;
  totalSteps?: 3 | 4;
}

const steps3 = [
  { number: 1, label: 'Connect' },
  { number: 2, label: 'Choose' },
  { number: 3, label: 'Done' },
];

const steps4 = [
  { number: 1, label: 'Connect' },
  { number: 2, label: 'Choose' },
  { number: 3, label: 'Grant' },
  { number: 4, label: 'Done' },
];

export function PlatformStepProgress({ currentStep, totalSteps = 3 }: PlatformStepProgressProps) {
  const steps = totalSteps === 4 ? steps4 : steps3;

  return (
    <div className="w-full">
      {/* Step Numbers Row - Brutalist Style */}
      <div className="flex items-center justify-center gap-1">
        {steps.map((step, index) => {
          const isCompleted = currentStep > step.number;
          const isCurrent = currentStep === step.number;

          return (
            <div key={step.number} className="flex items-center">
              {/* Step Box */}
              <m.div
                className={`
                  w-8 h-8 flex items-center justify-center
                  border-2 font-bold text-sm
                  transition-colors duration-200
                  ${
                    isCompleted
                      ? 'bg-[var(--teal)] border-[var(--teal)] text-white'
                      : isCurrent
                      ? 'bg-[var(--coral)] border-[var(--coral)] text-white shadow-brutalist-sm'
                      : 'bg-transparent border-black dark:border-white text-muted-foreground'
                  }
                `}
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: index * 0.1 }}
              >
                {isCompleted ? (
                  <Check className="w-5 h-5" strokeWidth={3} />
                ) : (
                  step.number
                )}
              </m.div>

              {/* Connector Line */}
              {index < steps.length - 1 && (
                <div
                  className={`
                    w-8 h-0.5 mx-1
                    ${index < currentStep - 1 ? 'bg-[var(--teal)]' : 'bg-muted/50 dark:bg-muted/50'}
                  `}
                />
              )}
            </div>
          );
        })}
      </div>

      {/* Step Labels Row */}
      <div className="flex items-center justify-center gap-1 mt-2">
        {steps.map((step, index) => {
          const isCompleted = currentStep > step.number;
          const isCurrent = currentStep === step.number;

          return (
            <div key={step.number} className="flex items-center">
              <span
                className={`
                  text-xs font-semibold uppercase tracking-wide
                  ${
                    isCompleted
                      ? 'text-success-ink'
                      : isCurrent
                      ? 'text-ink'
                      : 'text-muted-foreground'
                  }
                `}
                style={{ width: index < steps.length - 1 ? '2.5rem' : 'auto' }}
              >
                {step.label}
              </span>

              {/* Spacer for connector alignment */}
              {index < steps.length - 1 && (
                <div className="w-8 mx-1" />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
