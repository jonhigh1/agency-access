'use client';

import { useEffect, useId, useRef } from 'react';
import { m, useReducedMotion } from 'framer-motion';
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
  const dialogRef = useRef<HTMLDialogElement>(null);
  const onCloseRef = useRef(onClose);
  const titleId = useId();

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (isOpen && !dialog.open) dialog.showModal();
    if (!isOpen && dialog.open) dialog.close();
  }, [isOpen]);

  return (
    <m.dialog
      ref={dialogRef}
      onCancel={(event) => {
        event.preventDefault();
        onCloseRef.current();
      }}
      className="fixed inset-0 m-0 hidden h-full w-full max-h-none max-w-none items-center justify-center border-0 bg-transparent p-3 open:flex backdrop:bg-ink/50 backdrop:backdrop-blur-sm sm:p-4"
      initial={shouldReduceMotion ? false : { opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: shouldReduceMotion ? 0 : 0.25 }}
      aria-labelledby={titleId}
      aria-modal="true"
    >
      <m.button
        type="button"
        initial={shouldReduceMotion ? false : { opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: shouldReduceMotion ? 0 : 0.15 }}
        onClick={() => onCloseRef.current()}
        className="absolute inset-0 bg-transparent"
        aria-label="Close manage assets modal"
      />

      <m.div
        initial={shouldReduceMotion ? false : { opacity: 0, scale: 0.98, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: shouldReduceMotion ? 0 : 0.25, ease: [0.22, 1, 0.36, 1] }}
        onClick={(event) => event.stopPropagation()}
        className="relative z-10 flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-none border-2 border-black bg-card shadow-brutalist sm:max-h-[90vh]"
      >
        <div className="border-b-2 border-black bg-paper px-5 py-4 sm:px-6">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1">
              <p className="font-mono text-[11px] font-bold uppercase tracking-[0.24em] text-muted-foreground">
                Manage Assets
              </p>
              <h2 id={titleId} className="font-display text-2xl font-semibold text-ink">
                {title}
              </h2>
              <p className="max-w-2xl text-sm text-muted-foreground">{description}</p>
            </div>
            <Button type="button" variant="brutalist" size="sm" onClick={() => onCloseRef.current()} className="shrink-0">
              Done
            </Button>
          </div>
          {summary ? (
            <div className="mt-4 border-t border-border pt-4">
              <div className="grid gap-3 sm:grid-cols-3">{summary}</div>
            </div>
          ) : null}
        </div>

        <div className="flex-1 overflow-y-auto bg-card px-5 py-5 sm:px-6">{isOpen ? children : null}</div>
      </m.div>
    </m.dialog>
  );
}
