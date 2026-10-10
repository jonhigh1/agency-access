/**
 * v1 OpenAPI Document Generator (U7, KTD10, R20).
 *
 * The spec is generated from the single shared zod module
 * (`../routes/v1-schemas.ts`) — the same module route handlers import
 * for validation — plus the stable error registry (`../lib/v1-errors.ts`).
 * No hand-written field lists: a field or code missing here fails the
 * contract tests.
 *
 * No new toolchain dependency: the generator uses a minimal local
 * zod→JSON-Schema converter (`./zod-to-json-schema.ts`) covering exactly
 * the shapes v1 validation uses. If v1 schemas outgrow it, the converter
 * throws loudly instead of emitting a wrong spec.
 *
 * Regenerate the checked-in spec with:
 *   npx tsx src/openapi/build-v1-openapi.ts > ../openapi/v1.openapi.json
 * (run from `apps/api/`).
 */

import { z } from 'zod';
import { V1_ERROR_REGISTRY, type V1ErrorCode } from '@/lib/v1-errors.js';
import {
  V1_WEBHOOK_EVENT_DESCRIPTIONS,
  v1ClientCreateSchema,
  v1ClientListQuerySchema,
  v1ExternalRequestsQuerySchema,
  v1RequestCreateSchema,
  v1RequestListQuerySchema,
  v1WebhookDeliveriesQuerySchema,
  v1WebhookEndpointCreateSchema,
  v1WebhookEndpointUpdateSchema,
  v1WebhookRotateSchema,
} from '@/routes/v1-schemas.js';
import { zodToJsonSchema } from './zod-to-json-schema.js';

type JsonSchema = Record<string, unknown>;

export const V1_OPENAPI_VERSION = '1.0.0';

function errorSchema(codes: V1ErrorCode[]): JsonSchema {
  return {
    type: 'object',
    properties: {
      code: { type: 'string', enum: [...codes] },
      message: { type: 'string' },
    },
    required: ['code', 'message'],
    additionalProperties: false,
  };
}

function envelopeSchema(data: JsonSchema, extraMeta: JsonSchema = {}): JsonSchema {
  return {
    type: 'object',
    properties: {
      data,
      error: { type: 'null', nullable: true },
      meta: {
        type: 'object',
        properties: {
          requestId: { type: 'string', format: 'uuid' },
          ...extraMeta,
        },
        required: ['requestId'],
        additionalProperties: true,
      },
    },
    required: ['data', 'error', 'meta'],
    additionalProperties: false,
  };
}

function errorEnvelopeSchema(codes: V1ErrorCode[]): JsonSchema {
  return {
    type: 'object',
    properties: {
      data: { type: 'null', nullable: true },
      error: errorSchema(codes),
      meta: {
        type: 'object',
        properties: { requestId: { type: 'string', format: 'uuid' } },
        required: ['requestId'],
        additionalProperties: true,
      },
    },
    required: ['data', 'error', 'meta'],
    additionalProperties: false,
  };
}

function errorResponses(codes: V1ErrorCode[]): Record<string, JsonSchema> {
  const out: Record<string, JsonSchema> = {};
  for (const code of codes) {
    const status = String(V1_ERROR_REGISTRY[code].status);
    if (out[status]) continue;
    const statusCodes = Object.entries(V1_ERROR_REGISTRY)
      .filter(([, entry]) => String(entry.status) === status)
      .map(([c]) => c as V1ErrorCode);
    out[status] = {
      description: V1_ERROR_REGISTRY[code].message,
      content: { 'application/json': { schema: errorEnvelopeSchema(statusCodes) } },
    };
  }
  return out;
}

const GATE_ERRORS: V1ErrorCode[] = [
  'INVALID_API_KEY',
  'MISSING_SCOPE',
  'TIER_ACCESS_DENIED',
  'TIER_CHECK_UNAVAILABLE',
  'RATE_LIMIT_EXCEEDED',
];

const IDEMPOTENCY_HEADER = {
  name: 'Idempotency-Key',
  in: 'header',
  required: true,
  description:
    'Retry key for the create. Same key + same body replays the original result; same key + different body fails with IDEMPOTENCY_CONFLICT. Keys expire after 72h.',
  schema: { type: 'string', minLength: 1 },
};

function queryParameters(schema: z.ZodTypeAny): JsonSchema[] {
  const json = zodToJsonSchema(schema);
  const properties = (json.properties ?? {}) as Record<string, JsonSchema>;
  return Object.entries(properties).map(([name, paramSchema]) => ({
    name,
    in: 'query',
    required: ((json.required as string[] | undefined) ?? []).includes(name),
    schema: paramSchema,
  }));
}

interface RouteDef {
  path: string;
  method: 'get' | 'post' | 'patch' | 'delete';
  summary: string;
  scopes: string[];
  query?: z.ZodTypeAny;
  body?: z.ZodTypeAny;
  /** True when the route accepts an empty body (rotate defaults). */
  bodyOptional?: boolean;
  pathParams?: Record<string, JsonSchema>;
  idempotent?: boolean;
  successStatus: number;
  successData: JsonSchema;
  successMeta?: JsonSchema;
  errors: V1ErrorCode[];
}

const paginationMeta = {
  pagination: {
    type: 'object',
    properties: {
      nextCursor: { type: ['string', 'null'] },
      hasMore: { type: 'boolean' },
    },
    required: ['nextCursor', 'hasMore'],
  },
};

const ROUTES: RouteDef[] = [
  {
    path: '/self-check',
    method: 'get',
    summary: 'Return the calling key agency, scopes, tier, and limit hints. No scope required.',
    scopes: [],
    successStatus: 200,
    successData: {
      type: 'object',
      properties: {
        agency: { type: 'object' },
        keyPrefix: { type: 'string' },
        scopes: { type: 'array', items: { type: 'string' } },
        tier: { type: ['string', 'null'] },
        limits: { type: 'object' },
      },
      required: ['agency', 'keyPrefix', 'scopes', 'tier', 'limits'],
    },
    errors: ['INVALID_API_KEY', 'TIER_ACCESS_DENIED', 'TIER_CHECK_UNAVAILABLE', 'RATE_LIMIT_EXCEEDED'],
  },
  {
    path: '/catalog/accounts',
    method: 'get',
    summary: 'List the agency connected accounts in the form requests reference them.',
    scopes: ['catalog:read'],
    successStatus: 200,
    successData: { type: 'array', items: { type: 'object' } },
    errors: [...GATE_ERRORS],
  },
  {
    path: '/catalog/services',
    method: 'get',
    summary: 'List every requestable service with roles and grant requirements.',
    scopes: ['catalog:read'],
    successStatus: 200,
    successData: { type: 'array', items: { type: 'object' } },
    errors: [...GATE_ERRORS],
  },
  {
    path: '/clients',
    method: 'get',
    summary: 'List clients under an opaque keyset cursor with an optional exact email filter.',
    scopes: ['clients:read'],
    query: v1ClientListQuerySchema,
    successStatus: 200,
    successData: { type: 'array', items: { type: 'object' } },
    successMeta: paginationMeta,
    errors: [...GATE_ERRORS, 'VALIDATION_ERROR'],
  },
  {
    path: '/requests',
    method: 'get',
    summary: 'List requests under an opaque keyset cursor with an optional exact status filter.',
    scopes: ['requests:read'],
    query: v1RequestListQuerySchema,
    successStatus: 200,
    successData: { type: 'array', items: { type: 'object' } },
    successMeta: paginationMeta,
    errors: [...GATE_ERRORS, 'VALIDATION_ERROR'],
  },
  {
    path: '/usage',
    method: 'get',
    summary: 'Report the current plan and this period consumption against limits.',
    scopes: ['usage:read'],
    successStatus: 200,
    successData: {
      type: 'object',
      properties: {
        plan: { type: ['string', 'null'] },
        metrics: { type: 'object' },
        resetAt: { type: ['string', 'null'] },
      },
      required: ['plan', 'metrics', 'resetAt'],
    },
    errors: [...GATE_ERRORS, 'INTERNAL_ERROR'],
  },
  {
    path: '/clients',
    method: 'post',
    summary: 'Create a client retry-safely with an optional immutable external ID.',
    scopes: ['clients:write'],
    body: v1ClientCreateSchema,
    idempotent: true,
    successStatus: 201,
    successData: { type: 'object' },
    successMeta: { replayed: { type: 'boolean' } },
    errors: [
      ...GATE_ERRORS,
      'VALIDATION_ERROR',
      'IDEMPOTENCY_KEY_REQUIRED',
      'IDEMPOTENCY_CONFLICT',
      'IDEMPOTENCY_IN_PROGRESS',
      'IDEMPOTENCY_KEY_EXPIRED',
      'IDEMPOTENCY_LIMIT_EXCEEDED',
      'CLIENT_EMAIL_EXISTS',
      'EXTERNAL_ID_CONFLICT',
    ],
  },
  {
    path: '/requests',
    method: 'post',
    summary: 'Create an access request retry-safely, linked by client id or external ID.',
    scopes: ['requests:write'],
    body: v1RequestCreateSchema,
    idempotent: true,
    successStatus: 201,
    successData: { type: 'object' },
    successMeta: { replayed: { type: 'boolean' } },
    errors: [
      ...GATE_ERRORS,
      'VALIDATION_ERROR',
      'IDEMPOTENCY_KEY_REQUIRED',
      'IDEMPOTENCY_CONFLICT',
      'IDEMPOTENCY_IN_PROGRESS',
      'IDEMPOTENCY_KEY_EXPIRED',
      'IDEMPOTENCY_LIMIT_EXCEEDED',
      'CLIENT_NOT_FOUND',
    ],
  },
  {
    path: '/clients/external/{externalClientId}/requests',
    method: 'get',
    summary: 'List exactly one external-ID client requests under an opaque cursor.',
    scopes: ['requests:read'],
    query: v1ExternalRequestsQuerySchema,
    pathParams: { externalClientId: { type: 'string' } },
    successStatus: 200,
    successData: { type: 'array', items: { type: 'object' } },
    successMeta: paginationMeta,
    errors: [...GATE_ERRORS, 'VALIDATION_ERROR', 'CLIENT_NOT_FOUND'],
  },
  {
    path: '/clients/external/{externalClientId}',
    method: 'get',
    summary: 'Resolve one client row directly by its immutable external ID.',
    scopes: ['clients:read'],
    pathParams: { externalClientId: { type: 'string' } },
    successStatus: 200,
    successData: { type: 'object' },
    errors: [...GATE_ERRORS, 'CLIENT_NOT_FOUND'],
  },
  {
    path: '/webhook-event-types',
    method: 'get',
    summary: 'List the subscribable webhook event taxonomy with descriptions.',
    scopes: ['webhooks:read'],
    successStatus: 200,
    successData: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          type: { type: 'string', enum: Object.keys(V1_WEBHOOK_EVENT_DESCRIPTIONS) },
          description: { type: 'string' },
        },
        required: ['type', 'description'],
      },
    },
    errors: [...GATE_ERRORS],
  },
  {
    path: '/webhook-endpoints',
    method: 'get',
    summary: 'List all webhook endpoints for the key agency.',
    scopes: ['webhooks:read'],
    successStatus: 200,
    successData: { type: 'array', items: { type: 'object' } },
    errors: [...GATE_ERRORS, 'INTERNAL_ERROR'],
  },
  {
    path: '/webhook-endpoints',
    method: 'post',
    summary: 'Create a webhook endpoint retry-safely. The signing secret is shown once.',
    scopes: ['webhooks:write'],
    body: v1WebhookEndpointCreateSchema,
    idempotent: true,
    successStatus: 201,
    successData: {
      type: 'object',
      properties: {
        endpoint: { type: 'object' },
        signingSecret: { type: 'string', description: 'Shown once at creation. Store it immediately.' },
      },
      required: ['endpoint', 'signingSecret'],
    },
    errors: [
      ...GATE_ERRORS,
      'VALIDATION_ERROR',
      'IDEMPOTENCY_KEY_REQUIRED',
      'IDEMPOTENCY_CONFLICT',
      'IDEMPOTENCY_IN_PROGRESS',
      'IDEMPOTENCY_KEY_EXPIRED',
      'IDEMPOTENCY_LIMIT_EXCEEDED',
      'UNSAFE_ENDPOINT_URL',
      'WEBHOOK_ENDPOINT_CAP_EXCEEDED',
      'WEBHOOK_ENDPOINT_URL_EXISTS',
      'INTERNAL_ERROR',
    ],
  },
  {
    path: '/webhook-endpoints/{id}',
    method: 'get',
    summary: 'Fetch one webhook endpoint by id.',
    scopes: ['webhooks:read'],
    pathParams: { id: { type: 'string' } },
    successStatus: 200,
    successData: { type: 'object' },
    errors: [...GATE_ERRORS, 'NOT_FOUND', 'INTERNAL_ERROR'],
  },
  {
    path: '/webhook-endpoints/{id}',
    method: 'patch',
    summary: 'Update a webhook endpoint URL and subscriptions. Disabled status is sticky; only {"reactivate": true} clears it.',
    scopes: ['webhooks:write'],
    body: v1WebhookEndpointUpdateSchema,
    pathParams: { id: { type: 'string' } },
    successStatus: 200,
    successData: { type: 'object' },
    errors: [...GATE_ERRORS, 'VALIDATION_ERROR', 'NOT_FOUND', 'UNSAFE_ENDPOINT_URL', 'WEBHOOK_ENDPOINT_URL_EXISTS', 'INTERNAL_ERROR'],
  },
  {
    path: '/webhook-endpoints/{id}',
    method: 'delete',
    summary: 'Delete a webhook endpoint and its secret material.',
    scopes: ['webhooks:write'],
    pathParams: { id: { type: 'string' } },
    successStatus: 200,
    successData: { type: 'object' },
    errors: [...GATE_ERRORS, 'NOT_FOUND', 'INTERNAL_ERROR'],
  },
  {
    path: '/webhook-endpoints/{id}/rotate',
    method: 'post',
    summary: 'Rotate an endpoint signing secret with 24h dual-active overlap, or immediately.',
    scopes: ['webhooks:write'],
    body: v1WebhookRotateSchema,
    bodyOptional: true,
    pathParams: { id: { type: 'string' } },
    successStatus: 200,
    successData: {
      type: 'object',
      properties: {
        endpoint: { type: 'object' },
        signingSecret: { type: 'string', description: 'Shown once at rotation. Store it immediately.' },
      },
      required: ['endpoint', 'signingSecret'],
    },
    errors: [...GATE_ERRORS, 'VALIDATION_ERROR', 'NOT_FOUND', 'INTERNAL_ERROR'],
  },
  {
    path: '/webhook-endpoints/{id}/deliveries',
    method: 'get',
    summary: 'List delivery attempts for one endpoint under an opaque cursor.',
    scopes: ['webhooks:read'],
    query: v1WebhookDeliveriesQuerySchema,
    pathParams: { id: { type: 'string' } },
    successStatus: 200,
    successData: { type: 'array', items: { type: 'object' } },
    successMeta: paginationMeta,
    errors: [...GATE_ERRORS, 'VALIDATION_ERROR', 'NOT_FOUND', 'INTERNAL_ERROR'],
  },
];

export function routeTableForTests(): Array<{ path: string; method: string; errors: V1ErrorCode[] }> {
  return ROUTES.map((r) => ({ path: r.path, method: r.method, errors: [...new Set(r.errors)] }));
}

export function buildV1OpenApi(): Record<string, unknown> {
  const paths: Record<string, Record<string, unknown>> = {};
  for (const route of ROUTES) {
    const parameters: unknown[] = [];
    if (route.pathParams) {
      for (const [name, schema] of Object.entries(route.pathParams)) {
        parameters.push({ name, in: 'path', required: true, schema });
      }
    }
    if (route.query) parameters.push(...queryParameters(route.query));
    if (route.idempotent) parameters.push(IDEMPOTENCY_HEADER);
    const operation: Record<string, unknown> = {
      summary: route.summary,
      security: [{ ApiKeyAuth: route.scopes }],
      ...(parameters.length > 0 ? { parameters } : {}),
      ...(route.body
        ? {
            requestBody: {
              required: route.bodyOptional !== true,
              content: { 'application/json': { schema: zodToJsonSchema(route.body) } },
            },
          }
        : {}),
      responses: {
        [String(route.successStatus)]: {
          description: 'Success',
          headers: {
            'X-RateLimit-Limit': { schema: { type: 'integer' } },
            'X-RateLimit-Remaining': { schema: { type: 'integer' } },
          },
          content: {
            'application/json': {
              schema: envelopeSchema(route.successData, route.successMeta ?? {}),
            },
          },
        },
        ...errorResponses([...new Set(route.errors)]),
      },
    };
    paths[route.path] = { ...(paths[route.path] ?? {}), [route.method]: operation };
  }

  return {
    openapi: '3.0.3',
    info: {
      title: 'AuthHub Public API',
      version: V1_OPENAPI_VERSION,
      description:
        'Versioned public contract for agency developers. Additive-only change within a version; breaking change ships as a new version.',
    },
    servers: [{ url: 'https://api.authhub.example/api/v1' }],
    security: [{ ApiKeyAuth: [] }],
    components: {
      securitySchemes: {
        ApiKeyAuth: {
          type: 'http',
          scheme: 'bearer',
          description:
            'Scoped agency API key as `Bearer <secret>`. The required scope is listed per operation; failures name the missing scope.',
        },
      },
    },
    paths,
  };
}
