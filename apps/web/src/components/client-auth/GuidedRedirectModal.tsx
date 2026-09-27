'use client';

/**
 * GuidedRedirectModal - Modal for guided redirects to Meta Business Manager
 *
 * Features:
 * - Step-by-step instructions with numbered list (coral numbers)
 * - "Open Meta Business Manager" button (opens in new tab)
 * - "I've created it" confirmation checkbox
 * - "Refresh List" button (disabled until checkbox checked)
 *
 * Acid Brutalism Design:
 * - Hard borders (border-2 border-black dark:border-white)
 * - Brutalist shadows
 * - Coral/teal colors for emphasis
 */

import { useState } from 'react';
import { ExternalLink, RefreshCw, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

interface GuidedRedirectModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  description: string;
  businessManagerUrl: string;
  instructions: Array<{
    title: string;
    description?: string;
  }>;
  onRefresh: () => void | Promise<void>;
  isRefreshing?: boolean;
}

export function GuidedRedirectModal({
  isOpen,
  onClose,
  title,
  description,
  businessManagerUrl,
  instructions,
  onRefresh,
  isRefreshing = false,
}: GuidedRedirectModalProps) {
  const [confirmedCreated, setConfirmedCreated] = useState(false);
  const [isRefreshingLocal, setIsRefreshingLocal] = useState(false);

  if (!isOpen) return null;

  const handleRefresh = async () => {
    if (!confirmedCreated) return;

    setIsRefreshingLocal(true);
    try {
      await onRefresh();
      // Close modal after successful refresh
      onClose();
    } finally {
      setIsRefreshingLocal(false);
      setConfirmedCreated(false);
    }
  };

  const handleOpenBusinessManager = () => {
    window.open(businessManagerUrl, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <Card className="w-full max-w-lg border-2 border-black dark:border-white shadow-brutalist-lg bg-white dark:bg-ink">
        {/* Header */}
        <div className="flex items-start justify-between p-6 border-b-2 border-black dark:border-white">
          <div>
            <h3 className="text-xl font-bold text-[var(--ink)] font-display">{title}</h3>
            <p className="text-sm text-muted-foreground dark:text-muted-foreground mt-1">{description}</p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center border-2 border-black dark:border-white rounded hover:bg-muted/30 dark:hover:bg-muted/60 transition-colors"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Instructions */}
          <div className="space-y-4">
            {instructions.map((instruction, index) => (
              <div key={index} className="flex gap-4">
                {/* Step Number - Coral Brutalist Square */}
                <div className="flex-shrink-0 w-8 h-8 border-2 border-black dark:border-white bg-[var(--coral)] text-white flex items-center justify-center font-bold text-sm shadow-brutalist-sm">
                  {index + 1}
                </div>
                <div className="flex-1 pt-1">
                  <h4 className="font-semibold text-[var(--ink)]">{instruction.title}</h4>
                  {instruction.description && (
                    <p className="text-sm text-muted-foreground dark:text-muted-foreground mt-1">
                      {instruction.description}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Open Business Manager Button */}
          <Button
            variant="brutalist"
            size="lg"
            onClick={handleOpenBusinessManager}
            rightIcon={<ExternalLink className="w-5 h-5" />}
            className="w-full"
          >
            Open Meta Business Manager
          </Button>

          {/* Confirmation Checkbox */}
          <div className="flex items-start gap-3 p-4 border-2 border-black dark:border-white rounded-lg bg-muted/20 dark:bg-muted/60">
            <input
              type="checkbox"
              id="confirmed-created"
              checked={confirmedCreated}
              onChange={(e) => setConfirmedCreated(e.target.checked)}
              className="mt-0.5 w-5 h-5 border-2 border-black dark:border-white rounded cursor-pointer accent-[var(--coral)]"
            />
            <label
              htmlFor="confirmed-created"
              className="text-sm text-[var(--ink)] cursor-pointer font-medium"
            >
              I've created the Page/Pixel in Meta Business Manager
            </label>
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 border-t-2 border-black dark:border-white bg-muted/20 dark:bg-muted/60">
          <div className="flex gap-3">
            <Button
              variant="secondary"
              size="md"
              onClick={onClose}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              variant="brutalist"
              size="md"
              onClick={handleRefresh}
              disabled={!confirmedCreated || isRefreshing || isRefreshingLocal}
              isLoading={isRefreshing || isRefreshingLocal}
              leftIcon={<RefreshCw className="w-5 h-5" />}
              className="flex-1"
            >
              Refresh List
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}

/**
 * Standalone guided redirect card for inline use
 */
interface GuidedRedirectCardProps {
  title: string;
  description: string;
  businessManagerUrl: string;
  instructions: Array<{
    title: string;
    description?: string;
  }>;
  onRefresh: () => void | Promise<void>;
  isRefreshing?: boolean;
  completionLabel?: string;
  actionLabel?: string;
}

export function GuidedRedirectCard({
  title,
  description,
  businessManagerUrl,
  instructions,
  onRefresh,
  isRefreshing = false,
  completionLabel = "I've created it",
  actionLabel = 'Refresh List',
}: GuidedRedirectCardProps) {
  const [confirmedCreated, setConfirmedCreated] = useState(false);
  const [isRefreshingLocal, setIsRefreshingLocal] = useState(false);

  const handleRefresh = async () => {
    if (!confirmedCreated) return;

    setIsRefreshingLocal(true);
    try {
      await onRefresh();
    } finally {
      setIsRefreshingLocal(false);
      setConfirmedCreated(false);
    }
  };

  const handleOpenBusinessManager = () => {
    window.open(businessManagerUrl, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="border-2 border-[var(--coral)] bg-[var(--coral)]/5 p-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        {/* Warning/Info Icon - Brutalist Square */}
        <div className="w-10 h-10 border-2 border-[var(--coral)] bg-[var(--coral)]/20 flex items-center justify-center flex-shrink-0">
          <ExternalLink className="w-5 h-5 text-danger-ink" />
        </div>
        <div>
          <h3 className="text-lg font-bold text-[var(--ink)] font-display">{title}</h3>
          <p className="text-sm text-muted-foreground dark:text-muted-foreground">{description}</p>
        </div>
      </div>

      {/* Instructions */}
      <div className="space-y-3 mb-4">
        {instructions.map((instruction, index) => (
          <div key={index} className="flex gap-3">
            {/* Step Number - Coral Brutalist Square */}
            <div className="flex-shrink-0 w-6 h-6 border-2 border-black dark:border-white bg-[var(--coral)] text-white flex items-center justify-center font-bold text-xs shadow-brutalist-sm">
              {index + 1}
            </div>
            <div className="flex-1 pt-0.5">
              <p className="text-sm text-[var(--ink)]">{instruction.title}</p>
              {instruction.description && (
                <p className="text-xs text-muted-foreground dark:text-muted-foreground mt-0.5">
                  {instruction.description}
                </p>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Open Business Manager Button */}
      <Button
        variant="brutalist"
        size="md"
        onClick={handleOpenBusinessManager}
        rightIcon={<ExternalLink className="w-4 h-4" />}
        className="w-full mb-3"
      >
        Open Meta Business Manager
      </Button>

      {/* Confirmation Checkbox */}
      <div className="flex items-start gap-3 p-3 border-2 border-black dark:border-white rounded-lg bg-white dark:bg-muted/60 mb-3">
        <input
          type="checkbox"
          id="confirmed-created-card"
          checked={confirmedCreated}
          onChange={(e) => setConfirmedCreated(e.target.checked)}
          className="mt-0.5 w-4 h-4 border-2 border-black dark:border-white rounded cursor-pointer accent-[var(--coral)]"
        />
        <label
          htmlFor="confirmed-created-card"
          className="text-sm text-[var(--ink)] cursor-pointer"
        >
          {completionLabel}
        </label>
      </div>

      {/* Refresh Button */}
      <Button
        variant="secondary"
        size="sm"
        onClick={handleRefresh}
        disabled={!confirmedCreated || isRefreshing || isRefreshingLocal}
        isLoading={isRefreshing || isRefreshingLocal}
        leftIcon={<RefreshCw className="w-4 h-4" />}
        className="w-full"
      >
        {actionLabel}
      </Button>
    </div>
  );
}
