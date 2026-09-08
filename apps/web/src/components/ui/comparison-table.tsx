'use client';

import { cn } from '@/lib/utils';
import { Check, X, Sparkles } from 'lucide-react';
import { m } from 'framer-motion';

// ═══════════════════════════════════════════════════════════════════════════
// COMPARISON TABLE - Acid Brutalism Design System
// ═══════════════════════════════════════════════════════════════════════════

interface ComparisonTableProps {
  children: React.ReactNode;
  className?: string;
}

/**
 * ComparisonTable - Brutalist comparison table container
 *
 * Features:
 * - Hard borders with brutalist shadow
 * - Overflow scroll for mobile
 * - Sticky header support
 */
export function ComparisonTable({ children, className }: ComparisonTableProps) {
  return (
    <div
      className={cn(
        // Container styling
        'relative overflow-hidden rounded-none',
        'border-[3px] border-black',
        'shadow-brutalist-lg',
        // Overflow handling
        'overflow-x-auto',
        className
      )}
    >
      <table className="relative w-full text-sm border-collapse">
        {children}
      </table>
    </div>
  );
}

/**
 * ComparisonHeader - Sticky table header with brand styling
 *
 * Three-column layout: Feature | Competitor | AuthHub
 */
export function ComparisonHeader() {
  return (
    <thead className="bg-ink text-white">
      <tr>
        {/* Feature column */}
        <th className="relative px-5 py-4 text-left font-dela text-base tracking-wide border-r border-white/20">
          <span className="relative z-10">Feature</span>
        </th>

        {/* Competitor column - muted treatment */}
        <th className="relative px-5 py-4 text-center font-dela text-base tracking-wide border-r border-white/20 bg-white/5">
          <span className="relative z-10 opacity-70">Leadsie</span>
        </th>

        {/* AuthHub column - highlighted */}
        <th className="relative px-5 py-4 text-center font-dela text-base tracking-wide bg-coral">
          <span className="relative z-10">AuthHub</span>
          {/* Subtle glow effect */}
          <div className="absolute inset-0 bg-gradient-to-b from-white/10 to-transparent pointer-events-none" />
        </th>
      </tr>
    </thead>
  );
}

interface ComparisonSectionProps {
  title: string;
  children: React.ReactNode;
}

/**
 * ComparisonSection - Grouped feature category header
 *
 * Creates visual breaks between feature categories
 */
export function ComparisonSection({ title, children }: ComparisonSectionProps) {
  return (
    <>
      {/* Section header row */}
      <tr className="bg-muted/40 border-b-2 border-black">
        <td
          colSpan={3}
          className="px-5 py-3 font-dela text-sm uppercase tracking-widest text-ink"
        >
          <div className="flex items-center gap-3">
            {/* Decorative dot */}
            <span className="w-2 h-2 bg-coral rounded-full" />
            {title}
          </div>
        </td>
      </tr>
      {children}
    </>
  );
}

interface ComparisonRowProps {
  feature: string;
  leadsie: boolean | string;
  authhub: boolean | string;
  exclusive?: boolean;
  isEven?: boolean;
}

/**
 * ComparisonRow - Individual feature comparison
 *
 * Renders check/X icons or text values with optional "exclusive" badge
 * for AuthHub-only features.
 */
export function ComparisonRow({
  feature,
  leadsie,
  authhub,
  exclusive = false,
  isEven = false,
}: ComparisonRowProps) {
  /**
   * Renders a value cell (check, X, or custom text)
   */
  const renderValue = (value: boolean | string, isAuthHub: boolean = false) => {
    if (typeof value === 'boolean') {
      return value ? (
        <m.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className={cn(
            'inline-flex items-center justify-center w-7 h-7 rounded-sm border-2',
            isAuthHub
              ? 'bg-teal/10 border-teal text-success-ink'
              : 'bg-muted/50 border-black/20 text-foreground'
          )}
        >
          <Check size={16} strokeWidth={3} />
        </m.div>
      ) : (
        <m.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className={cn(
            'inline-flex items-center justify-center w-7 h-7 rounded-sm border-2',
            isAuthHub
              ? 'bg-destructive/10 border-destructive/40 text-destructive'
              : 'bg-muted/30 border-black/10 text-muted-foreground'
          )}
        >
          <X size={16} strokeWidth={3} />
        </m.div>
      );
    }

    // Text value
    return (
      <span
        className={cn(
          'font-mono text-sm',
          isAuthHub && 'font-bold text-success-ink'
        )}
      >
        {value}
      </span>
    );
  };

  return (
    <tr
      className={cn(
        'border-b border-black/20 transition-colors duration-150',
        'hover:bg-coral/10',
        isEven && 'bg-muted/20',
        // Highlight rows where AuthHub has exclusive features
        exclusive && 'bg-teal/5'
      )}
    >
      {/* Feature name */}
      <td className="px-5 py-4 font-mono text-sm font-medium text-ink border-r border-black/20">
        {feature}
      </td>

      {/* Competitor value */}
      <td className="px-5 py-4 text-center border-r border-black/20 bg-white/50">
        {renderValue(leadsie, false)}
      </td>

      {/* AuthHub value */}
      <td
        className={cn(
          'px-5 py-4 text-center',
          // Subtle highlight for AuthHub column
          'bg-gradient-to-b from-transparent to-teal/5',
          exclusive && 'bg-gradient-to-b from-teal/10 to-teal/5'
        )}
      >
        <div className="flex items-center justify-center gap-2">
          {renderValue(authhub, true)}

          {/* Exclusive badge */}
          {exclusive && (
            <m.span
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.1, type: 'spring', stiffness: 500, damping: 25 }}
              className="inline-flex items-center gap-1 px-2 py-0.5 bg-teal text-white text-[10px] font-bold uppercase tracking-wider rounded-sm shadow-brutalist-sm"
            >
              <Sparkles size={10} />
              Only AuthHub
            </m.span>
          )}
        </div>
      </td>
    </tr>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// VARIANTS & SPECIALIZED COMPONENTS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * ComparisonWinnerRow - Highlights where AuthHub clearly wins
 *
 * Used for pricing, support hours, or other decisive advantages
 */
export function ComparisonWinnerRow({
  feature,
  leadsieValue,
  authhubValue,
  highlight = '$600/yr savings vs Leadsie Agency',
}: {
  feature: string;
  leadsieValue: string;
  authhubValue: string;
  highlight?: string;
}) {
  return (
    <tr className="bg-coral/5 border-b-2 border-coral/30">
      <td className="px-5 py-4 font-mono text-sm font-bold text-ink border-r border-black/20">
        {feature}
      </td>
      <td className="px-5 py-4 text-center font-mono text-sm text-muted-foreground border-r border-black/20 line-through opacity-60">
        {leadsieValue}
      </td>
      <td className="px-5 py-4 text-center bg-gradient-to-r from-coral/10 to-transparent">
        <div className="flex flex-col items-center gap-1">
          <span className="font-dela text-lg text-danger-ink">{authhubValue}</span>
          {highlight && (
            <span className="text-[10px] font-bold uppercase tracking-widest text-success-ink bg-teal/10 px-2 py-0.5 rounded-sm">
              {highlight}
            </span>
          )}
        </div>
      </td>
    </tr>
  );
}
