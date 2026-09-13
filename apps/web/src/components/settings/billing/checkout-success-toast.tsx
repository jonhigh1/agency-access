'use client';

/**
 * Checkout Success Toast
 *
 * Shows a success message when returning from checkout. Reveals with a
 * plain 450ms opacity transition (the design system's reveal easing);
 * reduced motion is handled by the global rule in globals.css.
 */

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Check, X } from 'lucide-react';

export function CheckoutSuccessToast() {
  const [visible, setVisible] = useState(true);
  const [revealed, setRevealed] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    // Flip after the first paint so the opacity transition runs.
    const frame = requestAnimationFrame(() => setRevealed(true));
    return () => cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      setVisible(false);
      // Clean up URL
      const params = new URLSearchParams(searchParams.toString());
      params.delete('checkout');
      router.replace(`?${params.toString()}`, { scroll: false });
    }, 5000);

    return () => clearTimeout(timer);
  }, [router, searchParams]);

  if (!visible) return null;

  return (
    <div
      role="status"
      className={`fixed top-4 right-4 z-50 max-w-[calc(100vw-2rem)] transition-opacity duration-[450ms] ease-[cubic-bezier(0.2,0.8,0.3,1)] ${
        revealed ? 'opacity-100' : 'opacity-0'
      }`}
    >
      <div className="flex items-center gap-3 border border-teal/30 bg-paper px-4 py-3">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-teal/20">
          <Check className="h-5 w-5 text-success-ink" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-medium text-ink">Subscription updated</p>
          <p className="text-xs text-muted-foreground">
            Your plan has been successfully upgraded.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setVisible(false)}
          aria-label="Dismiss"
          className="ml-auto text-success-ink transition-colors duration-150 hover:text-ink"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
