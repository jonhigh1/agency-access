'use client';

import { m, AnimatePresence, useReducedMotion } from 'framer-motion';
import { X } from 'lucide-react';
import { useEffect, useId, useRef } from 'react';

interface ScheduleDemoModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ScheduleDemoModal({ isOpen, onClose }: ScheduleDemoModalProps) {
  const embedRef = useRef<HTMLDivElement>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (isOpen && dialog && !dialog.open) dialog.showModal();
    if (!isOpen && dialog?.open) dialog.close();
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || typeof window === 'undefined') return;

    // Initialize Cal.com embed loader
    (function (C: any, A: string, L: string) {
      const p = (a: any, ar: any[]) => { a.q.push(ar); };
      let d = C.document;
      C.Cal = C.Cal || function (...ar: any[]) {
        let cal = C.Cal;
        if (!cal.loaded) {
          cal.ns = {};
          cal.q = cal.q || [];
          d.head.appendChild(d.createElement("script")).src = A;
          cal.loaded = true;
        }
        if (ar[0] === L) {
          const api: { (...args: any[]): void; q: any[] } = (...args: any[]) => { p(api, args); };
          api.q = api.q || [];
          const namespace = ar[1];
          if (typeof namespace === "string") {
            cal.ns[namespace] = cal.ns[namespace] || api;
            p(cal.ns[namespace], ar);
            p(cal, ["initNamespace", namespace]);
          } else p(cal, ar);
          return;
        }
        p(cal, ar);
      };
    })(window, "https://app.cal.com/embed/embed.js", "init");

    // Initialize Cal.com with namespace
    (window as any).Cal("init", "authhub-demo", { origin: "https://app.cal.com" });

    // Wait for script to load and DOM to be ready
    const initInline = () => {
      if (embedRef.current && (window as any).Cal?.ns?.["authhub-demo"]) {
        // Initialize inline embed
        (window as any).Cal.ns["authhub-demo"]("inline", {
          elementOrSelector: "#my-cal-inline-authhub-demo",
          config: { layout: "month_view" },
          calLink: "pillar-ai/authhub-demo",
        });

        // Configure UI with custom brand color
        (window as any).Cal.ns["authhub-demo"]("ui", {
          theme: "light",
          cssVarsPerTheme: {
            light: {
              "cal-brand": "#FF6B35"
            }
          },
          hideEventTypeDetails: false,
          layout: "month_view"
        });
      }
    };

    // Check if Cal is already loaded
    let checkInterval: number | undefined;
    let timeout: number | undefined;
    let initTimeout: number | undefined;

    if ((window as any).Cal?.loaded) {
      // Small delay to ensure DOM is ready
      initTimeout = window.setTimeout(initInline, 100);
    } else {
      // Wait for script to load
      checkInterval = window.setInterval(() => {
        if ((window as any).Cal?.loaded && embedRef.current) {
          window.clearInterval(checkInterval);
          initInline();
        }
      }, 100);

      // Cleanup interval after 10 seconds
      timeout = window.setTimeout(() => {
        if (checkInterval) window.clearInterval(checkInterval);
      }, 10000);
    }

    return () => {
      if (checkInterval) window.clearInterval(checkInterval);
      if (timeout) window.clearTimeout(timeout);
      if (initTimeout) window.clearTimeout(initTimeout);
    };
  }, [isOpen]);

  return (
    <AnimatePresence>
      {isOpen && (
          <m.dialog
            ref={dialogRef}
            key="schedule-demo-content"
            aria-modal="true"
            aria-labelledby={titleId}
            onCancel={(event) => { event.preventDefault(); onClose(); }}
            onClick={onClose}
            initial={reducedMotion ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reducedMotion ? 0 : 0.25 }}
            className="fixed inset-0 m-0 hidden h-full w-full max-h-none max-w-none items-center justify-center border-0 bg-transparent p-4 open:flex backdrop:bg-ink/50"
          >
            <div
              className="relative bg-card rounded-lg shadow-brutalist-lg w-full max-w-6xl max-h-[90vh] flex flex-col pointer-events-auto border-2 border-black"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex-shrink-0 flex items-center justify-between px-6 py-4 border-b-2 border-black bg-paper">
                <div>
                  <h2 id={titleId} className="font-dela text-2xl font-black text-ink">Schedule a Demo</h2>
                  <p className="text-sm text-gray-600 mt-1 font-mono">
                    Book a time to see AuthHub in action
                  </p>
                </div>
                <button
                  onClick={onClose}
                  type="button"
                  className="min-h-[44px] min-w-[44px] p-2 rounded-none border-2 border-black hover:bg-muted/10 transition-colors"
                  aria-label="Close modal"
                >
                  <X className="h-5 w-5 text-ink" />
                </button>
              </div>

              {/* Content - Cal.com Inline Embed */}
              <div className="flex-1 overflow-y-auto bg-paper min-h-0">
                <div
                  ref={embedRef}
                  id="my-cal-inline-authhub-demo"
                  className="w-full h-full"
                  style={{ width: '100%', minHeight: '600px', height: '100%' }}
                />
              </div>
            </div>
          </m.dialog>
      )}
    </AnimatePresence>
  );
}
