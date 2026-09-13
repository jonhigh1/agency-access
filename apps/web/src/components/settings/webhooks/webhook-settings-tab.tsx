'use client';

import type {
  WebhookApiVersion,
  WebhookEndpointConfigInput,
  WebhookEventType,
} from '@agency-platform/shared';
import { WEBHOOK_API_VERSION_V1, WEBHOOK_API_VERSION_V2 } from '@agency-platform/shared';
import { useAuth } from '@clerk/nextjs';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, KeyRound, Send, ShieldCheck } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { authorizedApiFetch } from '@/lib/api/authorized-api-fetch';
import {
  disableWebhookEndpoint,
  getWebhookEndpoint,
  listWebhookDeliveries,
  rotateWebhookEndpointSecret,
  sendWebhookTestEvent,
  upsertWebhookEndpoint,
} from '@/lib/api/webhooks';
import { SettingsGroup, SettingsRow } from '../settings-row';
import { WebhookDeliveryInspector } from './webhook-delivery-inspector';
import { WebhookStatusBadge } from './webhook-status-badge';

interface AgencyRecord {
  id: string;
  name: string;
}

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

const ENDPOINT_GROUP_DESCRIPTION =
  'Send signed lifecycle events from AgencyAccess into your CRM, automation, or warehouse.';

const EMPTY_ENDPOINT_COPY =
  'No endpoint is configured yet. Add a destination URL, choose the events you want, and create the endpoint to start receiving signed notifications.';

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
  const { userId, orgId, getToken } = useAuth();
  const queryClient = useQueryClient();
  const principalClerkId = orgId || userId;
  const [destinationUrl, setDestinationUrl] = useState('');
  const [selectedEvents, setSelectedEvents] = useState<WebhookEventType[]>(['access_request.completed']);
  const [selectedApiVersion, setSelectedApiVersion] = useState<WebhookApiVersion>(WEBHOOK_API_VERSION_V1);
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);
  const [feedbackError, setFeedbackError] = useState(false);
  const [signingSecret, setSigningSecret] = useState<string | null>(null);
  const [selectedDeliveryId, setSelectedDeliveryId] = useState<string | null>(null);

  const agencyQuery = useQuery({
    queryKey: ['settings-webhooks-agency', principalClerkId],
    enabled: Boolean(principalClerkId),
    queryFn: async () => {
      const response = await authorizedApiFetch<{ data: AgencyRecord[]; error: null }>(
        `/api/agencies?clerkUserId=${encodeURIComponent(principalClerkId as string)}`,
        { getToken }
      );

      return response.data[0] ?? null;
    },
  });

  const agencyId = agencyQuery.data?.id ?? null;

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

  // Render branches. Same conditions and precedence as before; every branch
  // now renders inside the same shell (ink-panel strip + titled group) so the
  // tab never swaps to a different section while loading or failing.
  const isLoadingView =
    agencyQuery.isLoading || Boolean(agencyId && (endpointQuery.isLoading || deliveriesQuery.isLoading));
  const hasNoAgency = !principalClerkId || (!agencyQuery.isLoading && !agencyId);
  const hasQueryError = agencyQuery.isError || endpointQuery.isError || deliveriesQuery.isError;
  const errorMessage =
    agencyQuery.error instanceof Error
      ? agencyQuery.error.message
      : endpointQuery.error instanceof Error
      ? endpointQuery.error.message
      : deliveriesQuery.error instanceof Error
      ? deliveriesQuery.error.message
      : 'Failed to load webhook settings.';

  // The one dark surface on this view. Unloaded values render as "—".
  const stripUrl = endpoint ? endpoint.url : endpointQuery.isSuccess ? EMPTY_ENDPOINT_COPY : '—';

  const endpointStrip = (
    <div className="ink-panel p-6">
      <span className="label-micro">Endpoint</span>
      <p className="mt-2 break-all text-sm">{stripUrl}</p>
      <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2">
        {endpoint ? <WebhookStatusBadge status={endpoint.status} /> : <span className="label-nano">Status —</span>}
        <span className="label-nano">Last delivery {endpoint ? formatDateTime(endpoint.lastDeliveredAt) : '—'}</span>
        <span className="label-nano">Failures {endpoint ? endpoint.failureCount : '—'}</span>
        {endpoint?.secretLastFour && <span className="label-nano">Secret ••••{endpoint.secretLastFour}</span>}
      </div>
    </div>
  );

  let body: React.ReactNode;

  if (isLoadingView) {
    body = (
      <SettingsGroup title="Webhook Endpoint" description={ENDPOINT_GROUP_DESCRIPTION}>
        <div className="space-y-4 py-5" aria-busy="true" aria-label="Loading webhook settings">
          <div className="h-4 w-48 animate-pulse bg-muted" />
          <div className="h-12 w-full max-w-lg animate-pulse bg-muted" />
          <div className="h-4 w-80 max-w-full animate-pulse bg-muted" />
          <div className="h-40 w-full animate-pulse bg-muted" />
        </div>
      </SettingsGroup>
    );
  } else if (hasNoAgency) {
    body = (
      <SettingsGroup title="Webhook Endpoint" description={ENDPOINT_GROUP_DESCRIPTION}>
        <p className="py-5 text-sm text-muted-foreground">
          This workspace does not have an agency context yet, so webhook settings are unavailable.
        </p>
      </SettingsGroup>
    );
  } else if (hasQueryError) {
    body = (
      <SettingsGroup title="Webhook Endpoint" description={ENDPOINT_GROUP_DESCRIPTION}>
        <p className="py-5 text-sm text-danger-ink">{errorMessage}</p>
      </SettingsGroup>
    );
  } else {
    body = (
      <>
        <SettingsGroup title="Webhook Endpoint" description={ENDPOINT_GROUP_DESCRIPTION}>
          {hasRecentFailure && (
            <div className="mt-4 border border-warning/30 bg-warning/10 p-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-ink">
                <AlertTriangle className="h-4 w-4 text-warning" />
                Delivery attention needed
              </div>
              <p className="mt-2 text-sm text-muted-foreground">
                This endpoint has recent delivery failures. Review the inspector below, confirm your receiver returns `2xx`, and rotate the secret if you suspect signature drift.
              </p>
            </div>
          )}

          <SettingsRow
            label="Destination URL"
            controlId="webhook-destination-url"
            description="We sign each request with `svix-like` headers: timestamp plus HMAC SHA-256 signature."
          >
            <input
              id="webhook-destination-url"
              type="url"
              value={destinationUrl}
              onChange={(event) => setDestinationUrl(event.target.value)}
              placeholder="https://hooks.example.com/agency"
              disabled={isBusy}
              className="w-full max-w-lg border border-black px-4 py-3 text-sm disabled:cursor-not-allowed disabled:bg-muted/40"
            />
          </SettingsRow>

          <SettingsRow
            label="Payload version"
            controlId="webhook-api-version"
            description={
              selectedApiVersion === WEBHOOK_API_VERSION_V2
                ? 'V2 payloads include individual asset IDs, names, types, and statuses for each connected platform.'
                : 'V1 payloads include connection-level summaries. Upgrade to V2 for granular asset data.'
            }
          >
            <select
              id="webhook-api-version"
              value={selectedApiVersion}
              onChange={(event) => setSelectedApiVersion(event.target.value as WebhookApiVersion)}
              disabled={isBusy}
              className="w-full max-w-lg border border-black px-4 py-3 text-sm disabled:cursor-not-allowed disabled:bg-muted/40"
            >
              <option value={WEBHOOK_API_VERSION_V1}>Standard (V1) — connection-level summary</option>
              <option value={WEBHOOK_API_VERSION_V2}>Enhanced (V2) — per-asset detail</option>
            </select>
          </SettingsRow>

          <SettingsRow label="Subscribed events" description="Choose which lifecycle events this endpoint receives.">
            <fieldset aria-label="Subscribed events" className="space-y-3">
              {EVENT_OPTIONS.map((option) => {
                const checked = selectedEvents.includes(option.value);

                return (
                  <label
                    key={option.value}
                    className="flex cursor-pointer gap-3 border border-border p-4 transition-colors duration-150 hover:border-coral/40"
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(event) => handleEventToggle(option.value, event.target.checked)}
                      disabled={isBusy}
                      aria-label={option.value}
                      className="mt-1 h-4 w-4 shrink-0 accent-coral"
                    />
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-ink">{option.label}</div>
                      <span className="label-nano break-all">{option.value}</span>
                      <p className="mt-1 text-sm text-muted-foreground">{option.description}</p>
                    </div>
                  </label>
                );
              })}
            </fieldset>
          </SettingsRow>

          <SettingsRow
            label={endpointExists ? 'Save changes' : 'Create endpoint'}
            description={
              endpointExists
                ? 'Saving keeps the current signing secret.'
                : 'Creating the endpoint reveals its signing secret once.'
            }
          >
            <Button type="button" variant="brutalist" onClick={() => void handleSave()} disabled={isBusy}>
              <ShieldCheck className="h-4 w-4" />
              {endpointExists ? 'Save Endpoint' : 'Create Endpoint'}
            </Button>
          </SettingsRow>
        </SettingsGroup>

        <SettingsGroup
          title="Secret and delivery controls"
          description="Rotate the signing secret, send a test event, or pause deliveries."
        >
          {signingSecret && (
            <div className="mt-4 border-2 border-black p-5">
              <div className="flex items-center gap-2 text-sm font-semibold text-ink">
                <KeyRound className="h-4 w-4" />
                Signing secret
              </div>
              <p className="mt-2 text-sm text-muted-foreground">
                This value is shown once. Store it in your webhook receiver before leaving this page.
              </p>
              <code className="mt-4 block break-all bg-ink px-4 py-3 text-sm font-semibold text-paper">
                {signingSecret}
              </code>
            </div>
          )}

          <SettingsRow
            label="Secret rotation"
            description="Issues a new signing secret and shows it once. Update your receiver before sending more events."
          >
            <Button
              type="button"
              variant="secondary"
              onClick={() => rotateMutation.mutate()}
              disabled={!endpointExists || isBusy}
            >
              <KeyRound className="h-4 w-4" />
              Rotate secret
            </Button>
          </SettingsRow>

          <SettingsRow
            label="Test delivery"
            description="Queues a test event to the active endpoint so you can verify signatures end to end."
          >
            <Button
              type="button"
              variant="secondary"
              onClick={() => testMutation.mutate()}
              disabled={!endpointExists || endpoint?.status !== 'active' || isBusy}
            >
              <Send className="h-4 w-4" />
              Send test event
            </Button>
          </SettingsRow>

          <SettingsRow label="Pause deliveries" description="Disabling stops deliveries until you save the endpoint again.">
            <Button
              type="button"
              variant="danger"
              onClick={() => disableMutation.mutate()}
              disabled={!endpointExists || endpoint?.status !== 'active' || isBusy}
            >
              <AlertTriangle className="h-4 w-4" />
              Disable endpoint
            </Button>
          </SettingsRow>
        </SettingsGroup>

        <SettingsGroup title="Recent Deliveries" description="Inspect the most recent attempts sent to this endpoint.">
          <div className="pt-4">
            <WebhookDeliveryInspector
              deliveries={deliveries}
              selectedDeliveryId={selectedDeliveryId}
              onInspect={setSelectedDeliveryId}
            />
          </div>
        </SettingsGroup>
      </>
    );
  }

  return (
    <div className="space-y-10">
      {endpointStrip}

      {feedbackMessage && (
        <p role="status" className={`text-sm font-medium ${getFeedbackTone(feedbackError)}`}>
          {feedbackMessage}
        </p>
      )}

      {body}
    </div>
  );
}
