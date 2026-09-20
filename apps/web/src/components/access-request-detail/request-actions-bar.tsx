'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Edit3, Plus, Unlink } from 'lucide-react';
import { useAuth } from '@clerk/nextjs';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui';
import { CancelRequestModal } from './CancelRequestModal';
import { cancelAccessRequest } from '@/lib/api/access-requests';
import { capturePosthogEvent } from '@/lib/analytics/capture-posthog';

interface RequestActionsBarProps {
  requestId: string;
  requestName?: string;
  status: 'pending' | 'partial' | 'completed' | 'expired' | 'revoked';
  onAction?: (action: 'back_to_dashboard' | 'edit_request' | 'create_from_request' | 'cancel_request') => void;
  onRevokeSuccess?: () => void;
}

function isEditable(status: RequestActionsBarProps['status']): boolean {
  return status === 'pending' || status === 'partial';
}

function isRevocable(status: RequestActionsBarProps['status']): boolean {
  return status === 'pending' || status === 'partial';
}

export function RequestActionsBar({
  requestId,
  requestName = '',
  status,
  onAction,
  onRevokeSuccess,
}: RequestActionsBarProps) {
  const { getToken } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelPending, setCancelPending] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);
  const editable = isEditable(status);
  const revocable = isRevocable(status);

  const openCancelModal = () => {
    setCancelError(null);
    setShowCancelModal(true);
  };

  const handleCancelConfirm = async () => {
    setCancelPending(true);
    setCancelError(null);
    try {
      const result = await cancelAccessRequest(requestId, getToken);
      if (result.error) {
        void capturePosthogEvent('cancel_request_failed', {
          access_request_id: requestId,
          error_code: result.error.code,
        });
        // A 401 means the session lapsed. Send the user to sign in again
        // instead of failing silently, then keep the modal open with the reason.
        if (result.error.code === 'UNAUTHORIZED') {
          setCancelError('Your session has expired. Please sign in again to cancel this request.');
          router.push('/sign-in' as any);
          return;
        }
        setCancelError(result.error.message || 'Could not cancel the request. Please try again.');
        return;
      }
      onAction?.('cancel_request');
      onRevokeSuccess?.();
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      setShowCancelModal(false);
    } catch (err) {
      void capturePosthogEvent('cancel_request_failed', {
        access_request_id: requestId,
        error_code: 'UNEXPECTED',
      });
      setCancelError(err instanceof Error ? err.message : 'Could not cancel the request. Please try again.');
    } finally {
      setCancelPending(false);
    }
  };

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link href="/dashboard" className="inline-flex">
          <Button
            variant="secondary"
            size="sm"
            leftIcon={<ArrowLeft className="h-4 w-4" />}
            onClick={() => onAction?.('back_to_dashboard')}
          >
            Back to Dashboard
          </Button>
        </Link>

        <div className="flex items-center gap-2">
          {revocable && (
            <Button
              variant="secondary"
              size="sm"
              leftIcon={<Unlink className="h-4 w-4" />}
              onClick={openCancelModal}
              aria-label="Cancel request"
            >
              Cancel Request
            </Button>
          )}
          {editable ? (
            <Link
              href={`/access-requests/${requestId}/edit` as any}
              className="inline-flex"
              aria-label="Edit Request"
              onClick={() => onAction?.('edit_request')}
            >
              <Button size="sm" leftIcon={<Edit3 className="h-4 w-4" />}>
                Edit Request
              </Button>
            </Link>
          ) : (
            <Link
              href={`/access-requests/new?fromRequest=${encodeURIComponent(requestId)}` as any}
              className="inline-flex"
              aria-label="Create New Request From This"
              onClick={() => onAction?.('create_from_request')}
            >
              <Button size="sm" leftIcon={<Plus className="h-4 w-4" />}>
                Create New Request From This
              </Button>
            </Link>
          )}
        </div>
      </div>

      {showCancelModal && (
        <CancelRequestModal
          requestName={requestName}
          onConfirm={handleCancelConfirm}
          onClose={() => setShowCancelModal(false)}
          isPending={cancelPending}
          errorMessage={cancelError}
        />
      )}
    </>
  );
}
