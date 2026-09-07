'use client';

/**
 * Generic destructive-action confirmation. Escape closes, focus moves to the
 * panel, backdrop never closes. Mirrors CancelRequestModal semantics.
 */

import { useEffect, useRef } from 'react';
import { Button } from '@/components/ui';

interface ConfirmModalProps {
  title: string;
  body: string;
  confirmLabel: string;
  cancelLabel: string;
  destructive?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}

export function ConfirmModal({
  title,
  body,
  confirmLabel,
  cancelLabel,
  destructive = false,
  onConfirm,
  onClose,
}: ConfirmModalProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    panelRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="presentation">
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        className="w-full max-w-md border-2 border-black bg-card shadow-brutalist focus:outline-none"
      >
        <div className="border-b-2 border-black px-6 py-4">
          <h2 className="font-display text-lg font-semibold text-ink">{title}</h2>
        </div>
        <div className="p-6">
          <p className="mb-6 text-sm leading-6 text-muted-foreground">{body}</p>
          <div className="flex justify-end gap-3 border-t border-black/20 pt-4">
            <Button type="button" variant="secondary" size="sm" onClick={onClose}>
              {cancelLabel}
            </Button>
            <Button
              type="button"
              size="sm"
              variant={destructive ? 'danger' : 'primary'}
              onClick={onConfirm}
            >
              {confirmLabel}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
