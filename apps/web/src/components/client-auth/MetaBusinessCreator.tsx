'use client';

/**
 * MetaBusinessCreator - Form component for creating a Meta Business Portfolio
 *
 * For clients with no Business Portfolio at all. Prerequisite: the client
 * administers at least one Facebook Page (the guided Page check upstream);
 * the chosen Page becomes the portfolio's primary Page.
 *
 * Acid Brutalism: brutalist input borders, one brutalist submit button
 * (brutalist variant), teal/coral semantic states — mirrors MetaAssetCreator.
 */

import { useEffect, useState, FormEvent } from 'react';
import { CheckCircle2, AlertCircle, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SingleSelect } from '@/components/ui/single-select';
import { resolveApiUrl } from '@/lib/api/api-env';
import { ApiResponseError, parseJsonResponse } from '@/lib/api/parse-json-response';

// Meta business verticals (subset covering agency clients; OTHER is the safe default)
const VERTICALS = [
  { value: 'OTHER', label: 'Other' },
  { value: 'ECOMMERCE', label: 'E-commerce' },
  { value: 'EDUCATION', label: 'Education' },
  { value: 'ENTERTAINMENT_AND_MEDIA', label: 'Entertainment & Media' },
  { value: 'FINANCE', label: 'Finance' },
  { value: 'HEALTH', label: 'Health' },
  { value: 'PROFESSIONAL_SERVICES', label: 'Professional Services' },
  { value: 'REAL_ESTATE', label: 'Real Estate' },
  { value: 'RESTAURANT', label: 'Restaurant' },
  { value: 'RETAIL_AND_CONSUMER_GOODS', label: 'Retail & Consumer Goods' },
  { value: 'TECHNOLOGY', label: 'Technology' },
];

const DEFAULT_TIMEZONE_ID = '25'; // America/New_York in Meta's timezone_id space

interface CreateBusinessRequest {
  connectionId: string;
  name: string;
  vertical: string;
  primaryPageId: string;
  timezoneId: string;
}

interface CreateBusinessResponse {
  id: string;
  name: string;
  timezoneId: string;
}

interface UserPage {
  id: string;
  name: string;
  category?: string;
}

interface MetaBusinessCreatorProps {
  connectionId: string;
  accessRequestToken: string;
  userPages: Array<UserPage>;
  onSuccess?: (business: { id: string; name: string }) => void;
  onError?: (error: string) => void;
  onReconcile?: () => Promise<boolean>;
}

type CreationState = 'idle' | 'loading' | 'success' | 'error';

export function MetaBusinessCreator({
  connectionId,
  accessRequestToken,
  userPages,
  onSuccess,
  onError,
  onReconcile,
}: MetaBusinessCreatorProps) {
  const [state, setState] = useState<CreationState>('idle');
  const [creationError, setCreationError] = useState<Error | null>(null);
  const [isRefreshingBusinesses, setIsRefreshingBusinesses] = useState(false);
  const requiresReconciliation = creationError instanceof ApiResponseError
    && ['CREATION_OUTCOME_UNKNOWN', 'CREATION_IN_PROGRESS'].includes(creationError.code || '');

  // Form state
  const [businessName, setBusinessName] = useState('');
  const [primaryPageId, setPrimaryPageId] = useState(
    userPages.length === 1 ? userPages[0].id : ''
  );
  const [timezoneId, setTimezoneId] = useState('');
  const [vertical, setVertical] = useState('OTHER');

  // Timezones come from the backend — Meta's timezone_id space is sparse
  // and must match the server list exactly.
  const [timezones, setTimezones] = useState<Array<{ id: string; name: string; offset: string }>>([]);

  useEffect(() => {
    let cancelled = false;

    const loadTimezones = async () => {
      try {
        const response = await fetch(
          resolveApiUrl(`/api/client/${accessRequestToken}/create/meta/timezones`)
        );
        const json = await parseJsonResponse<{
          data?: { timezones?: Array<{ id: string; name: string; offset: string }> };
          error?: { message?: string };
        }>(response, { fallbackErrorMessage: 'Failed to load timezones' });

        if (cancelled || json.error) return;

        const fetched = json.data?.timezones || [];
        setTimezones(fetched);
        setTimezoneId((current) => current || DEFAULT_TIMEZONE_ID);
      } catch {
        // Timezone list stays empty; validation below blocks submit
      }
    };

    void loadTimezones();
    return () => {
      cancelled = true;
    };
  }, [accessRequestToken]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    if (!businessName.trim()) {
      setCreationError(new Error('Please enter a business name'));
      setState('error');
      return;
    }
    if (!primaryPageId) {
      setCreationError(new Error('Please select a primary Page'));
      setState('error');
      return;
    }

    try {
      setState('loading');
      setCreationError(null);

      const response = await fetch(
        resolveApiUrl(`/api/client/${accessRequestToken}/create/meta/business`),
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            connectionId,
            name: businessName.trim(),
            vertical,
            primaryPageId,
            timezoneId: timezoneId || DEFAULT_TIMEZONE_ID,
          } as CreateBusinessRequest),
        }
      );

      const json = await parseJsonResponse<{
        data?: CreateBusinessResponse;
          error?: { code?: string; message?: string };
      }>(response, { fallbackErrorMessage: 'Failed to create Business Portfolio' });

      if (json.error || !json.data) {
        throw new ApiResponseError(json.error?.message || 'Failed to create Business Portfolio', json.error?.code);
      }

      setState('success');
      onSuccess?.({ id: json.data.id, name: json.data.name });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Failed to create Business Portfolio';
      setCreationError(err instanceof Error ? err : new Error(message));
      setState('error');
      onError?.(message);
    }
  };

  const handleReset = () => {
    setState('idle');
    setCreationError(null);
  };

  // Error state
  if (state === 'error') {
    return (
      <div className="border border-danger-ink bg-[rgb(var(--coral))]/10 p-6">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 border-2 border-[var(--coral)] bg-[var(--coral)]/20 flex items-center justify-center flex-shrink-0">
            <AlertCircle className="w-6 h-6 text-danger-ink" />
          </div>

          <div className="flex-1">
            <h3 className="font-bold text-danger-ink mb-1 font-display">Creation Failed</h3>
            <p className="text-sm text-danger-ink mb-3">{creationError?.message}</p>
            {requiresReconciliation ? <p className="text-sm text-[rgb(var(--warning))] mb-3">Do not create another Business Portfolio until you refresh Meta and check whether it already exists.</p> : null}

            {requiresReconciliation && onReconcile ? (
              <Button type="button" variant="secondary" size="sm" className="min-h-[44px]" disabled={isRefreshingBusinesses} onClick={async () => {
                setIsRefreshingBusinesses(true);
                try {
                  await onReconcile();
                } finally {
                  setIsRefreshingBusinesses(false);
                }
              }}>{isRefreshingBusinesses ? 'Refreshing…' : 'Refresh Business Portfolios'}</Button>
            ) : requiresReconciliation ? (
              <p role="status" className="text-sm text-[rgb(var(--warning))]">Return to asset selection to refresh Meta Business Portfolios. Do not repeat creation yet.</p>
            ) : <Button variant="brutalist" size="sm" onClick={handleReset}>Try Again</Button>}
          </div>
        </div>
      </div>
    );
  }

  // Success state
  if (state === 'success') {
    return (
      <div className="border border-success-ink bg-[rgb(var(--teal))]/10 p-6 text-center">
        <div className="w-16 h-16 border-2 border-[var(--teal)] bg-[var(--teal)]/20 flex items-center justify-center mx-auto mb-4">
          <CheckCircle2 className="w-10 h-10 text-success-ink" />
        </div>

        <h3 className="text-lg font-bold text-[var(--ink)] mb-2 font-display">
          Business Portfolio Created!
        </h3>
        <p className="text-sm text-muted-foreground mb-4">
          Next: create an ad account inside it to share with your agency.
        </p>
      </div>
    );
  }

  // Form state
  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Business Name */}
      <div>
        <label
          htmlFor="business-name"
          className="block text-sm font-bold text-[var(--ink)] mb-2 font-display uppercase tracking-wide"
        >
          Business Name
        </label>
        <input
          id="business-name"
          type="text"
          value={businessName}
          onChange={(e) => setBusinessName(e.target.value)}
          placeholder="e.g., Acme Business"
          disabled={state === 'loading'}
          className="w-full px-4 py-3 border-2 border-black dark:border-white rounded-none bg-card text-[var(--ink)] placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-[var(--coral)] focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed shadow-brutalist-sm focus:shadow-brutalist transition-shadow"
          maxLength={100}
        />
        <p className="text-xs text-muted-foreground mt-1">
          This Business Portfolio is permanent — Meta does not allow deleting it.
        </p>
      </div>

      {/* Primary Page */}
      <div>
        <label
          htmlFor="primary-page"
          className="block text-sm font-bold text-[var(--ink)] mb-2 font-display uppercase tracking-wide"
        >
          Primary Page
        </label>
        <SingleSelect
          options={userPages.map((page) => ({
            value: page.id,
            label: page.category ? `${page.name} — ${page.category}` : page.name,
          }))}
          value={primaryPageId}
          onChange={(v) => setPrimaryPageId(v)}
          placeholder="Select a Page..."
          disabled={state === 'loading'}
          triggerClassName="border-2 border-black dark:border-white shadow-brutalist-sm focus:shadow-brutalist"
          ariaLabel="Primary Page"
        />
        <p className="text-xs text-muted-foreground mt-1">
          The Page that represents this business on Facebook.
        </p>
      </div>

      {/* Timezone */}
      <div>
        <label
          htmlFor="business-timezone"
          className="block text-sm font-bold text-[var(--ink)] mb-2 font-display uppercase tracking-wide"
        >
          Timezone
        </label>
        <SingleSelect
          options={timezones.map((tz) => ({ value: tz.id, label: `${tz.name} (${tz.offset})` }))}
          value={timezoneId}
          onChange={(v) => setTimezoneId(v)}
          placeholder="Select a timezone..."
          disabled={state === 'loading'}
          triggerClassName="border-2 border-black dark:border-white shadow-brutalist-sm focus:shadow-brutalist"
          ariaLabel="Business Timezone"
        />
        <p className="text-xs text-muted-foreground mt-1">
          Used for reporting across the portfolio.
        </p>
      </div>

      {/* Business Type */}
      <div>
        <label
          htmlFor="business-vertical"
          className="block text-sm font-bold text-[var(--ink)] mb-2 font-display uppercase tracking-wide"
        >
          Business Type
        </label>
        <SingleSelect
          options={VERTICALS}
          value={vertical}
          onChange={(v) => setVertical(v)}
          disabled={state === 'loading'}
          triggerClassName="border-2 border-black dark:border-white shadow-brutalist-sm focus:shadow-brutalist"
          ariaLabel="Business Type"
        />
        <p className="text-xs text-muted-foreground mt-1">
          Helps Meta categorize the business. Not sure? Leave as Other.
        </p>
      </div>

      {/* Submit Button - the one brutalist element */}
      <Button
        type="submit"
        variant="brutalist"
        size="lg"
        isLoading={state === 'loading'}
        disabled={!businessName.trim() || !primaryPageId || state === 'loading'}
        className="w-full mt-6"
        leftIcon={state !== 'loading' ? <Plus className="w-5 h-5" /> : undefined}
      >
        {state === 'loading' ? 'Creating Business...' : 'Create Business'}
      </Button>
    </form>
  );
}
