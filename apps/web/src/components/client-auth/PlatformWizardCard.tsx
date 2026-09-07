'use client';

/**
 * PlatformWizardCard - Container for platform-specific wizard
 *
 * Acid Brutalism Design:
 * - Hard borders (border-2 border-black)
 * - Brutalist shadow (shadow-brutalist)
 * - Minimal rounding (rounded-lg)
 * - Platform icon header
 * - Animated step transitions
 * - Footer with navigation buttons
 */

import { m, AnimatePresence } from 'framer-motion';
import { PlatformStepProgress } from './PlatformStepProgress';
import { PlatformIcon } from '@/components/ui/platform-icon';
import type { Platform } from '@agency-platform/shared';

interface PlatformWizardCardProps {
  platform: Platform;
  platformName: string;
  currentStep: 1 | 2 | 3 | 4;
  totalSteps?: 3 | 4;
  chrome?: 'full' | 'minimal';
  children: React.ReactNode;
  footer?: React.ReactNode;
}

export function PlatformWizardCard({
  platform,
  platformName,
  currentStep,
  totalSteps = 3,
  chrome = 'full',
  children,
  footer,
}: PlatformWizardCardProps) {
  const showFullChrome = chrome === 'full';

  return (
    <m.div
      className="bg-card rounded-lg shadow-brutalist border-2 border-black dark:border-white overflow-hidden"
      initial={false}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      {/* Header: Platform branding + progress */}
      {showFullChrome ? (
        <div className="border-b-2 border-black dark:border-white p-4 sm:p-5 bg-[var(--paper)]">
          <div className="flex items-center gap-3 mb-3">
            <PlatformIcon platform={platform} size="lg" />
            <div>
              <h2 className="text-2xl font-bold text-[var(--ink)] font-display">{platformName}</h2>
              <p className="text-sm text-muted-foreground dark:text-muted-foreground mt-1">
                Connect {platformName}
              </p>
            </div>
          </div>
          <PlatformStepProgress currentStep={currentStep} totalSteps={totalSteps} />
        </div>
      ) : null}

      {/* Content: Step-specific content with animation - min-h prevents blank collapse during transitions */}
      <div className={showFullChrome ? 'p-5 sm:p-6 min-h-[200px]' : 'p-4 sm:p-5 min-h-[180px]'}>
        <AnimatePresence mode="sync" initial={false}>
          <m.div
            key={currentStep}
            initial={false}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 1, x: -20 }}
            transition={{ duration: 0.25 }}
          >
            {children}
          </m.div>
        </AnimatePresence>
      </div>

      {/* Footer: Navigation (optional) */}
      {footer && (
        <div className="border-t-2 border-black bg-muted/20 p-4">
          {footer}
        </div>
      )}
    </m.div>
  );
}
