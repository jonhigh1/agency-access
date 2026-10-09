import { z } from 'zod';
import { prisma } from '@/lib/prisma.js';
import { auditService } from '@/services/audit.service.js';
import { webhookEventService } from '@/services/webhook-event.service.js';
import type { ServiceError, ServiceResult } from '@/lib/service-result.js';

const SendWebhookTestEventSchema = z.object({
  agencyId: z.string().min(1),
  requestedBy: z.string().email(),
});

const ListWebhookDeliveriesSchema = z.object({
  agencyId: z.string().min(1),
  limit: z.number().int().min(1).max(100).default(20),
});

const ListWebhookEndpointsForSupportSchema = z.object({
  limit: z.number().int().min(1).max(100).default(50),
  search: z.string().trim().min(1).max(200).optional(),
  status: z.enum(['active', 'disabled']).optional(),
});

function toEndpointSummary(endpoint: any) {
  if (!endpoint) {
    return null;
  }

  return {
    id: endpoint.id,
    agencyId: endpoint.agencyId,
    url: endpoint.url,
    status: endpoint.status,
    subscribedEvents: Array.isArray(endpoint.subscribedEvents)
      ? endpoint.subscribedEvents
      : [],
    failureCount: endpoint.failureCount ?? 0,
    secretLastFour:
      typeof endpoint.secretId === 'string' ? endpoint.secretId.slice(-4) : null,
    lastDeliveredAt: endpoint.lastDeliveredAt?.toISOString() ?? null,
    lastFailedAt: endpoint.lastFailedAt?.toISOString() ?? null,
    createdAt: endpoint.createdAt?.toISOString?.() ?? endpoint.createdAt ?? null,
    updatedAt: endpoint.updatedAt?.toISOString?.() ?? endpoint.updatedAt ?? null,
  };
}

function toDeliverySummary(delivery: any) {
  return {
    id: delivery.id,
    eventId: delivery.eventId,
    eventType: delivery.event?.type ?? null,
    status: delivery.status,
    attemptNumber: delivery.attemptNumber,
    responseStatus: delivery.responseStatus ?? null,
    responseBodySnippet: delivery.responseBodySnippet ?? null,
    errorMessage: delivery.errorMessage ?? null,
    createdAt: delivery.createdAt.toISOString(),
    deliveredAt: delivery.deliveredAt?.toISOString() ?? null,
    nextAttemptAt: delivery.nextAttemptAt?.toISOString() ?? null,
  };
}

export async function sendWebhookTestEvent(
  input: z.infer<typeof SendWebhookTestEventSchema>
): Promise<ServiceResult<{ eventId: string; queued: true }>> {
  try {
    const validated = SendWebhookTestEventSchema.parse(input);
    const endpoint = await prisma.webhookEndpoint.findFirst({
      where: { agencyId: validated.agencyId },
      orderBy: { createdAt: 'asc' },
    });

    if (!endpoint) {
      return {
        data: null,
        error: {
          code: 'NOT_FOUND',
          message: 'Webhook endpoint not found',
        },
      };
    }

    if (endpoint.status !== 'active') {
      return {
        data: null,
        error: {
          code: 'ENDPOINT_DISABLED',
          message: 'Webhook endpoint is disabled',
        },
      };
    }

    const payload = webhookEventService.buildWebhookTestEvent();
    const eventRecord = await prisma.webhookEvent.create({
      data: {
        agencyId: validated.agencyId,
        endpointId: endpoint.id,
        type: payload.type,
        resourceType: 'webhook_endpoint',
        resourceId: endpoint.id,
        payload: payload as any,
      },
    });

    const { queueWebhookDelivery } = await import('@/lib/queue-helpers');
    await queueWebhookDelivery(eventRecord.id);

    await auditService.createAuditLog({
      agencyId: validated.agencyId,
      userEmail: validated.requestedBy,
      action: 'WEBHOOK_TEST_SENT',
      resourceType: 'webhook_endpoint',
      resourceId: endpoint.id,
      metadata: {
        eventId: eventRecord.id,
      },
    });

    return {
      data: {
        eventId: eventRecord.id,
        queued: true,
      },
      error: null,
    };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        data: null,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid webhook test request',
          details: error.errors,
        },
      };
    }

    return {
      data: null,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to queue test webhook event',
      },
    };
  }
}

export async function listWebhookDeliveries(
  input: z.infer<typeof ListWebhookDeliveriesSchema>
): Promise<ServiceResult<{ endpoint: ReturnType<typeof toEndpointSummary>; deliveries: ReturnType<typeof toDeliverySummary>[] }>> {
  try {
    const validated = ListWebhookDeliveriesSchema.parse(input);
    const endpoint = await prisma.webhookEndpoint.findFirst({
      where: { agencyId: validated.agencyId },
      orderBy: { createdAt: 'asc' },
    });

    if (!endpoint) {
      return {
        data: {
          endpoint: null,
          deliveries: [],
        },
        error: null,
      };
    }

    const deliveries = await prisma.webhookDelivery.findMany({
      where: { endpointId: endpoint.id },
      include: {
        event: {
          select: {
            type: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: validated.limit,
    });

    return {
      data: {
        endpoint: toEndpointSummary(endpoint),
        deliveries: deliveries.map(toDeliverySummary),
      },
      error: null,
    };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        data: null,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid delivery query',
          details: error.errors,
        },
      };
    }

    return {
      data: null,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to list webhook deliveries',
      },
    };
  }
}

export async function getWebhookSupportDetails(
  agencyId: string,
  limit = 20
): Promise<ServiceResult<{ endpoint: ReturnType<typeof toEndpointSummary>; deliveries: ReturnType<typeof toDeliverySummary>[] }>> {
  return listWebhookDeliveries({ agencyId, limit });
}

export async function listWebhookEndpointsForSupport(
  input: z.infer<typeof ListWebhookEndpointsForSupportSchema> = { limit: 50 }
): Promise<ServiceResult<Array<ReturnType<typeof toEndpointSummary> & {
  agency: { id: string; name: string; email: string };
}>>> {
  try {
    const validated = ListWebhookEndpointsForSupportSchema.parse(input);
    const where = {
      ...(validated.status ? { status: validated.status } : {}),
      ...(validated.search
        ? {
            agency: {
              OR: [
                {
                  name: {
                    contains: validated.search,
                    mode: 'insensitive' as const,
                  },
                },
                {
                  email: {
                    contains: validated.search,
                    mode: 'insensitive' as const,
                  },
                },
              ],
            },
          }
        : {}),
    };
    const endpoints = await prisma.webhookEndpoint.findMany({
      where,
      include: {
        agency: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: { updatedAt: 'desc' },
      take: validated.limit,
    });

    return {
      data: endpoints.map((endpoint) => ({
        ...(toEndpointSummary(endpoint) as NonNullable<ReturnType<typeof toEndpointSummary>>),
        agency: endpoint.agency,
      })),
      error: null,
    };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        data: null,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid support query',
          details: error.errors,
        },
      };
    }

    return {
      data: null,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to list webhook endpoints',
      },
    };
  }
}

export const webhookManagementService = {
  sendWebhookTestEvent,
  listWebhookDeliveries,
  getWebhookSupportDetails,
  listWebhookEndpointsForSupport,
};
