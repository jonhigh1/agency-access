/**
 * v1 Stable Error-Code Registry (U7, R17).
 *
 * Every code a v1 caller can observe lives here with its HTTP status and
 * the public message template. Internal reasons (which pepper failed, why
 * a tier lookup errored, which hash mismatched) never leave this mapping:
 * handlers translate internals to these codes without leaking detail.
 *
 * Contract rule enforced by `v1.contract.test.ts`: any `error.code`
 * observed on a v1 response must be a member of `V1_ERROR_CODES`.
 * Adding a code is a contract change — register it here first.
 */

export interface V1ErrorEntry {
  status: number;
  message: string;
}

export const V1_ERROR_REGISTRY = {
  INVALID_API_KEY: { status: 401, message: 'Invalid or missing API key' },
  MISSING_SCOPE: { status: 403, message: 'Missing required scope' },
  TIER_ACCESS_DENIED: { status: 403, message: 'API access requires a paid plan or active trial.' },
  TIER_CHECK_UNAVAILABLE: { status: 503, message: 'Unable to verify API access for this plan. Please try again later.' },
  RATE_LIMIT_EXCEEDED: { status: 429, message: 'Rate limit exceeded. Please try again later.' },
  VALIDATION_ERROR: { status: 400, message: 'Request validation failed' },
  NOT_FOUND: { status: 404, message: 'Resource not found' },
  CLIENT_NOT_FOUND: { status: 404, message: 'Client not found.' },
  CLIENT_EMAIL_EXISTS: { status: 409, message: 'A client with this email already exists.' },
  EXTERNAL_ID_CONFLICT: { status: 409, message: 'This external client ID is already in use.' },
  IDEMPOTENCY_KEY_REQUIRED: { status: 400, message: 'The Idempotency-Key header is required.' },
  IDEMPOTENCY_CONFLICT: { status: 409, message: 'Idempotency key is already in use with a different request.' },
  IDEMPOTENCY_IN_PROGRESS: { status: 409, message: 'The first request with this idempotency key is still running.' },
  IDEMPOTENCY_KEY_EXPIRED: { status: 410, message: 'Idempotency key has expired; retry with a fresh key.' },
  WEBHOOK_ENDPOINT_CAP_EXCEEDED: { status: 409, message: 'Webhook endpoint cap exceeded' },
  WEBHOOK_ENDPOINT_URL_EXISTS: { status: 409, message: 'A webhook endpoint with this URL already exists' },
  UNSAFE_ENDPOINT_URL: { status: 400, message: 'Endpoint URL is not allowed' },
  INTERNAL_ERROR: { status: 500, message: 'An unexpected error occurred' },
} as const satisfies Record<string, V1ErrorEntry>;

export type V1ErrorCode = keyof typeof V1_ERROR_REGISTRY;

export const V1_ERROR_CODES = Object.keys(V1_ERROR_REGISTRY) as V1ErrorCode[];

/** Missing-or-empty idempotency header on v1 creates. */
export const IDEMPOTENCY_KEY_REQUIRED = 'IDEMPOTENCY_KEY_REQUIRED' as const;

export function isRegisteredV1Code(code: string): code is V1ErrorCode {
  return Object.hasOwn(V1_ERROR_REGISTRY, code);
}
