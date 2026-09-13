'use client';

import type {
  WebhookApiVersion,
  WebhookEndpointConfigInput,
  WebhookEventType,
} from '@agency-platform/shared';
import { WEBHOOK_API_VERSION_V1, WEBHOOK_API_VERSION_V2 } from '@agency-platform/shared';
import { useAuth } from '@clerk/nextjs';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useUserAgency } from '@/hooks/use-user-agency';
import {
  AlertTriangle,
  BellRing,
  KeyRound,
  Send,
  ShieldCheck,
  Webhook,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  disableWebhookEndpoint,
  getWebhookEndpoint,
  listWebhookDeliveries,
  rotateWebhookEndpointSecret,
  sendWebhookTestEvent,
  upsertWebhookEndpoint,
} from '@/lib/api/webhooks';
import { WebhookDeliveryInspector } from './webhook-delivery-inspector';
import { WebhookSettingsCardShell } from './webhook-settings-card-shell';
import { WebhookStatusBadge } from './webhook-status-badge';

const DELIVERY_LIMIT = 8;

const EVENT_OPTIONS: Array<{
  value: WebhookEventType;
  label: string;
  description: string;
  group?: string;
}> = [
  {
    value: 'webhook.test',
    label: 'Test event',
    description: 'Use this event to verify your endpoint and signing implementation.',
  },
  {
    value: 'access_request.partial',
    label: 'Partial completion',
    description: 'Fires when a client has connected part of the requested stack.',
    group: 'Connection Events',
  },
  {
    value: 'access_request.completed',
    label: 'Completed access request',
    description: 'Fires when the access request is fully completed.',
    group: 'Connection Events',
  },
  {
    value: 'access_request.revoked',
    label: 'Revoked access request',
    description: 'Fires when an agency cancels or revokes a pending or completed request.',
    group: 'Connection Events',
  },
  {
    value: 'access_request.expired',
    label: 'Expired access request',
    description: 'Fires when a pending request passes its expiration date without being completed.',
    group: 'Connection Events',
  },
  {
    value: 'connection.status_changed',
    label: 'Connection status changed',
    description: 'Fires when a platform authorization status changes (e.g., active → invalid).',
    group: 'Health Events',
  },
];

function isValidWebhookUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'https:' || parsed.hostname === 'localhost';
  } catch {
    return false;
  }
}

function formatDateTime(value: string | null | undefined): string {
  if (!value) {
    return 'Never';
  }

  return new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

function getFeedbackTone(isError: boolean): string {
  return isError ? 'text-danger-ink' : 'text-success-ink';
}

export function WebhookSettingsTab() {
  const { getToken } = useAuth();
  const queryClient = useQueryClient();
  const { data: agency, isLoading: isAgencyLoading, isError: isAgencyError, error: agencyError } = useUserAgency();
  const [destinationUrl, setDestinationUrl] = useState('');
  const [selectedEvents, setSelectedEvents] = useState<WebhookEventType[]>(['access_request.completed']);
  const [selectedApiVersion, setSelectedApiVersion] = useState<WebhookApiVersion>(WEBHOOK_API_VERSION_V1);
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);
  const [feedbackError, setFeedbackError] = useState(false);
  const [signingSecret, setSigningSecret] = useState<string | null>(null);
  const [selectedDeliveryId, setSelectedDeliveryId] = useState<string | null>(null);

  const agencyId = agency?.id ?? null;

  const endpointQuery = useQuery({
    queryKey: ['settings-webhooks-endpoint', agencyId],
    enabled: Boolean(agencyId),
    queryFn: () => getWebhookEndpoint(agencyId as string, getToken),
  });

  const deliveriesQuery = useQuery({
    queryKey: ['settings-webhooks-deliveries', agencyId, DELIVERY_LIMIT],
    enabled: Boolean(agencyId),
    queryFn: () => listWebhookDeliveries(agencyId as string, DELIVERY_LIMIT, getToken),
  });

  useEffect(() => {
    const endpoint = endpointQuery.data;

    if (!endpoint) {
      setDestinationUrl('');
      setSelectedEvents(['access_request.completed']);
      setSelectedApiVersion(WEBHOOK_API_VERSION_V1);
      return;
    }

    setDestinationUrl(endpoint.url);
    setSelectedEvents(endpoint.subscribedEvents);
    setSelectedApiVersion(endpoint.preferredApiVersion);
  }, [endpointQuery.data]);

  useEffect(() => {
    const deliveries = deliveriesQuery.data?.deliveries ?? [];
    setSelectedDeliveryId(deliveries[0]?.id ?? null);
  }, [deliveriesQuery.data?.deliveries]);

  const refreshWebhookQueries = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['settings-webhooks-endpoint', agencyId] }),
      queryClient.invalidateQueries({ queryKey: ['settings-webhooks-deliveries', agencyId, DELIVERY_LIMIT] }),
    ]);
  };

  const saveMutation = useMutation({
    mutationFn: (payload: WebhookEndpointConfigInput) =>
      upsertWebhookEndpoint(agencyId as string, payload, getToken),
    onSuccess: async (result) => {
      setSigningSecret(result.signingSecret ?? null);
      setFeedbackMessage(result.signingSecret ? 'Endpoint created. Store this signing secret now.' : 'Endpoint updated.');
      setFeedbackError(false);
      await refreshWebhookQueries();
    },
    onError: (error) => {
      setSigningSecret(null);
      setFeedbackMessage(error instanceof Error ? error.message : 'Failed to save webhook endpoint.');
      setFeedbackError(true);
    },
  });

  const rotateMutation = useMutation({
    mutationFn: () => rotateWebhookEndpointSecret(agencyId as string, getToken),
    onSuccess: async (result) => {
      setSigningSecret(result.signingSecret ?? null);
      setFeedbackMessage('Signing secret rotated. Update your receiver before sending more events.');
      setFeedbackError(false);
      await refreshWebhookQueries();
    },
    onError: (error) => {
      setFeedbackMessage(error instanceof Error ? error.message : 'Failed to rotate signing secret.');
      setFeedbackError(true);
    },
  });

  const disableMutation = useMutation({
    mutationFn: () => disableWebhookEndpoint(agencyId as string, getToken),
    onSuccess: async () => {
      setFeedbackMessage('Endpoint disabled. Deliveries are paused until you save it again.');
      setFeedbackError(false);
      setSigningSecret(null);
      await refreshWebhookQueries();
    },
    onError: (error) => {
      setFeedbackMessage(error instanceof Error ? error.message : 'Failed to disable endpoint.');
      setFeedbackError(true);
    },
  });

  const testMutation = useMutation({
    mutationFn: () => sendWebhookTestEvent(agencyId as string, getToken),
    onSuccess: async () => {
      setFeedbackMessage('Test event queued.');
      setFeedbackError(false);
      await refreshWebhookQueries();
    },
    onError: (error) => {
      setFeedbackMessage(error instanceof Error ? error.message : 'Failed to send test event.');
      setFeedbackError(true);
    },
  });

  const endpoint = endpointQuery.data;
  const deliveries = deliveriesQuery.data?.deliveries ?? [];
  const endpointExists = Boolean(endpoint);
  const hasRecentFailure = Boolean(endpoint?.failureCount || endpoint?.lastFailedAt);
  const isBusy =
    saveMutation.isPending ||
    rotateMutation.isPending ||
    disableMutation.isPending ||
    testMutation.isPending;

  const handleEventToggle = (eventType: WebhookEventType, checked: boolean) => {
    if (checked) {
      setSelectedEvents((current) => Array.from(new Set([...current, eventType])) as WebhookEventType[]);
      return;
    }

    setSelectedEvents((current) => current.filter((value) => value !== eventType));
  };

  const handleSave = async () => {
    setFeedbackMessage(null);
    setFeedbackError(false);

    const trimmedUrl = destinationUrl.trim();
    if (!agencyId) {
      setFeedbackMessage('Unable to resolve your agency context.');
      setFeedbackError(true);
      return;
    }

    if (!isValidWebhookUrl(trimmedUrl)) {
      setFeedbackMessage('Enter a valid HTTPS destination URL.');
      setFeedbackError(true);
      return;
    }

    if (selectedEvents.length === 0) {
      setFeedbackMessage('Select at least one webhook event.');
      setFeedbackError(true);
      return;
    }

    setSigningSecret(null);
    await saveMutation.mutateAsync({
      url: trimmedUrl,
      subscribedEvents: selectedEvents,
      preferredApiVersion: selectedApiVersion,
    });
  };

  if (isAgencyLoading || (agencyId && (endpointQuery.isLoading || deliveriesQuery.isLoading))) {
    return (
      <div className="space-y-6">
        <div className="clean-card animate-pulse p-6">
          <div className="h-6 w-48 rounded bg-card/60" />
          <div className="mt-3 h-4 w-80 rounded bg-card/60" />
          <div className="mt-8 h-40 rounded-2xl bg-card/60" />
        </div>
        <div className="clean-card animate-pulse p-6">
          <div className="h-6 w-56 rounded bg-card/60" />
          <div className="mt-6 h-48 rounded-2xl bg-card/60" />
        </div>
      </div>
    );
  }

  if (!isAgencyLoading && !agencyId) {
    return (
      <WebhookSettingsCardShell
        title="Webhook Endpoint"
        description="Manage the outbound endpoint used for access request lifecycle updates."
        icon={Webhook}
      >
        <p className="rounded-2xl border border-dashed border-border bg-paper/60 p-5 text-sm text-muted-foreground">
          This workspace does not have an agency context yet, so webhook settings are unavailable.
        </p>
      </WebhookSettingsCardShell>
    );
  }

  if (isAgencyError || endpointQuery.isError || deliveriesQuery.isError) {
    return (
      <WebhookSettingsCardShell
        title="Webhook Endpoint"
        description="Manage the outbound endpoint used for access request lifecycle updates."
        icon={Webhook}
      >
        <div className="rounded-2xl border border-coral/30 bg-coral/5 p-5 text-sm text-danger-ink">
          {agencyError instanceof Error
            ? agencyError.message
            : endpointQuery.error instanceof Error
            ? endpointQuery.error.message
            : deliveriesQuery.error instanceof Error
            ? deliveriesQuery.error.message
            : 'Failed to load webhook settings.'}
        </div>
      </WebhookSettingsCardShell>
    );
  }

  return (
    <div className="space-y-6">
      <WebhookSettingsCardShell
        title="Webhook Endpoint"
        description="Send signed lifecycle events from AgencyAccess into your CRM, automation, or warehouse."
        icon={Webhook}
        aside={endpoint ? <WebhookStatusBadge status={endpoint.status} /> : undefined}
      >
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,0.9fr)]">
          <div className="space-y-4">
            <div>
              <label htmlFor="webhook-destination-url" className="mb-1 block text-sm font-medium text-foreground">
                Destination URL
              </label>
              <input
                id="webhook-destination-url"
                type="url"
                value={destinationUrl}
                onChange={(event) => setDestinationUrl(event.target.value)}
                placeholder="https://hooks.example.com/agency"
                disabled={isBusy}
                className="w-full rounded-lg border border-input px-4 py-2 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-coral disabled:cursor-not-allowed disabled:bg-muted/40"
              />
              <p className="mt-1 text-xs text-muted-foreground">
                We sign each request with `svix-like` headers: timestamp plus HMAC SHA-256 signature.
              </p>
            </div>

            <div>
              <label htmlFor="webhook-api-version" className="mb-1 block text-sm font-medium text-foreground">
                Payload Version
              </label>
              <select
                id="webhook-api-version"
                value={selectedApiVersion}
                onChange={(event) => setSelectedApiVersion(event.target.value as WebhookApiVersion)}
                disabled={isBusy}
                className="w-full rounded-lg border border-input px-4 py-2 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-coral disabled:cursor-not-allowed disabled:bg-muted/40"
              >
                <option value={WEBHOOK_API_VERSION_V1}>Standard (V1) — connection-level summary</option>
                <option value={WEBHOOK_API_VERSION_V2}>Enhanced (V2) — per-asset detail</option>
              </select>
              <p className="mt-1 text-xs text-muted-foreground">
                {selectedApiVersion === WEBHOOK_API_VERSION_V2
                  ? 'V2 payloads include individual asset IDs, names, types, and statuses for each connected platform.'
                  : 'V1 payloads include connection-level summaries. Upgrade to V2 for granular asset data.'}
              </p>
            </div>

            <fieldset>
              <legend className="text-sm font-medium text-foreground">Subscribed events</legend>
              <div className="mt-3 space-y-3">
                {EVENT_OPTIONS.map((option) => {
                  const checked = selectedEvents.includes(option.value);

                  return (
                    <label
                      key={option.value}
                      className="flex cursor-pointer gap-3 rounded-2xl border border-border bg-paper/60 p-4 transition-colors hover:border-coral/40"
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(event) => handleEventToggle(option.value, event.target.checked)}
                        disabled={isBusy}
                        aria-label={option.value}
                        className="mt-1 h-4 w-4 rounded border-border text-danger-ink focus:ring-coral"
                      />
                      <div>
                        <div className="font-mono text-sm font-semibold text-ink">{option.label}</div>
                        <p className="mt-1 text-sm text-muted-foreground">{option.description}</p>
                      </div>
                    </label>
                  );
                })}
              </div>
            </fieldset>

            <div className="flex flex-wrap gap-3">
              <Button
                type="button"
                variant="primary"
                onClick={() => void handleSave()}
                disabled={isBusy}
              >
                <ShieldCheck className="h-4 w-4" />
                {endpointExists ? 'Save Endpoint' : 'Create Endpoint'}
              </Button>

              <Button
                type="button"
                variant="secondary"
                onClick={() => rotateMutation.mutate()}
                disabled={!endpointExists || isBusy}
              >
                <KeyRound className="h-4 w-4" />
                Rotate Secret
              </Button>

              <Button
                type="button"
                variant="secondary"
                onClick={() => testMutation.mutate()}
                disabled={!endpointExists || endpoint?.status !== 'active' || isBusy}
              >
                <Send className="h-4 w-4" />
                Send Test
              </Button>

              <Button
                type="button"
                variant="ghost"
                onClick={() => disableMutation.mutate()}
                disabled={!endpointExists || endpoint?.status !== 'active' || isBusy}
              >
                <AlertTriangle className="h-4 w-4" />
                Disable
              </Button>
            </div>

            {feedbackMessage && (
              <p className={`text-sm font-medium ${getFeedbackTone(feedbackError)}`}>{feedbackMessage}</p>
            )}
          </div>

          <aside className="rounded-3xl border border-border bg-gradient-to-br from-coral/10 via-paper to-teal/10 p-5">
            <div className="flex items-center gap-2 text-sm font-semibold text-ink">
              <BellRing className="h-4 w-4 text-danger-ink" />
              Delivery posture
            </div>

            <dl className="mt-4 space-y-4 text-sm">
              <div>
                <dt className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Agency</dt>
                <dd className="mt-1 font-medium text-ink">{agency?.name || 'Current agency'}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Last Delivered</dt>
                <dd className="mt-1 text-ink">{formatDateTime(endpoint?.lastDeliveredAt)}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Failure Count</dt>
                <dd className="mt-1 text-ink">{endpoint?.failureCount ?? 0}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Payload Version</dt>
                <dd className="mt-1 font-mono text-ink">{selectedApiVersion === WEBHOOK_API_VERSION_V2 ? 'Enhanced (V2)' : 'Standard (V1)'}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Subscribed Event Set</dt>
                <dd className="mt-2 flex flex-wrap gap-2">
                  {(selectedEvents.length > 0 ? selectedEvents : ['access_request.completed']).map((eventType) => (
                    <code
                      key={eventType}
                      className="rounded bg-ink px-2 py-1 text-xs font-semibold text-paper"
                    >
                      {eventType}
                    </code>
                  ))}
                </dd>
              </div>
              {endpoint?.secretLastFour && (
                <div>
                  <dt className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Current Secret Ref</dt>
                  <dd className="mt-1 font-mono text-ink">••••{endpoint.secretLastFour}</dd>
                </div>
              )}
            </dl>
          </aside>
        </div>

        {!endpointExists && (
          <div className="rounded-3xl border border-dashed border-border bg-paper/70 p-5 text-sm text-muted-foreground">
            No endpoint is configured yet. Add a destination URL, choose the events you want, and create the endpoint to start receiving signed notifications.
          </div>
        )}

        {hasRecentFailure && (
          <div className="rounded-3xl border border-warning/30 bg-warning/5 p-5">
            <div className="flex items-center gap-2 text-sm font-semibold text-ink">
              <AlertTriangle className="h-4 w-4 text-warning" />
              Delivery attention needed
            </div>
            <p className="mt-2 text-sm text-muted-foreground">
              This endpoint has recent delivery failures. Review the inspector below, confirm your receiver returns `2xx`, and rotate the secret if you suspect signature drift.
            </p>
          </div>
        )}

        {signingSecret && (
          <div className="rounded-3xl border border-teal/30 bg-teal/5 p-5">
            <div className="flex items-center gap-2 text-sm font-semibold text-ink">
              <KeyRound className="h-4 w-4 text-success-ink" />
              Signing secret
            </div>
            <p className="mt-2 text-sm text-muted-foreground">
              This value is shown once. Store it in your webhook receiver before leaving this page.
            </p>
            <code className="mt-4 block overflow-x-auto rounded-2xl bg-ink px-4 py-3 text-sm font-semibold text-paper">
              {signingSecret}
            </code>
          </div>
        )}
      </WebhookSettingsCardShell>

      <WebhookSettingsCardShell
        title="Recent Deliveries"
        description="Inspect the most recent attempts sent to this endpoint."
        icon={Send}
      >
        <WebhookDeliveryInspector
          deliveries={deliveries}
          selectedDeliveryId={selectedDeliveryId}
          onInspect={setSelectedDeliveryId}
        />
      </WebhookSettingsCardShell>
    </div>
  );
}
