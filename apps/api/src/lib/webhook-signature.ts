import { createHmac, timingSafeEqual } from 'node:crypto';
import {
  WEBHOOK_SECRET_ROTATION_OVERLAP_MS,
  WEBHOOK_SIGNATURE_SKEW_SECONDS,
} from '@agency-platform/shared';

export { WEBHOOK_SECRET_ROTATION_OVERLAP_MS, WEBHOOK_SIGNATURE_SKEW_SECONDS };

export function signWebhookPayload(
  payload: string,
  secret: string,
  timestamp: string
): string {
  const digest = createHmac('sha256', secret)
    .update(`${timestamp}.${payload}`)
    .digest('hex');

  return `v1=${digest}`;
}

export function verifyWebhookPayloadSignature(
  payload: string,
  signature: string,
  secret: string,
  timestamp: string
): boolean {
  if (!signature || !secret || !timestamp) {
    return false;
  }

  const [version, digest] = signature.split('=');
  if (version !== 'v1' || !digest || !/^[a-f0-9]{64}$/i.test(digest)) {
    return false;
  }

  const expected = signWebhookPayload(payload, secret, timestamp);
  const [, expectedDigest] = expected.split('=');

  if (!expectedDigest || expectedDigest.length !== digest.length) {
    return false;
  }

  return timingSafeEqual(
    Buffer.from(digest, 'hex'),
    Buffer.from(expectedDigest, 'hex')
  );
}

/**
 * Freshness check for the `X-AgencyAccess-Timestamp` header (unix seconds).
 * Skew beyond the window rejects (R14); non-numeric timestamps reject.
 */
export function verifyWebhookTimestamp(
  timestamp: string,
  nowSeconds: number = Math.floor(Date.now() / 1000),
  skewSeconds: number = WEBHOOK_SIGNATURE_SKEW_SECONDS
): boolean {
  const ts = Number(timestamp);
  if (!Number.isFinite(ts)) return false;
  return Math.abs(nowSeconds - ts) <= skewSeconds;
}

export interface WebhookRotationSecrets {
  /** Active (old) secret; always tried. */
  currentSecret: string;
  /** Overlap (new) secret; tried first while unexpired. */
  pendingSecret?: string | null;
  /** Overlap expiry; an expired pending secret never verifies. */
  pendingExpiresAt?: Date | string | null;
  now?: Date;
}

/**
 * Dual-secret verification for rotation overlap (KTD7, R14).
 * Order is new-then-old: the pending secret verifies first while its
 * overlap window holds, then the current secret. Returns which secret
 * matched so callers can distinguish overlap traffic from stale traffic.
 * Timestamps outside the skew window reject before any secret is tried.
 */
export function verifyWebhookSignatureWithRotation(
  payload: string,
  signature: string,
  timestamp: string,
  secrets: WebhookRotationSecrets
): { ok: boolean; matched: 'pending' | 'current' | null } {
  if (!verifyWebhookTimestamp(timestamp)) {
    return { ok: false, matched: null };
  }
  const now = secrets.now ?? new Date();
  const pending =
    typeof secrets.pendingSecret === 'string' && secrets.pendingSecret.length > 0
      ? secrets.pendingSecret
      : null;
  const pendingExpiresAt =
    secrets.pendingExpiresAt instanceof Date
      ? secrets.pendingExpiresAt
      : typeof secrets.pendingExpiresAt === 'string'
        ? new Date(secrets.pendingExpiresAt)
        : null;
  // Fail-closed: an unparseable expiry never verifies as pending.
  const pendingLive =
    pending != null &&
    pendingExpiresAt != null &&
    !Number.isNaN(pendingExpiresAt.getTime()) &&
    pendingExpiresAt.getTime() > now.getTime();

  if (pendingLive && verifyWebhookPayloadSignature(payload, signature, pending, timestamp)) {
    return { ok: true, matched: 'pending' };
  }
  if (verifyWebhookPayloadSignature(payload, signature, secrets.currentSecret, timestamp)) {
    return { ok: true, matched: 'current' };
  }
  return { ok: false, matched: null };
}
