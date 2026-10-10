/**
 * Single Shared v1 Zod Schema Module.
 *
 * The canonical request/response validation shapes for the whole v1
 * surface. Route handlers import these for validation; the OpenAPI
 * generator in `apps/api/openapi/` imports the same module for the spec.
 * One module, two consumers — a field added in only one place fails the
 * contract tests.
 *
 * Every write schema is strict: unknown fields fail instead of dropping
 * silently.
 */

import { z } from 'zod';
import { V1_WEBHOOK_SUBSCRIBABLE_EVENTS } from '@agency-platform/shared';
import { DEFAULT_LIST_LIMIT, MAX_LIST_LIMIT } from '@/lib/list-pagination.js';

export const v1LimitSchema = z.coerce
  .number()
  .int()
  .min(1)
  .max(MAX_LIST_LIMIT)
  .default(DEFAULT_LIST_LIMIT);

export const v1ClientListQuerySchema = z
  .object({
    limit: v1LimitSchema,
    cursor: z.string().optional(),
    email: z.string().email().optional(),
  })
  .strict();

export const v1RequestListQuerySchema = z
  .object({
    limit: v1LimitSchema,
    cursor: z.string().optional(),
    status: z.enum(['pending', 'partial', 'completed', 'expired', 'revoked']).optional(),
  })
  .strict();

// Strict v1 write schemas. externalReference never appears: it stays
// internal-only while externalClientId is the public join key.
export const v1ClientCreateSchema = z
  .object({
    name: z.string().min(1),
    company: z.string().min(1),
    email: z.string().email(),
    website: z.string().url().optional(),
    language: z.string().min(2).max(10).optional(),
    externalClientId: z.string().min(1).max(128).optional(),
  })
  .strict();

export const v1RequestCreateSchema = z
  .object({
    clientId: z.string().min(1).optional(),
    clientExternalId: z.string().min(1).max(128).optional(),
    clientName: z.string().min(1),
    clientEmail: z.string().email(),
    platforms: z
      .array(
        z
          .object({
            platform: z.string().min(1),
            accessLevel: z.enum(['manage', 'view_only']),
          })
          .strict(),
      )
      .min(1),
  })
  .strict();

export const v1ExternalRequestsQuerySchema = z
  .object({
    limit: v1LimitSchema,
    cursor: z.string().optional(),
  })
  .strict();

export const V1_WEBHOOK_IDEMPOTENCY_ENDPOINT = 'POST /api/v1/webhook-endpoints';

export const V1_WEBHOOK_EVENT_DESCRIPTIONS: Record<string, string> = {
  'webhook.test': 'Connectivity probe sent on demand to verify an endpoint.',
  'access_request.partial': 'A request crossed into partial authorization (some services granted).',
  'access_request.completed': 'A request reached full authorization (all services granted).',
  'access_request.revoked': 'A request was revoked after authorization.',
  'access_request.expired': 'A request expired before completion.',
  'connection.status_changed': 'A platform connection changed health status.',
};

export const v1WebhookEventEnum = z.enum(
  V1_WEBHOOK_SUBSCRIBABLE_EVENTS as unknown as [string, ...string[]],
);

export const v1WebhookEndpointCreateSchema = z
  .object({
    url: z.string().url().max(2048),
    subscribedEvents: z.array(v1WebhookEventEnum).min(1).max(6),
    preferredApiVersion: z.enum(['2026-03-08', '2026-03-19']).optional(),
  })
  .strict();

export const v1WebhookEndpointUpdateSchema = v1WebhookEndpointCreateSchema.extend({
  /** Explicit opt-in: only { reactivate: true } clears a disabled status. */
  reactivate: z.boolean().optional(),
}).strict();

export const v1WebhookRotateSchema = z
  .object({
    /** False (default): 24h dual-active overlap. True: replace at once. */
    immediate: z.boolean().optional().default(false),
  })
  .strict();

export const v1WebhookDeliveriesQuerySchema = z
  .object({
    limit: v1LimitSchema,
    cursor: z.string().optional(),
  })
  .strict();
