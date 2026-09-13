'use client';

/**
 * CancelSubscriptionModal Component
 *
 * Confirmation modal for canceling subscriptions.
 * Offers option to cancel immediately or at period end.
 * Square surface, 2px ink border, no shadow; the confirm button is `danger`.
 */

import { useState } from 'react';
import { X, Loader2, AlertTriangle, CheckCircle2, Calendar } from 'lucide-react';
import { useCancelSubscription } from '@/lib/query/billing';
import { getPricingTierNameFromSubscriptionTier, type SubscriptionTier } from '@agency-platform/shared';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@clerk/nextjs';
import { Button } from '@/components/ui/button';

interface CancelSubscriptionModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentTier: SubscriptionTier;
}

export function CancelSubscriptionModal({
  isOpen,
  onClose,
  currentTier,
}: CancelSubscriptionModalProps) {
  const { orgId } = useAuth();
  const queryClient = useQueryClient();
  const cancelMutation = useCancelSubscription();

  const [cancelAtPeriodEnd, setCancelAtPeriodEnd] = useState(true);
  const [showFeedback, setShowFeedback] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleCancel = async () => {
    setErrorMessage(null);

    try {
      await cancelMutation.mutateAsync({
        cancelAtPeriodEnd,
      });

      setSuccess(true);

      // Close modal after success message
      setTimeout(() => {
        onClose();
        setSuccess(false);
        setShowFeedback(false);
        setFeedback('');
        setCancelAtPeriodEnd(true);
      }, 2000);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Failed to cancel subscription');
    }
  };

  const handleSubmitFeedback = () => {
    // In a real implementation, you'd send this feedback to your analytics/service
    // For now, just proceed with cancellation
    setShowFeedback(false);
    handleCancel();
  };

  if (!isOpen) return null;

  const timingOptionClass = (active: boolean) =>
    `flex cursor-pointer items-start gap-3 border p-4 transition-colors duration-150 ${
      active ? 'border-coral bg-coral/10' : 'border-border hover:border-black'
    }`;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="cancel-subscription-title"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md border-2 border-black bg-card"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 hairline-b">
          <h2 id="cancel-subscription-title" className="font-display text-lg font-semibold text-ink">
            Cancel Subscription
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="p-1 transition-colors duration-150 hover:bg-muted"
          >
            <X className="h-5 w-5 text-muted-foreground" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {!success ? (
            <>
              {/* Warning icon */}
              <div className="mb-4 flex items-center gap-3">
                <div className="rounded-full bg-coral/20 p-3">
                  <AlertTriangle className="h-6 w-6 text-danger-ink" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-ink">
                    Cancel {getPricingTierNameFromSubscriptionTier(currentTier)} Plan?
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    This action will affect your access to platform features
                  </p>
                </div>
              </div>

              {/* Warning message */}
              <div className="mb-6 border border-coral/30 bg-coral/10 p-4">
                <p className="text-sm text-danger-ink">
                  <strong>Important:</strong> After cancellation, you will lose access to paid plan features
                  and will move to Free plan limits. Any remaining clients, team members, or access requests
                  exceeding those limits may be restricted.
                </p>
              </div>

              {/* Cancellation timing options */}
              <div className="mb-6 space-y-3">
                <h4 className="text-sm font-semibold text-ink">When should we cancel?</h4>

                <label className={timingOptionClass(cancelAtPeriodEnd)}>
                  <input
                    type="radio"
                    name="cancelTiming"
                    checked={cancelAtPeriodEnd}
                    onChange={() => setCancelAtPeriodEnd(true)}
                    className="mt-1"
                  />
                  <div className="flex-1">
                    <div className="mb-1 flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-danger-ink" />
                      <p className="font-medium text-ink">At the end of the billing period (Recommended)</p>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Your subscription will remain active until the current billing period ends. You can reactivate anytime before then.
                    </p>
                  </div>
                </label>

                <label className={timingOptionClass(!cancelAtPeriodEnd)}>
                  <input
                    type="radio"
                    name="cancelTiming"
                    checked={!cancelAtPeriodEnd}
                    onChange={() => setCancelAtPeriodEnd(false)}
                    className="mt-1"
                  />
                  <div className="flex-1">
                    <p className="mb-1 font-medium text-ink">Immediately</p>
                    <p className="text-sm text-muted-foreground">
                      Your subscription will be canceled right away and you will lose access to paid features immediately.
                    </p>
                  </div>
                </label>
              </div>

              {/* Feedback section */}
              <div className="mb-6">
                <button
                  type="button"
                  onClick={() => setShowFeedback(!showFeedback)}
                  className="mb-2 flex items-center gap-1 text-sm text-danger-ink underline-offset-4 hover:underline"
                >
                  {showFeedback ? (
                    <>
                      <X className="h-3 w-3" />
                      Hide feedback
                    </>
                  ) : (
                    <>Tell us why you're leaving (optional)</>
                  )}
                </button>
                {showFeedback && (
                  <textarea
                    value={feedback}
                    onChange={(e) => setFeedback(e.target.value)}
                    placeholder="Help us improve by letting us know why you're canceling..."
                    aria-label="Reason for canceling"
                    className="w-full resize-none border border-black px-3 py-2"
                    rows={3}
                  />
                )}
              </div>

              {/* Error message */}
              {errorMessage && (
                <div className="mb-4 border border-coral/30 bg-coral/10 p-3">
                  <p className="text-sm text-danger-ink">{errorMessage}</p>
                </div>
              )}

              {/* Actions */}
              <div className="flex flex-wrap justify-end gap-3 border-t border-border pt-4">
                <Button variant="secondary" onClick={onClose} disabled={cancelMutation.isPending}>
                  Keep Subscription
                </Button>
                {showFeedback && feedback.trim() ? (
                  <Button variant="danger" onClick={handleSubmitFeedback} disabled={cancelMutation.isPending}>
                    {cancelMutation.isPending ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Processing...
                      </>
                    ) : (
                      'Submit & Cancel'
                    )}
                  </Button>
                ) : (
                  <Button variant="danger" onClick={handleCancel} disabled={cancelMutation.isPending}>
                    {cancelMutation.isPending ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Canceling...
                      </>
                    ) : (
                      'Confirm Cancellation'
                    )}
                  </Button>
                )}
              </div>
            </>
          ) : (
            /* Success message */
            <div className="py-4 text-center">
              <div className="mb-3 flex items-center justify-center gap-2">
                <CheckCircle2 className="h-8 w-8 text-success-ink" />
                <p className="text-xl font-semibold text-ink">Subscription Canceled</p>
              </div>
              <p className="mb-2 text-sm text-muted-foreground">
                {cancelAtPeriodEnd
                  ? 'Your subscription will remain active until the end of your current billing period.'
                  : 'Your subscription has been canceled immediately.'}
              </p>
              <p className="text-sm text-muted-foreground">
                You can reactivate anytime from the pricing page.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
