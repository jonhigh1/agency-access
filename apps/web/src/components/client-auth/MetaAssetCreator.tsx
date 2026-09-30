'use client';

/**
 * MetaAssetCreator - Form component for creating Meta ad accounts
 *
 * Features:
 * - Account name input with brutalist border styling
 * - Currency dropdown (USD, EUR, GBP, CAD, AUD, etc.)
 * - Timezone dropdown with common timezones
 * - "Create Ad Account" button with brutalist variant
 * - Loading state with spinner
 * - Success state with teal checkmark
 * - Error state with coral error message
 *
 * Acid Brutalism Design:
 * - Hard borders (border-2 border-black dark:border-white)
 * - Brutalist shadows where appropriate
 * - Coral/teal colors for semantic states
 */

import { useState, FormEvent } from 'react';
import { CheckCircle2, AlertCircle, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SingleSelect } from '@/components/ui/single-select';
import { resolveApiUrl } from '@/lib/api/api-env';
import { ApiResponseError, parseJsonResponse } from '@/lib/api/parse-json-response';

// Currency options with symbols
const CURRENCIES = [
  { code: 'USD', symbol: '$', name: 'US Dollar' },
  { code: 'EUR', symbol: '€', name: 'Euro' },
  { code: 'GBP', symbol: '£', name: 'British Pound' },
  { code: 'CAD', symbol: 'C$', name: 'Canadian Dollar' },
  { code: 'AUD', symbol: 'A$', name: 'Australian Dollar' },
  { code: 'JPY', symbol: '¥', name: 'Japanese Yen' },
  { code: 'CHF', symbol: 'Fr', name: 'Swiss Franc' },
  { code: 'SEK', symbol: 'kr', name: 'Swedish Krona' },
  { code: 'NOK', symbol: 'kr', name: 'Norwegian Krone' },
  { code: 'DKK', symbol: 'kr', name: 'Danish Krone' },
  { code: 'PLN', symbol: 'zł', name: 'Polish Zloty' },
  { code: 'BRL', symbol: 'R$', name: 'Brazilian Real' },
  { code: 'MXN', symbol: '$', name: 'Mexican Peso' },
  { code: 'INR', symbol: '₹', name: 'Indian Rupee' },
  { code: 'SGD', symbol: 'S$', name: 'Singapore Dollar' },
  { code: 'HKD', symbol: 'HK$', name: 'Hong Kong Dollar' },
  { code: 'NZD', symbol: 'NZ$', name: 'New Zealand Dollar' },
  { code: 'ZAR', symbol: 'R', name: 'South African Rand' },
];

// Common timezones with Meta timezone IDs
const TIMEZONES = [
  { id: '1', name: 'Pacific Time (US & Canada)', offset: 'UTC-8' },
  { id: '2', name: 'Mountain Time (US & Canada)', offset: 'UTC-7' },
  { id: '3', name: 'Central Time (US & Canada)', offset: 'UTC-6' },
  { id: '4', name: 'Eastern Time (US & Canada)', offset: 'UTC-5' },
  { id: '5', name: 'Atlantic Time (Canada)', offset: 'UTC-4' },
  { id: '6', name: 'Central European Time', offset: 'UTC+1' },
  { id: '7', name: 'Eastern European Time', offset: 'UTC+2' },
  { id: '8', name: 'Moscow Time', offset: 'UTC+3' },
  { id: '9', name: 'Dubai Time', offset: 'UTC+4' },
  { id: '10', name: 'India Standard Time', offset: 'UTC+5:30' },
  { id: '11', name: 'Bangkok Time', offset: 'UTC+7' },
  { id: '12', name: 'China Standard Time', offset: 'UTC+8' },
  { id: '13', name: 'Japan Standard Time', offset: 'UTC+9' },
  { id: '14', name: 'Australian Eastern Time', offset: 'UTC+10' },
  { id: '15', name: 'New Zealand Time', offset: 'UTC+12' },
  { id: '16', name: 'Greenwich Mean Time', offset: 'UTC+0' },
];

interface CreateAdAccountRequest {
  connectionId: string;
  businessId: string;
  name: string;
  currency: string;
  timezoneId: string;
}

interface CreateAdAccountResponse {
  id: string;
  name: string;
  accountStatus: number;
  currency: string;
}

interface MetaAssetCreatorProps {
  connectionId: string;
  businessId: string;
  accessRequestToken: string;
  onSuccess?: (account: CreateAdAccountResponse) => void;
  onError?: (error: string) => void;
  onReconcile?: () => Promise<boolean>;
}

type CreationState = 'idle' | 'loading' | 'success' | 'error';

export function MetaAssetCreator({
  connectionId,
  businessId,
  accessRequestToken,
  onSuccess,
  onError,
  onReconcile,
}: MetaAssetCreatorProps) {
  const [state, setState] = useState<CreationState>('idle');
  const [creationError, setCreationError] = useState<Error | null>(null);
  const [isRefreshingAssets, setIsRefreshingAssets] = useState(false);
  const [createdAccount, setCreatedAccount] = useState<CreateAdAccountResponse | null>(null);
  const requiresReconciliation = creationError instanceof ApiResponseError
    && ['CREATION_OUTCOME_UNKNOWN', 'CREATION_IN_PROGRESS'].includes(creationError.code || '');

  // Form state
  const [accountName, setAccountName] = useState('');
  const [currency, setCurrency] = useState('USD');
  const [timezoneId, setTimezoneId] = useState('4'); // Eastern Time default

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    // Validation
    if (!accountName.trim()) {
      setCreationError(new Error('Please enter an account name'));
      setState('error');
      onError?.('Account name is required');
      return;
    }

    try {
      setState('loading');
      setCreationError(null);

      const response = await fetch(
        resolveApiUrl(`/api/client/${accessRequestToken}/create/meta/ad-account`),
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            connectionId,
            businessId,
            name: accountName.trim(),
            currency,
            timezoneId,
          } as CreateAdAccountRequest),
        }
      );

      const json = await parseJsonResponse<{
        data?: CreateAdAccountResponse;
        error?: { code?: string; message?: string };
      }>(response, { fallbackErrorMessage: 'Failed to create ad account' });

      if (json.error) {
        throw new ApiResponseError(json.error.message || 'Failed to create ad account', json.error.code);
      }

      // Success
      const account = json.data as CreateAdAccountResponse;
      setCreatedAccount(account);
      setState('success');
      onSuccess?.(account);

    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to create ad account');
      const message = error.message;
      setCreationError(error);
      setState('error');
      onError?.(message);
    }
  };

  const handleReset = () => {
    setState('idle');
    setCreationError(null);
    setCreatedAccount(null);
  };

  // Success state
  if (state === 'success' && createdAccount) {
    return (
      <div className="border border-success-ink bg-[rgb(var(--teal))]/10 p-6 text-center">
        {/* Success Icon - Brutalist Square */}
        <div className="w-16 h-16 border-2 border-[var(--teal)] bg-[var(--teal)]/20 flex items-center justify-center mx-auto mb-4">
          <CheckCircle2 className="w-10 h-10 text-success-ink" />
        </div>

        <h3 className="text-lg font-bold text-[var(--ink)] mb-2 font-display">Account Created!</h3>
        <p className="text-sm text-muted-foreground dark:text-muted-foreground mb-2">
          "{createdAccount.name}" is ready to use
        </p>
        <p className="text-xs text-muted-foreground dark:text-muted-foreground mb-4">
          ID: {createdAccount.id}
        </p>

        <Button
          variant="secondary"
          size="sm"
          onClick={handleReset}
        >
          Create Another
        </Button>
      </div>
    );
  }

  // Error state
  if (state === 'error') {
    return (
      <div className="border border-danger-ink bg-[rgb(var(--coral))]/10 p-6">
        <div className="flex items-start gap-3">
          {/* Error Icon - Brutalist Square */}
          <div className="w-10 h-10 border-2 border-[var(--coral)] bg-[var(--coral)]/20 flex items-center justify-center flex-shrink-0">
            <AlertCircle className="w-6 h-6 text-danger-ink" />
          </div>

          <div className="flex-1">
            <h3 className="font-bold text-danger-ink mb-1 font-display">Creation Failed</h3>
            <p className="text-sm text-danger-ink mb-3">{creationError?.message}</p>
            {requiresReconciliation ? <p className="text-sm text-[rgb(var(--warning))] mb-3">Do not create another account until you refresh the Meta asset list and check for this account.</p> : null}

            <div className="flex gap-2">
              {requiresReconciliation && onReconcile ? (
                <Button type="button" variant="secondary" size="sm" className="min-h-[44px]" disabled={isRefreshingAssets} onClick={async () => {
                  setIsRefreshingAssets(true);
                  try {
                    await onReconcile();
                  } finally {
                    setIsRefreshingAssets(false);
                  }
                }}>{isRefreshingAssets ? 'Refreshing…' : 'Refresh asset list'}</Button>
              ) : requiresReconciliation ? (
                <p role="status" className="text-sm text-[rgb(var(--warning))]">Return to asset selection to refresh Meta assets. Do not repeat creation yet.</p>
              ) : (
                <Button variant="brutalist" size="sm" onClick={handleReset}>Try Again</Button>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Form state
  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Account Name Input - Brutalist Style */}
      <div>
        <label
          htmlFor="account-name"
          className="block text-sm font-bold text-[var(--ink)] mb-2 font-display uppercase tracking-wide"
        >
          Account Name
        </label>
        <input
          id="account-name"
          type="text"
          value={accountName}
          onChange={(e) => setAccountName(e.target.value)}
          placeholder="e.g., Brand Name - Ads"
          disabled={state === 'loading'}
          className="w-full px-4 py-3 border-2 border-black dark:border-white rounded-none bg-card text-[var(--ink)] placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-[var(--coral)] focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed shadow-brutalist-sm focus:shadow-brutalist transition-shadow"
          maxLength={100}
        />
        <p className="text-xs text-muted-foreground dark:text-muted-foreground mt-1">
          A descriptive name for your ad account (max 100 characters)
        </p>
      </div>

      {/* Currency Dropdown - Brutalist Style */}
      <div>
        <label
          htmlFor="currency"
          className="block text-sm font-bold text-[var(--ink)] mb-2 font-display uppercase tracking-wide"
        >
          Currency
        </label>
        <SingleSelect
          options={CURRENCIES.map((c) => ({ value: c.code, label: `${c.symbol} ${c.code} - ${c.name}` }))}
          value={currency}
          onChange={(v) => setCurrency(v)}
          disabled={state === 'loading'}
          triggerClassName="border-2 border-black dark:border-white shadow-brutalist-sm focus:shadow-brutalist"
          ariaLabel="Currency"
        />
        <p className="text-xs text-muted-foreground dark:text-muted-foreground mt-1">
          The currency for billing and reporting
        </p>
      </div>

      {/* Timezone Dropdown - Brutalist Style */}
      <div>
        <label
          htmlFor="timezone"
          className="block text-sm font-bold text-[var(--ink)] mb-2 font-display uppercase tracking-wide"
        >
          Timezone
        </label>
        <SingleSelect
          options={TIMEZONES.map((tz) => ({ value: tz.id, label: `${tz.name} (${tz.offset})` }))}
          value={timezoneId}
          onChange={(v) => setTimezoneId(v)}
          disabled={state === 'loading'}
          triggerClassName="border-2 border-black dark:border-white shadow-brutalist-sm focus:shadow-brutalist"
          ariaLabel="Timezone"
        />
        <p className="text-xs text-muted-foreground dark:text-muted-foreground mt-1">
          Used for reporting and ad scheduling
        </p>
      </div>

      {/* Submit Button - Brutalist */}
      <Button
        type="submit"
        variant="brutalist"
        size="lg"
        isLoading={state === 'loading'}
        disabled={!accountName.trim() || state === 'loading'}
        className="w-full mt-6"
        leftIcon={state !== 'loading' ? <Plus className="w-5 h-5" /> : undefined}
      >
        {state === 'loading' ? 'Creating Account...' : 'Create Ad Account'}
      </Button>
    </form>
  );
}
