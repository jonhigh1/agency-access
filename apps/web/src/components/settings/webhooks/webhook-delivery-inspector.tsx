import type { WebhookDeliverySummary } from '@agency-platform/shared';
import { ChevronRight, Clock3 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { WebhookDeliveryStatusPill } from './webhook-delivery-status-pill';

interface WebhookDeliveryInspectorProps {
  deliveries: WebhookDeliverySummary[];
  selectedDeliveryId: string | null;
  onInspect: (deliveryId: string) => void;
}

const EVENT_LABELS: Record<WebhookDeliverySummary['eventType'], string> = {
  'webhook.test': 'Test event',
  'access_request.partial': 'Access request partially completed',
  'access_request.completed': 'Access request completed',
  'access_request.revoked': 'Access request revoked',
  'access_request.expired': 'Access request expired',
  'connection.status_changed': 'Connection status changed',
};

function formatDateTime(value: string | null | undefined): string {
  if (!value) {
    return 'Not available';
  }

  return new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

export function WebhookDeliveryInspector({
  deliveries,
  selectedDeliveryId,
  onInspect,
}: WebhookDeliveryInspectorProps) {
  if (deliveries.length === 0) {
    return (
      <div className="py-5 text-sm text-muted-foreground">
        Delivery history appears here after your first test send or lifecycle event.
      </div>
    );
  }

  const selectedDelivery =
    deliveries.find((delivery) => delivery.id === selectedDeliveryId) ?? deliveries[0];

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
      <ul className="min-w-0">
        {deliveries.map((delivery) => {
          const isSelected = delivery.id === selectedDelivery.id;

          return (
            <li
              key={delivery.id}
              aria-current={isSelected ? 'true' : undefined}
              className={`hairline-b px-3 py-4 transition-colors duration-150 last:border-b-0 ${
                isSelected ? 'bg-coral/10' : ''
              }`}
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0 space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <code className="bg-ink px-2 py-1 text-xs font-semibold text-paper">
                      {EVENT_LABELS[delivery.eventType]}
                    </code>
                    <WebhookDeliveryStatusPill status={delivery.status} />
                  </div>
                  <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                    <span className="inline-flex items-center gap-1">
                      <Clock3 className="h-3.5 w-3.5" />
                      Attempt {delivery.attemptNumber}
                    </span>
                    <span>Created {formatDateTime(delivery.createdAt)}</span>
                  </div>
                </div>

                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => onInspect(delivery.id)}
                  rightIcon={<ChevronRight className="h-4 w-4" />}
                >
                  Inspect
                </Button>
              </div>
            </li>
          );
        })}
      </ul>

      <aside className="min-w-0 border border-border bg-card p-5">
        <p className="text-sm font-semibold text-ink">Delivery inspector</p>

        <dl className="mt-4 space-y-4 text-sm">
          <div>
            <dt className="label-nano">Event type</dt>
            <dd className="mt-1 text-ink">{EVENT_LABELS[selectedDelivery.eventType]}</dd>
          </div>
          <div>
            <dt className="label-nano">Response</dt>
            <dd className="mt-1 text-ink">
              {selectedDelivery.responseStatus ? `HTTP ${selectedDelivery.responseStatus}` : 'No response recorded'}
            </dd>
          </div>
          <div>
            <dt className="label-nano">Delivered at</dt>
            <dd className="mt-1 text-ink">{formatDateTime(selectedDelivery.deliveredAt)}</dd>
          </div>
          <div>
            <dt className="label-nano">Error</dt>
            <dd className="mt-1 break-words text-ink">{selectedDelivery.errorMessage || 'None'}</dd>
          </div>
          <div>
            <dt className="label-nano">Payload preview</dt>
            <dd className="mt-1 whitespace-pre-wrap break-all border border-border bg-paper p-3 font-mono text-xs text-muted-foreground">
              {selectedDelivery.responseBodySnippet || 'Response body was not captured for this attempt.'}
            </dd>
          </div>
        </dl>
      </aside>
    </div>
  );
}
