'use client';

import { useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';
import { getApiBaseUrl } from '@/lib/api/api-env';
import { trackAffiliateEvent } from '@/lib/analytics/affiliate';

const API_URL = getApiBaseUrl();

interface FormState {
  name: string;
  email: string;
  companyName: string;
  websiteUrl: string;
  promotionPlan: string;
}

export function AffiliateProgramForm() {
  const [formState, setFormState] = useState<FormState>({
    name: '',
    email: '',
    companyName: '',
    websiteUrl: '',
    promotionPlan: '',
  });
  const [status, setStatus] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    trackAffiliateEvent('affiliate_page_viewed', {
      surface: 'affiliate_program',
    });
  }, []);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus('submitting');
    setError(null);

    try {
      const response = await fetch(`${API_URL}/api/affiliate/applications`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...formState,
          audienceSize: '1k_to_10k',
          termsAccepted: true,
        }),
      });

      const payload = await response.json();
      if (!response.ok || payload.error) {
        throw new Error(payload.error?.message || 'Failed to submit affiliate application');
      }

      trackAffiliateEvent('affiliate_application_submitted', {
        surface: 'affiliate_program',
      });

      setStatus('success');
      setFormState({
        name: '',
        email: '',
        companyName: '',
        websiteUrl: '',
        promotionPlan: '',
      });
    } catch (submissionError) {
      setStatus('error');
      setError(submissionError instanceof Error ? submissionError.message : 'Failed to submit');
    }
  }

  const inputClasses =
    'w-full rounded-lg border border-border bg-background px-4 py-2.5 text-sm text-foreground focus:border-coral focus:outline-none focus:ring-2 focus:ring-coral/20';

  return (
    <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="space-y-1.5 text-sm text-foreground">
          <span className="font-medium">Name</span>
          <input
            className={inputClasses}
            value={formState.name}
            onChange={(event) => setFormState((prev) => ({ ...prev, name: event.target.value }))}
            required
          />
        </label>
        <label className="space-y-1.5 text-sm text-foreground">
          <span className="font-medium">Email</span>
          <input
            className={inputClasses}
            type="email"
            value={formState.email}
            onChange={(event) => setFormState((prev) => ({ ...prev, email: event.target.value }))}
            required
          />
        </label>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="space-y-1.5 text-sm text-foreground">
          <span className="font-medium">Company</span>
          <input
            className={inputClasses}
            value={formState.companyName}
            onChange={(event) => setFormState((prev) => ({ ...prev, companyName: event.target.value }))}
          />
        </label>
        <label className="space-y-1.5 text-sm text-foreground">
          <span className="font-medium">Website</span>
          <input
            className={inputClasses}
            type="url"
            value={formState.websiteUrl}
            onChange={(event) => setFormState((prev) => ({ ...prev, websiteUrl: event.target.value }))}
          />
        </label>
      </div>

      <label className="space-y-1.5 text-sm text-foreground">
        <span className="font-medium">How will you promote AuthHub?</span>
        <textarea
          className={`${inputClasses} min-h-28 resize-y`}
          value={formState.promotionPlan}
          onChange={(event) => setFormState((prev) => ({ ...prev, promotionPlan: event.target.value }))}
          required
        />
      </label>

      <div className="flex flex-col gap-3 border-t border-border/70 pt-4 sm:flex-row sm:items-end sm:justify-between">
        <p className="max-w-[18rem] text-xs leading-relaxed text-muted-foreground">
          By applying, you agree to a manual review and approval process.
        </p>
        <Button
          type="submit"
          variant="primary"
          size="sm"
          className="sm:min-w-[12rem]"
          disabled={status === 'submitting'}
        >
          {status === 'submitting' ? 'Submitting...' : 'Apply to the program'}
        </Button>
      </div>

      {status === 'success' ? (
        <p className="rounded-lg border border-teal/30 bg-teal/10 px-4 py-3 text-sm text-success-ink">
          Application received. We&apos;ll review it and follow up by email.
        </p>
      ) : null}

      {status === 'error' && error ? (
        <p className="rounded-lg border border-coral/30 bg-coral/10 px-4 py-3 text-sm text-danger-ink">
          {error}
        </p>
      ) : null}
    </form>
  );
}
