'use client';

/**
 * AssetCheckbox - Compact row-based checkbox for asset selection
 *
 * Bold & Confident Design:
 * - Compact row layout to minimize scroll
 * - High-contrast checkbox with coral accent
 * - Scale animation on check/uncheck
 */

import { m } from 'framer-motion';
import { Check } from 'lucide-react';

interface AssetCheckboxProps {
  id: string;
  name: string;
  metadata?: {
    id?: string;
    status?: string;
    avatar?: string;
  };
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}

export function AssetCheckbox({
  id,
  name,
  metadata,
  checked,
  onChange,
  disabled = false,
}: AssetCheckboxProps) {
  return (
    <m.label
      htmlFor={id}
      className={`
        relative flex min-h-[44px] min-w-0 items-center gap-2.5 px-2.5 py-1.5 rounded-none border cursor-pointer
        focus-within:outline-[3px] focus-within:outline-[rgb(var(--coral)/0.25)] focus-within:outline-offset-0 focus-within:[box-shadow:0_0_0_6px_rgb(var(--primary)/0.08)]
        transition-all duration-200
        ${
          checked
            ? 'bg-coral/10 border-coral'
            : 'bg-card border-border hover:border-coral/50'
        }
        ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
      `}
      whileHover={!disabled ? { scale: 1.01 } : {}}
      whileTap={!disabled ? { scale: 0.99 } : {}}
    >
      {/* Custom Checkbox */}
      <div className="relative flex-shrink-0">
        <input
          type="checkbox"
          id={id}
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          disabled={disabled}
          className="sr-only"
        />
        <m.div
          className={`
            w-5 h-5 rounded-md border-2 flex items-center justify-center
            ${
              checked
                ? 'bg-coral border-coral'
                : 'bg-card border-border'
            }
          `}
          animate={{
            scale: checked ? [1, 1.15, 1] : 1,
          }}
          transition={{ duration: 0.2 }}
        >
          {checked && (
            <m.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ duration: 0.15, delay: 0.05 }}
            >
              <Check className="w-3.5 h-3.5 text-white" strokeWidth={3} />
            </m.div>
          )}
        </m.div>
      </div>

      {/* Asset Info */}
      <div className="flex-1 min-w-0">
        <h4 className="text-sm font-medium text-ink truncate">{name}</h4>
        {metadata?.status && (
          <span
            className={`
              text-xs
              ${
                metadata.status.toUpperCase() === 'ACTIVE'
                  ? 'text-success-ink'
                  : 'text-muted-foreground'
              }
            `}
          >
            {metadata.status}
          </span>
        )}
      </div>
    </m.label>
  );
}
