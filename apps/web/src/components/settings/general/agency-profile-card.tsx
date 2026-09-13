'use client';

/**
 * Agency Profile Card
 *
 * Rows for agency name, website, and logo. Save invalidates the shared
 * ['user-agency'] query so the settings header updates with the new name.
 */

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@clerk/nextjs';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { authorizedApiFetch } from '@/lib/api/authorized-api-fetch';
import { useUserAgency } from '@/hooks/use-user-agency';
import { SettingsGroup, SettingsRow } from '../settings-row';

function toOptionalString(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

export function AgencyProfileCard() {
  const { getToken } = useAuth();
  const queryClient = useQueryClient();
  const { data: agency, isLoading, isError, error } = useUserAgency();
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
      void queryClient.invalidateQueries({ queryKey: ['user-agency'] });
    } catch (error) {
      setFeedbackMessage(error instanceof Error ? error.message : 'Failed to save changes');
      setFeedbackError(true);
    } finally {
      setIsSaving(false);
    }
  }, [agencyId, agencyName, companyWebsite, getToken, isSaving, logoUrl, queryClient]);

  const inputClass =
    'w-full max-w-lg px-4 py-3 border border-black bg-card text-ink disabled:cursor-not-allowed disabled:opacity-60';
  const disabled = isLoading || !agencyId;

  return (
    <SettingsGroup title="Agency Profile" description="What clients see on your request pages.">
      <SettingsRow label="Agency Name" description="Shown on every access request you send." controlId="agency-name">
        <input
          id="agency-name"
          type="text"
          value={agencyName}
          onChange={(event) => setAgencyName(event.target.value)}
          placeholder="Your agency name"
          disabled={disabled}
          className={inputClass}
        />
      </SettingsRow>

      <SettingsRow label="Company Website" description="Linked from client-facing pages." controlId="company-website">
        <input
          id="company-website"
          type="url"
          value={companyWebsite}
          onChange={(event) => setCompanyWebsite(event.target.value)}
          placeholder="https://example.com"
          disabled={disabled}
          className={inputClass}
        />
      </SettingsRow>

      <SettingsRow label="Logo URL" description="Used for client-facing pages and branding." controlId="agency-logo-url">
        <input
          id="agency-logo-url"
          type="url"
          value={logoUrl}
          onChange={(event) => setLogoUrl(event.target.value)}
          placeholder="https://example.com/logo.png"
          disabled={disabled}
          className={inputClass}
        />
      </SettingsRow>

      <SettingsRow label="Save" description="Changes apply to new and existing request links.">
        <div className="flex flex-wrap items-center gap-4">
          <Button
            variant="brutalist"
            onClick={handleSave}
            disabled={disabled || isSaving || agencyName.trim().length === 0}
          >
            {isSaving ? 'Saving…' : 'Save Changes'}
          </Button>
          {feedbackMessage && (
            <p role="status" className={`text-sm ${feedbackError ? 'text-danger-ink' : 'text-success-ink'}`}>
              {feedbackMessage}
            </p>
          )}
        </div>
      </SettingsRow>
    </SettingsGroup>
  );
}
