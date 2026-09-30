'use client';

/**
 * AssetSelectorStates - Loading, empty, and error states for asset selectors
 *
 * Acid Brutalism Design:
 * - Hard borders and brutalist styling
 * - Brand colors (coral/teal) for accents
 * - Clear typography hierarchy
 */

import { RefreshCw, AlertCircle, MailX, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';

// ============================================
// Loading Skeleton State
// ============================================
interface AssetSelectorLoadingProps {
  message?: string;
}

export function AssetSelectorLoading({
  message = 'Loading your accounts...',
}: AssetSelectorLoadingProps) {
  return (
    <div className="space-y-3 py-4">
      {/* Animated skeleton items - Brutalist Style */}
      <div className="space-y-3 animate-pulse">
        <div className="h-4 bg-muted/40 dark:bg-muted/50 w-3/4" />
        <div className="h-4 bg-muted/40 dark:bg-muted/50 w-1/2" />
        <div className="h-4 bg-muted/40 dark:bg-muted/50 w-5/6" />
      </div>

      {/* Loading message */}
      <div className="flex items-center justify-center gap-2 text-muted-foreground dark:text-muted-foreground">
        <RefreshCw className="w-4 h-4 animate-spin" />
        <span className="text-sm font-medium">{message}</span>
      </div>
    </div>
  );
}

// ============================================
// Empty State - Brutalist Style
// ============================================
interface AssetSelectorEmptyProps {
  title?: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
}

export function AssetSelectorEmpty({
  title = 'No accounts found',
  description = 'We couldn\'t find any accounts for this platform. You may need to create one first.',
  actionLabel,
  onAction,
}: AssetSelectorEmptyProps) {
  return (
    <div className="py-2 text-center px-4">
      {/* Empty state icon */}
      <div className="w-9 h-9 flex items-center justify-center mx-auto mb-1.5">
        <MailX className="w-5 h-5 text-muted-foreground" aria-hidden="true" />
      </div>

      {/* Message */}
      <h3 className="text-sm font-bold text-[var(--ink)] mb-1 font-display">{title}</h3>
      <p className="text-xs text-muted-foreground dark:text-muted-foreground mb-2 max-w-xs mx-auto">{description}</p>

      {/* Optional action button */}
      {actionLabel && onAction && (
        <Button variant="brutalist" size="sm" onClick={onAction}>
          {actionLabel}
        </Button>
      )}
    </div>
  );
}

// ============================================
// Error State - Brutalist Style
// ============================================
interface AssetSelectorErrorProps {
  title?: string;
  message: string;
  onRetry?: () => void;
  retryLabel?: string;
}

export function AssetSelectorError({
  title = 'Error loading accounts',
  message,
  onRetry,
  retryLabel = 'Try again',
}: AssetSelectorErrorProps) {
  return (
    <div className="border-2 border-[var(--coral)] bg-[var(--coral)]/10 p-4 my-3">
      <div className="flex items-start gap-3">
        {/* Error icon - Brutalist Square */}
        <div className="w-8 h-8 border-2 border-[var(--coral)] bg-[var(--coral)]/20 flex items-center justify-center flex-shrink-0">
          <AlertCircle className="w-5 h-5 text-danger-ink" />
        </div>

        {/* Error message */}
        <div className="flex-1">
          <h3 className="font-bold text-danger-ink mb-1 font-display">{title}</h3>
          <p className="text-sm text-danger-ink mb-2">{message}</p>

          {/* Retry button */}
          {onRetry && (
            <Button variant="brutalist" size="sm" onClick={onRetry}>
              <RefreshCw className="w-4 h-4" />
              {retryLabel}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================
// No Search Results State - Brutalist Style
// ============================================
interface NoSearchResultsProps {
  query: string;
  onClear: () => void;
}

export function NoSearchResults({ query, onClear }: NoSearchResultsProps) {
  return (
    <div className="py-4 text-center px-4">
      {/* Search icon - Brutalist Square */}
      <div className="w-12 h-12 border-2 border-black dark:border-white bg-muted/30 dark:bg-muted/60 flex items-center justify-center mx-auto mb-2">
        <Search className="w-6 h-6 text-muted-foreground" aria-hidden="true" />
      </div>

      {/* Message */}
      <h3 className="text-base font-bold text-[var(--ink)] mb-1 font-display">
        No accounts match "{query}"
      </h3>
      <p className="text-sm text-muted-foreground dark:text-muted-foreground mb-3">Try adjusting your search terms</p>

      {/* Clear search button */}
      <button
        onClick={onClear}
        className="text-sm text-danger-ink hover:text-danger-ink/80 font-semibold underline underline-offset-4"
      >
        Clear search
      </button>
    </div>
  );
}
