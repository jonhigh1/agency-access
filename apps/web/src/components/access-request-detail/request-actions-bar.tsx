'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Edit3, Plus, Unlink } from 'lucide-react';
import { useAuth } from '@clerk/nextjs';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui';
import { CancelRequestModal } from './CancelRequestModal';
import { cancelAccessRequest } from '@/lib/api/access-requests';

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
  const queryClient = useQueryClient();
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelPending, setCancelPending] = useState(false);
  const editable = isEditable(status);
  const revocable = isRevocable(status);

  const handleCancelConfirm = async () => {
    setCancelPending(true);
    try {
      const result = await cancelAccessRequest(requestId, getToken);
      if (result.error) {
        throw new Error(result.error.message);
      }
      onAction?.('cancel_request');
      onRevokeSuccess?.();
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      setShowCancelModal(false);
    } finally {
      setCancelPending(false);
    }
  };

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button
          asChild
          variant="secondary"
          size="sm"
          leftIcon={<ArrowLeft className="h-4 w-4" />}
        >
          <Link href="/dashboard" onClick={() => onAction?.('back_to_dashboard')}>
            Back to Dashboard
          </Link>
        </Button>

        <div className="flex items-center gap-2">
          {revocable && (
            <Button
              variant="secondary"
              size="sm"
              leftIcon={<Unlink className="h-4 w-4" />}
              onClick={() => setShowCancelModal(true)}
              aria-label="Cancel request"
            >
              Cancel Request
            </Button>
          )}
          {editable ? (
            <Button asChild size="sm" leftIcon={<Edit3 className="h-4 w-4" />}>
              <Link href={`/access-requests/${requestId}/edit` as any} onClick={() => onAction?.('edit_request')}>
                Edit Request
              </Link>
            </Button>
          ) : (
            <Button asChild size="sm" leftIcon={<Plus className="h-4 w-4" />}>
              <Link href={`/access-requests/new?fromRequest=${encodeURIComponent(requestId)}` as any} onClick={() => onAction?.('create_from_request')}>
                Create New Request From This
              </Link>
            </Button>
          )}
        </div>
      </div>

      {showCancelModal && (
        <CancelRequestModal
          requestName={requestName}
          onConfirm={handleCancelConfirm}
          onClose={() => setShowCancelModal(false)}
          isPending={cancelPending}
        />
      )}
    </>
  );
}
