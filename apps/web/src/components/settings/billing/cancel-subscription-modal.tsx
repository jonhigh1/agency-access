'use client';

/**
 * CancelSubscriptionModal Component
 *
 * Confirmation modal for canceling subscriptions.
 * Offers option to cancel immediately or at period end.
 */

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Loader2, AlertTriangle, CheckCircle2, Calendar } from 'lucide-react';
import { useCancelSubscription } from '@/lib/query/billing';
import { getPricingTierNameFromSubscriptionTier, type SubscriptionTier } from '@agency-platform/shared';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@clerk/nextjs';

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

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            onClick={(e) => e.stopPropagation()}
            className="bg-card rounded-lg shadow-brutalist max-w-md w-full border-2 border-black"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-black/10">
              <h2 className="text-lg font-semibold text-ink">Cancel Subscription</h2>
              <button
                onClick={onClose}
                className="p-1 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="h-5 w-5 text-gray-600" />
              </button>
            </div>

            {/* Content */}
            <div className="p-6">
              {!success ? (
                <>
                  {/* Warning icon */}
                  <div className="flex items-center gap-3 mb-4">
                    <div className="p-3 bg-coral/20 rounded-full">
                      <AlertTriangle className="h-6 w-6 text-danger-ink" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-ink">
                        Cancel {getPricingTierNameFromSubscriptionTier(currentTier)} Plan?
                      </h3>
                      <p className="text-sm text-gray-600">
                        This action will affect your access to platform features
                      </p>
                    </div>
                  </div>

                  {/* Warning message */}
                  <div className="bg-coral/10 border-2 border-coral rounded-lg p-4 mb-6">
                    <p className="text-sm text-danger-ink">
                      <strong>Important:</strong> After cancellation, you will lose access to paid plan features
                      and will move to Free plan limits. Any remaining clients, team members, or access requests
                      exceeding those limits may be restricted.
                    </p>
                  </div>

                  {/* Cancellation timing options */}
                  <div className="space-y-3 mb-6">
                    <h4 className="text-sm font-semibold text-ink">When should we cancel?</h4>

                    <label
                      className={`flex items-start gap-3 p-4 border-2 rounded-lg cursor-pointer transition-all ${
                        cancelAtPeriodEnd
                          ? 'border-coral bg-coral/10'
                          : 'border-black/10 hover:border-black'
                      }`}
                    >
                      <input
                        type="radio"
                        name="cancelTiming"
                        checked={cancelAtPeriodEnd}
                        onChange={() => setCancelAtPeriodEnd(true)}
                        className="mt-1"
                      />
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <Calendar className="h-4 w-4 text-danger-ink" />
                          <p className="font-medium text-ink">At the end of the billing period (Recommended)</p>
                        </div>
                        <p className="text-sm text-gray-600">
                          Your subscription will remain active until the current billing period ends. You can reactivate anytime before then.
                        </p>
                      </div>
                    </label>

                    <label
                      className={`flex items-start gap-3 p-4 border-2 rounded-lg cursor-pointer transition-all ${
                        !cancelAtPeriodEnd
                          ? 'border-coral bg-coral/10'
                          : 'border-black/10 hover:border-black'
                      }`}
                    >
                      <input
                        type="radio"
                        name="cancelTiming"
                        checked={!cancelAtPeriodEnd}
                        onChange={() => setCancelAtPeriodEnd(false)}
                        className="mt-1"
                      />
                      <div className="flex-1">
                        <p className="font-medium text-ink mb-1">Immediately</p>
                        <p className="text-sm text-gray-600">
                          Your subscription will be canceled right away and you will lose access to paid features immediately.
                        </p>
                      </div>
                    </label>
                  </div>

                  {/* Feedback section */}
                  <div className="mb-6">
                    <button
                      onClick={() => setShowFeedback(!showFeedback)}
                      className="text-sm text-danger-ink hover:text-danger-ink flex items-center gap-1 mb-2"
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
                    <AnimatePresence>
                      {showFeedback && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                        >
                          <textarea
                            value={feedback}
                            onChange={(e) => setFeedback(e.target.value)}
                            placeholder="Help us improve by letting us know why you're canceling..."
                            className="w-full px-3 py-2 border-2 border-black rounded-lg focus:outline-none focus:ring-2 focus:ring-coral focus:border-transparent resize-none"
                            rows={3}
                          />
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  {/* Error message */}
                  {errorMessage && (
                    <div className="p-3 bg-coral/10 border border-coral rounded-lg mb-4">
                      <p className="text-sm text-danger-ink">{errorMessage}</p>
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex justify-end gap-3 pt-4 border-t-2 border-black/10">
                    <button
                      onClick={onClose}
                      disabled={cancelMutation.isPending}
                      className="px-4 py-2 border-2 border-black text-gray-700 rounded-lg hover:bg-gray-100 transition-colors disabled:opacity-50"
                    >
                      Keep Subscription
                    </button>
                    {showFeedback && feedback.trim() ? (
                      <button
                        onClick={handleSubmitFeedback}
                        disabled={cancelMutation.isPending}
                        className="px-4 py-2 bg-coral text-white rounded-lg hover:bg-coral/90 transition-colors disabled:opacity-50 flex items-center gap-2"
                      >
                        {cancelMutation.isPending ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Processing...
                          </>
                        ) : (
                          'Submit & Cancel'
                        )}
                      </button>
                    ) : (
                      <button
                        onClick={handleCancel}
                        disabled={cancelMutation.isPending}
                        className="px-4 py-2 bg-coral text-white rounded-lg hover:bg-coral/90 transition-colors disabled:opacity-50 flex items-center gap-2"
                      >
                        {cancelMutation.isPending ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Canceling...
                          </>
                        ) : (
                          'Confirm Cancellation'
                        )}
                      </button>
                    )}
                  </div>
                </>
              ) : (
                /* Success message */
                <div className="text-center py-4">
                  <div className="flex items-center justify-center gap-2 mb-3">
                    <CheckCircle2 className="h-8 w-8 text-success-ink" />
                    <p className="text-xl font-semibold text-ink">Subscription Canceled</p>
                  </div>
                  <p className="text-sm text-gray-600 mb-2">
                    {cancelAtPeriodEnd
                      ? 'Your subscription will remain active until the end of your current billing period.'
                      : 'Your subscription has been canceled immediately.'}
                  </p>
                  <p className="text-sm text-gray-600">
                    You can reactivate anytime from the pricing page.
                  </p>
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
