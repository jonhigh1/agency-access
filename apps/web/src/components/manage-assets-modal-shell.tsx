'use client';

import { AnimatePresence, m, useReducedMotion } from 'framer-motion';
import { useEffect } from 'react';
import { Button } from '@/components/ui/button';

interface ManageAssetsModalShellProps {
  isOpen: boolean;
  title: string;
  description: string;
  onClose: () => void;
  summary?: React.ReactNode;
  children: React.ReactNode;
}

export function ManageAssetsModalShell({
  isOpen,
  title,
  description,
  onClose,
  summary,
  children,
}: ManageAssetsModalShellProps) {
  const shouldReduceMotion = useReducedMotion();

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  return (
    <AnimatePresence>
      {isOpen && (
        <m.div
          initial={false}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: shouldReduceMotion ? 0 : 0.25 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4"
        >
          <m.button
            type="button"
            initial={shouldReduceMotion ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: shouldReduceMotion ? 0 : 0.15 }}
            onClick={onClose}
            className="absolute inset-0 bg-ink/50 backdrop-blur-sm"
            aria-label="Close manage assets modal"
          />

          <m.div
            initial={shouldReduceMotion ? false : { opacity: 0, scale: 0.98, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.98, y: 4 }}
            transition={{ duration: shouldReduceMotion ? 0 : 0.25, ease: [0.22, 1, 0.36, 1] }}
            onClick={(event) => event.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="manage-assets-modal-title"
            className="relative flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-none border-2 border-black bg-card shadow-brutalist sm:max-h-[90vh]"
          >
            <div className="border-b-2 border-black bg-paper px-5 py-4 sm:px-6">
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-1">
                  <p className="font-mono text-[11px] font-bold uppercase tracking-[0.24em] text-muted-foreground">
                    Manage Assets
                  </p>
                  <h2 id="manage-assets-modal-title" className="font-display text-2xl font-semibold text-ink">
                    {title}
                  </h2>
                  <p className="max-w-2xl text-sm text-muted-foreground">{description}</p>
                </div>
                <Button
                  type="button"
                  variant="brutalist"
                  size="sm"
                  onClick={onClose}
                  className="shrink-0"
                >
                  Done
                </Button>
              </div>
              {summary ? (
                <div className="mt-4 border-t border-border pt-4">
                  <div className="grid gap-3 sm:grid-cols-3">{summary}</div>
                </div>
              ) : null}
            </div>

            <div className="flex-1 overflow-y-auto bg-card px-5 py-5 sm:px-6">{children}</div>
          </m.div>
        </m.div>
      )}
    </AnimatePresence>
  );
}
