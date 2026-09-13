'use client';

/**
 * Agency Profile Card
 *
 * Form for agency name, website, and logo.
 */

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@clerk/nextjs';
import { useQueryClient } from '@tanstack/react-query';
import { Building2, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { authorizedApiFetch } from '@/lib/api/authorized-api-fetch';
import { USER_AGENCY_QUERY_KEY, useUserAgency, type UserAgency } from '@/hooks/use-user-agency';

function toOptionalString(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

export function AgencyProfileCard() {
  const { getToken } = useAuth();
  const queryClient = useQueryClient();
  const { data: agency, isLoading: isAgencyLoading, isError, error } = useUserAgency();
  const [agencyId, setAgencyId] = useState<string | null>(null);
  const [agencyName, setAgencyName] = useState('');
  const [companyWebsite, setCompanyWebsite] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);
  const [feedbackError, setFeedbackError] = useState(false);

  useEffect(() => {
    if (!agency) {
      setAgencyId(null);
      setAgencyName('');
      setCompanyWebsite('');
      setLogoUrl('');
      return;
    }

    setAgencyId(agency.id);
    setAgencyName(agency.name || '');
    setCompanyWebsite(toOptionalString(agency.settings?.website));
    setLogoUrl(toOptionalString(agency.settings?.logoUrl));
  }, [agency]);

  useEffect(() => {
    if (!isError) {
      return;
    }

    setFeedbackMessage(error instanceof Error ? error.message : 'Failed to load agency profile');
    setFeedbackError(true);
  }, [error, isError]);

  const handleSave = useCallback(async () => {
    if (!agencyId || isSaving) {
      return;
    }

    try {
      setIsSaving(true);
      setFeedbackMessage(null);
      setFeedbackError(false);

      const trimmedName = agencyName.trim();
      const trimmedWebsite = companyWebsite.trim();
      const trimmedLogo = logoUrl.trim();

      await authorizedApiFetch(`/api/agencies/${agencyId}`, {
        method: 'PATCH',
        getToken,
        body: JSON.stringify({
          name: trimmedName,
          settings: {
            website: trimmedWebsite.length > 0 ? trimmedWebsite : null,
            logoUrl: trimmedLogo.length > 0 ? trimmedLogo : null,
          },
        }),
      });

      setAgencyName(trimmedName);
      setCompanyWebsite(trimmedWebsite);
      setLogoUrl(trimmedLogo);
      setFeedbackMessage('Changes saved');
      setFeedbackError(false);
      queryClient.setQueriesData<UserAgency | null>(
        { queryKey: [USER_AGENCY_QUERY_KEY] },
        (current) =>
          current
            ? {
                ...current,
                name: trimmedName,
                settings: {
                  ...(current.settings ?? {}),
                  website: trimmedWebsite.length > 0 ? trimmedWebsite : null,
                  logoUrl: trimmedLogo.length > 0 ? trimmedLogo : null,
                },
              }
            : current
      );
    } catch (saveError) {
      setFeedbackMessage(saveError instanceof Error ? saveError.message : 'Failed to save changes');
      setFeedbackError(true);
    } finally {
      setIsSaving(false);
    }
  }, [agencyId, agencyName, companyWebsite, getToken, isSaving, logoUrl, queryClient]);

  const isLoading = isAgencyLoading;

  return (
    <section className="clean-card p-6">
      <div className="flex items-center gap-3 mb-4">
        <div className="p-2 bg-coral/10 rounded-lg">
          <Building2 className="h-5 w-5 text-danger-ink" />
        </div>
        <div>
          <h2 className="font-display text-lg font-semibold text-ink">Agency Profile</h2>
          <p className="text-sm text-muted-foreground">Update your agency information</p>
        </div>
      </div>

      <div className="space-y-4">
        <div>
          <label htmlFor="agency-name" className="block text-sm font-medium text-foreground mb-1">
            Agency Name
          </label>
          <input
            id="agency-name"
            type="text"
            value={agencyName}
            onChange={(event) => setAgencyName(event.target.value)}
            placeholder="Your Agency Name"
            disabled={isLoading || !agencyId}
            className="w-full px-4 py-2 border border-input rounded-lg focus:outline-none focus:ring-2 focus:ring-coral focus:border-transparent disabled:cursor-not-allowed disabled:bg-muted/40"
          />
        </div>

        <div>
          <label htmlFor="company-website" className="block text-sm font-medium text-foreground mb-1">
            Company Website
          </label>
          <input
            id="company-website"
            type="url"
            value={companyWebsite}
            onChange={(event) => setCompanyWebsite(event.target.value)}
            placeholder="https://example.com"
            disabled={isLoading || !agencyId}
            className="w-full px-4 py-2 border border-input rounded-lg focus:outline-none focus:ring-2 focus:ring-coral focus:border-transparent disabled:cursor-not-allowed disabled:bg-muted/40"
          />
        </div>

        <div>
          <label htmlFor="agency-logo-url" className="block text-sm font-medium text-foreground mb-1">
            Logo URL
          </label>
          <input
            id="agency-logo-url"
            type="url"
            value={logoUrl}
            onChange={(event) => setLogoUrl(event.target.value)}
            placeholder="https://example.com/logo.png"
            disabled={isLoading || !agencyId}
            className="w-full px-4 py-2 border border-input rounded-lg focus:outline-none focus:ring-2 focus:ring-coral focus:border-transparent disabled:cursor-not-allowed disabled:bg-muted/40"
          />
          <p className="text-xs text-muted-foreground mt-1">
            Used for client-facing pages and branding
          </p>
        </div>

        {feedbackMessage && (
          <p className={`text-sm ${feedbackError ? 'text-red-600' : 'text-green-700'}`}>{feedbackMessage}</p>
        )}

        <Button
          variant="primary"
          onClick={handleSave}
          disabled={isLoading || isSaving || !agencyId || agencyName.trim().length === 0}
        >
          <Save className="h-4 w-4" />
          {isSaving ? 'Saving...' : 'Save Changes'}
        </Button>
      </div>
    </section>
  );
}
