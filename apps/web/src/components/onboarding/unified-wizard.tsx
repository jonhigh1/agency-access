/**
 * UnifiedWizard
 *
 * Reusable full-screen wizard container for the PLG onboarding flow.
 * Provides:
 * - Full-screen layout with gradient background
 * - Linear progress bar at top with step indicators
 * - Keyboard shortcuts (Enter to continue, Esc to skip when allowed)
 * - Mobile-responsive layout
 * - Prevents accidental exit before value delivered
 *
 * Design Principles:
 * - Interruptive: Full-screen experience that can't be ignored
 * - Celebratory: Progress visualization creates momentum
 * - Accessible: Keyboard navigation and screen reader support
 */

'use client';

import { useEffect, useCallback, ReactNode, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

// ============================================================
// TYPES
// ============================================================

export interface UnifiedWizardProps {
  children: ReactNode;
  currentStep: number;
  totalSteps: number;
  onNext: () => void;
  onBack: () => void;
  canGoNext: boolean;
  canGoBack: boolean;
  canSkip?: boolean;
  onSkip?: () => void;
  loading?: boolean;
  showClose?: boolean; // Only show close button after value delivered
  onClose?: () => void;
}

// ============================================================
// ANIMATION VARIANTS
// ============================================================

const slideVariants = {
  enter: (direction: number) => ({
    x: direction > 0 ? 50 : -50,
    opacity: 0,
    scale: 0.95,
  }),
  center: {
    x: 0,
    opacity: 1,
    scale: 1,
  },
  exit: (direction: number) => ({
    x: direction < 0 ? 50 : -50,
    opacity: 0,
    scale: 0.95,
  }),
};

const INTERACTIVE_TAG_NAMES = new Set(['INPUT', 'TEXTAREA', 'SELECT', 'BUTTON']);

function isInteractiveTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  if (target.isContentEditable) {
    return true;
  }

  return INTERACTIVE_TAG_NAMES.has(target.tagName);
}

// ============================================================
// COMPONENT
// ============================================================

export function UnifiedWizard({
  children,
  currentStep,
  totalSteps,
  onNext,
  onBack,
  canGoNext,
  canGoBack,
  canSkip = false,
  onSkip,
  loading = false,
  showClose = false,
  onClose,
}: UnifiedWizardProps) {
  const [direction, setDirection] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  // Track direction for slide animations
  const handleNext = useCallback(() => {
    if (canGoNext && !loading) {
      setDirection(1);
      onNext();
    }
  }, [canGoNext, loading, onNext]);

  const handleBack = useCallback(() => {
    if (canGoBack && !loading) {
      setDirection(-1);
      onBack();
    }
  }, [canGoBack, loading, onBack]);

  const handleSkip = useCallback(() => {
    if (canSkip && !loading && onSkip) {
      onSkip();
    }
  }, [canSkip, loading, onSkip]);

  // ============================================================
  // KEYBOARD SHORTCUTS
  // ============================================================

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isInteractive = isInteractiveTarget(e.target);

      // Enter: Continue to next step
      if (e.key === 'Enter' && !e.shiftKey && !e.metaKey && !e.ctrlKey && !isInteractive) {
        e.preventDefault();
        handleNext();
      }

      // Escape: Skip (if allowed) or close (if allowed)
      if (e.key === 'Escape') {
        if (canSkip && onSkip) {
          e.preventDefault();
          handleSkip();
        } else if (showClose && onClose) {
          e.preventDefault();
          onClose();
        }
      }

      // Arrow keys: Navigate between steps
      if (e.key === 'ArrowRight' && !isInteractive) {
        e.preventDefault();
        handleNext();
      }
      if (e.key === 'ArrowLeft' && !isInteractive) {
        e.preventDefault();
        handleBack();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleNext, handleBack, handleSkip, canSkip, onSkip, showClose, onClose]);

  // ============================================================
  // PROGRESS CALCULATION
  // ============================================================

  const progressPercentage = Math.round(((currentStep + 1) / totalSteps) * 100);
  return (
    <div
      ref={containerRef}
      className="min-h-screen bg-paper flex flex-col"
    >
      {/* Progress Bar */}
      <div className="w-full bg-paper border-b border-border">
        <div className="max-w-6xl mx-auto px-4 py-6 md:px-6">
          {/* Step Indicators */}
          <div className="flex items-center justify-between mb-3">
            <div className="text-sm font-medium text-foreground">
              Step {currentStep + 1} of {totalSteps}
            </div>
            <div className="text-sm font-medium text-foreground">
              {progressPercentage}% Complete
            </div>
          </div>

          {/* Linear Progress Bar */}
          <div className="relative h-2 bg-muted/30 rounded-full overflow-hidden">
            <motion.div
              className="absolute inset-y-0 left-0 bg-teal rounded-full"
              initial={{ width: `${((currentStep) / totalSteps) * 100}%` }}
              animate={{ width: `${progressPercentage}%` }}
              transition={{ duration: 0.5, ease: 'easeInOut' }}
            />
          </div>

          {/* Step Markers */}
          <div className="flex items-center justify-between mt-3">
            {Array.from({ length: totalSteps }).map((_, index) => {
              const isCompleted = index < currentStep;
              const isCurrent = index === currentStep;
              const isUpcoming = index > currentStep;

              return (
                <div
                  key={index}
                  className="flex-1 flex items-center"
                  style={{ opacity: isUpcoming ? 0.5 : 1 }}
                >
                  <div
                    className={`flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold border ${
                      isCompleted || isCurrent
                        ? 'bg-ink text-white border-ink'
                        : 'bg-transparent text-foreground border-border'
                    }`}
                  >
                    {isCompleted ? '✓' : index + 1}
                  </div>
                  {index < totalSteps - 1 && (
                    <div className="flex-1 h-px bg-border mx-1" />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex items-start justify-center p-4 md:px-6 md:py-8">
        <motion.div
          className="w-full max-w-6xl"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={currentStep}
              custom={direction}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{
                x: { type: 'spring', stiffness: 300, damping: 30 },
                opacity: { duration: 0.2 },
                scale: { duration: 0.2 },
              }}
            >
              {/* Content Card */}
              <div className="bg-card rounded-lg shadow-brutalist-lg overflow-hidden border-2 border-black">
                {/* Close Button (only after value delivered) */}
                {showClose && onClose && (
                  <button
                    onClick={onClose}
                    className="absolute top-4 right-4 z-10 p-2 text-muted-foreground hover:bg-muted/10 rounded-none transition-colors"
                    aria-label="Close"
                  >
                    <X className="w-5 h-5 text-muted-foreground" />
                  </button>
                )}

                {children}
              </div>
            </motion.div>
          </AnimatePresence>
        </motion.div>
      </div>

      {/* Navigation Footer */}
      <div className="bg-paper border-t border-border">
        <div className="max-w-6xl mx-auto px-4 py-6 md:px-6">
          <div className="flex items-center justify-between">
            {/* Back Button */}
            {canGoBack ? (
              <Button
                variant="secondary"
                size="sm"
                onClick={handleBack}
                disabled={loading}
                aria-label="Go back to previous step"
              >
                <ChevronLeft className="w-5 h-5" />
                Back
              </Button>
            ) : (
              <div /> // Spacer for flex layout
            )}

            {/* Skip Button (optional steps only) */}
            {canSkip && onSkip && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleSkip}
                disabled={loading}
              >
                Skip for now →
              </Button>
            )}

            {/* Next/Continue Button */}
            <Button
              variant="brutalist"
              size="md"
              onClick={handleNext}
              disabled={!canGoNext || loading}
              aria-label={currentStep === totalSteps - 1 ? 'Complete onboarding' : 'Continue to next step'}
            >
              {loading ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Processing...
                </>
              ) : currentStep === totalSteps - 1 ? (
                <>
                  Complete
                  <ChevronRight className="w-5 h-5" />
                </>
              ) : (
                <>
                  Continue
                  <ChevronRight className="w-5 h-5" />
                </>
              )}
            </Button>
          </div>

          {/* Keyboard Shortcuts Hint */}
          <div className="mt-4 text-center text-xs text-muted-foreground">
            Press <kbd className="px-1.5 py-0.5 rounded bg-muted/20 border border-border font-mono text-foreground">Enter</kbd> to continue
            {canSkip && (
              <>
                {' • '}
                <kbd className="px-1.5 py-0.5 rounded bg-muted/20 border border-border font-mono text-foreground">Esc</kbd> to skip
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
