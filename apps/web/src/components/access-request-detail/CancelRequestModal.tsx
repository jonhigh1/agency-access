'use client';

/**
 * Confirmation modal for revoking a pending access request.
 * The authorization link stops working; the request stays in the list as revoked.
 * Dialog semantics: Escape closes, focus moves to the panel, backdrop never closes.
 */

import { useEffect, useRef } from 'react';
import { Loader2, Unlink } from 'lucide-react';
import { Button } from '@/components/ui';

interface CancelRequestModalProps {
  requestName: string;
  onConfirm: () => void | Promise<void>;
  onClose: () => void;
  isPending?: boolean;
}

export function CancelRequestModal({
  requestName,
  onConfirm,
  onClose,
  isPending = false,
}: CancelRequestModalProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    panelRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !isPending) {
        onClose();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isPending, onClose]);

  const handleConfirm = async () => {
    await onConfirm();
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      role="presentation"
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Cancel request"
        tabIndex={-1}
        className="w-full max-w-md border-2 border-black bg-card shadow-brutalist focus:outline-none"
      >
        <div className="border-b-2 border-black px-6 py-4">
          <h2 className="font-display text-lg font-semibold text-ink">Cancel Request</h2>
        </div>

        <div className="p-6">
          <div className="mb-4 flex items-center gap-3">
            <div className="border border-black bg-paper p-2">
              <Unlink className="h-5 w-5 text-danger-ink" aria-hidden />
            </div>
            <h3 className="text-lg font-semibold text-ink">Revoke this access request?</h3>
          </div>
          <p className="mb-6 text-sm leading-6 text-muted-foreground">
            The authorization link will stop working. The client will no longer be able to use it.
            {requestName ? (
              <>
                {' '}
                <strong className="text-foreground">{requestName}</strong> will appear as revoked
                in your list.
              </>
            ) : null}
          </p>
          <div className="flex justify-end gap-3 border-t border-black/20 pt-4">
            <Button type="button" onClick={onClose} disabled={isPending} variant="secondary" size="sm">
              Keep Request
            </Button>
            <Button
              type="button"
              onClick={handleConfirm}
              disabled={isPending}
              variant="danger"
              size="sm"
              leftIcon={isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : undefined}
            >
              {isPending ? 'Cancelling...' : 'Cancel Request'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
