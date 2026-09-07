'use client';

/**
 * StepHelpText - Collapsible contextual help panel
 *
 * Acid Brutalism Design:
 * - Hard borders with brutalist styling
 * - Brand colors (coral/teal) for accents
 * - Clear typography hierarchy
 *
 * Provides users with:
 * - Step-by-step explanation of what's happening
 * - "What you're granting" information
 * - Reassurance about the authorization process
 */

import { useId, useState } from 'react';
import { m } from 'framer-motion';
import { Info, ChevronDown } from 'lucide-react';

interface StepHelpTextProps {
  title: string;
  description?: string;
  steps?: string[];
  grantingDetails?: string[];
  defaultOpen?: boolean;
}

export function StepHelpText({
  title,
  description,
  steps = [],
  grantingDetails = [],
  defaultOpen = false,
}: StepHelpTextProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const contentId = useId();

  return (
    <div className="border-2 border-black bg-muted/20 p-4 mt-4">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-3 w-full text-left"
        aria-expanded={isOpen}
        aria-controls={contentId}
      >
        <div className="w-8 h-8 border-2 border-black dark:border-white bg-[var(--paper)] flex items-center justify-center flex-shrink-0">
          <Info className="w-4 h-4 text-[var(--coral)]" />
        </div>
        <span className="font-semibold text-[var(--ink)] flex-1">{title}</span>
        <m.div
          animate={{ rotate: isOpen ? 180 : 0 }}
          transition={{ duration: 0.2 }}
          className="flex-shrink-0"
        >
          <ChevronDown className="w-5 h-5 text-muted-foreground dark:text-muted-foreground" />
        </m.div>
      </button>

      <div
        id={contentId}
        hidden={!isOpen}
        className="mt-4 border-t-2 border-black pt-4 dark:border-white"
      >
        {description && (
          <p className="mb-4 text-sm text-foreground dark:text-muted-foreground">{description}</p>
        )}

        {steps.length > 0 && (
          <div className="mb-4">
            <p className="text-xs font-bold text-[var(--ink)] uppercase tracking-wide mb-2">
              What happens next:
            </p>
            <ol className="space-y-2">
              {steps.map((step, index) => (
                <li
                  key={index}
                  className="flex items-start gap-2 text-sm text-foreground dark:text-muted-foreground"
                >
                  <span className="flex-shrink-0 w-5 h-5 border border-black dark:border-white bg-[var(--coral)] text-white flex items-center justify-center text-xs font-bold">
                    {index + 1}
                  </span>
                  <span>{step}</span>
                </li>
              ))}
            </ol>
          </div>
        )}

        {grantingDetails.length > 0 && (
          <div>
            <p className="text-xs font-bold text-[var(--ink)] uppercase tracking-wide mb-2">
              What you're granting:
            </p>
            <ul className="space-y-1.5">
              {grantingDetails.map((detail, index) => (
                <li
                  key={index}
                  className="flex items-start gap-2 text-sm text-foreground dark:text-muted-foreground"
                >
                  <span className="text-[var(--coral)] mt-0.5">•</span>
                  <span>{detail}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
