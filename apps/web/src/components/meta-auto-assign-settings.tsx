'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@clerk/nextjs';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { MetaAssignableRecipient, MetaAutoAssignPreferences } from '@agency-platform/shared';
import { defaultMetaAutoAssignPreferences } from '@agency-platform/shared';
import { authorizedApiFetch } from '@/lib/api/authorized-api-fetch';
import { DEV_BYPASS_TOKEN, useAuthOrBypass } from '@/lib/dev-auth';
import { ManageAssetsSectionCard } from './manage-assets-ui';
import { Button } from './ui/button';
import { cn } from '@/lib/utils';

interface MetaAutoAssignSettingsProps {
  agencyId: string;
}

export function MetaAutoAssignSettings({ agencyId }: MetaAutoAssignSettingsProps) {
  const queryClient = useQueryClient();
  const clerkAuth = useAuth();
  const { getToken } = clerkAuth;
  const auth = useAuthOrBypass(clerkAuth);
  const [preferences, setPreferences] = useState<MetaAutoAssignPreferences>(defaultMetaAutoAssignPreferences());
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  const { data: initialPreferences, isLoading: loadingPreferences } = useQuery({
    queryKey: ['meta-auto-assign-preferences', agencyId],
    queryFn: async () =>
      (
        await authorizedApiFetch<{ data: MetaAutoAssignPreferences }>(
          `/agency-platforms/meta/auto-assign-preferences?agencyId=${encodeURIComponent(agencyId)}`,
          {
            getToken: async () => (await getToken()) ?? (auth.isDevelopmentBypass ? DEV_BYPASS_TOKEN : null),
          },
        )
      ).data,
    enabled: Boolean(agencyId) && auth.isLoaded,
  });

  const { data: assignees = [], isLoading: loadingAssignees, error: assigneesError, refetch } = useQuery<
    MetaAssignableRecipient[]
  >({
    queryKey: ['meta-assignees', agencyId],
    queryFn: async () =>
      (
        await authorizedApiFetch<{ data: MetaAssignableRecipient[] }>(
          `/agency-platforms/meta/assignees?agencyId=${encodeURIComponent(agencyId)}`,
          {
            getToken: async () => (await getToken()) ?? (auth.isDevelopmentBypass ? DEV_BYPASS_TOKEN : null),
          },
        )
      ).data,
    enabled: Boolean(agencyId) && auth.isLoaded,
    retry: false,
  });

  useEffect(() => {
    if (initialPreferences) {
      setPreferences(initialPreferences);
    }
  }, [initialPreferences]);

  const { mutate: savePreferences, isPending: isSaving } = useMutation({
    mutationFn: async (next: MetaAutoAssignPreferences) =>
      authorizedApiFetch<{ data: MetaAutoAssignPreferences }>(
        '/agency-platforms/meta/auto-assign-preferences',
        {
          method: 'PATCH',
          getToken: async () => (await getToken()) ?? (auth.isDevelopmentBypass ? DEV_BYPASS_TOKEN : null),
          body: JSON.stringify({ agencyId, preferences: next }),
        },
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['meta-auto-assign-preferences', agencyId] });
      setSaveMessage('Auto-Assign preferences saved.');
    },
    onError: (error: Error) => {
      setSaveMessage(error.message);
    },
  });

  const toggleEnabled = (enabled: boolean) => {
    const next = { ...preferences, enabled };
    setPreferences(next);
    savePreferences(next);
  };

  const toggleRecipient = (recipient: MetaAssignableRecipient) => {
    const selected = preferences.recipients.some(
      (item) => item.type === recipient.type && item.id === recipient.id,
    );
    const recipients = selected
      ? preferences.recipients.filter(
          (item) => !(item.type === recipient.type && item.id === recipient.id),
        )
      : [...preferences.recipients, { type: recipient.type, id: recipient.id, name: recipient.name }];
    const next = { ...preferences, recipients };
    setPreferences(next);
    savePreferences(next);
  };

  if (loadingPreferences) {
    return <p className="text-sm text-muted-foreground">Loading Auto-Assign settings…</p>;
  }

  const humans = assignees.filter((recipient) => recipient.type === 'human');
  const systemUsers = assignees.filter((recipient) => recipient.type === 'system_user');

  return (
    <ManageAssetsSectionCard
      eyebrow="Post-Partner"
      title="Auto-Assign team access"
      description="After Partner share or Check access succeeds, assign selected agency people and system users to shared client assets. This never replaces Partner share and does not prove human Ads Manager access without assignment results."
    >
      <div className="space-y-4">
        <label className="flex min-h-[44px] items-start gap-3 text-sm text-ink">
          <input
            type="checkbox"
            checked={preferences.enabled}
            onChange={(event) => toggleEnabled(event.target.checked)}
            className="mt-1 h-5 w-5 rounded border-border text-danger-ink focus:ring-coral"
            aria-describedby="meta-auto-assign-help"
          />
          <span>
            <span className="font-semibold">Run Auto-Assign after Partner success</span>
            <span id="meta-auto-assign-help" className="mt-1 block text-muted-foreground">
              Choose who should receive asset assignments once the agency Business Portfolio is a verified Partner.
            </span>
          </span>
        </label>

        {preferences.enabled ? (
          <section aria-labelledby="meta-auto-assign-picker-title" className="space-y-4 border border-black bg-paper p-4">
            <h3 id="meta-auto-assign-picker-title" className="text-base font-semibold text-ink">
              Auto-Assign targets
            </h3>
            {loadingAssignees ? (
              <p className="text-sm text-muted-foreground">Loading Meta people and system users…</p>
            ) : assigneesError ? (
              <div className="space-y-2">
                <p className="text-sm text-danger-ink">Could not load assignees. Connect Meta and select a Business Portfolio.</p>
                <Button type="button" size="sm" variant="secondary" onClick={() => void refetch()}>
                  Retry
                </Button>
              </div>
            ) : (
              <>
                <RecipientGroup
                  title="People"
                  recipients={humans}
                  selected={preferences.recipients}
                  onToggle={toggleRecipient}
                />
                <RecipientGroup
                  title="System users"
                  recipients={systemUsers}
                  selected={preferences.recipients}
                  onToggle={toggleRecipient}
                />
              </>
            )}
          </section>
        ) : null}

        {saveMessage ? (
          <p className="text-sm text-muted-foreground" role="status">
            {saveMessage}
            {isSaving ? ' Saving…' : null}
          </p>
        ) : null}
      </div>
    </ManageAssetsSectionCard>
  );
}

function RecipientGroup({
  title,
  recipients,
  selected,
  onToggle,
}: {
  title: string;
  recipients: MetaAssignableRecipient[];
  selected: MetaAutoAssignPreferences['recipients'];
  onToggle: (recipient: MetaAssignableRecipient) => void;
}) {
  if (recipients.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No {title.toLowerCase()} found in this Business Portfolio.
      </p>
    );
  }

  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</p>
      <ul className="mt-2 space-y-2">
        {recipients.map((recipient) => {
          const checked = selected.some(
            (item) => item.type === recipient.type && item.id === recipient.id,
          );
          const inputId = `auto-assign-${recipient.type}-${recipient.id}`;
          return (
            <li key={inputId}>
              <label
                htmlFor={inputId}
                className={cn(
                  'flex min-h-[44px] cursor-pointer items-center gap-3 rounded-[1rem] border px-3 py-2 text-sm',
                  checked ? 'border-black bg-paper' : 'border-border bg-card/70',
                )}
              >
                <input
                  id={inputId}
                  type="checkbox"
                  checked={checked}
                  onChange={() => onToggle(recipient)}
                  className="h-5 w-5 rounded border-border text-danger-ink focus:ring-coral"
                />
                <span>
                  <span className="font-medium text-ink">{recipient.name}</span>
                  {recipient.role ? (
                    <span className="ml-2 text-xs text-muted-foreground">{recipient.role}</span>
                  ) : null}
                </span>
              </label>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
