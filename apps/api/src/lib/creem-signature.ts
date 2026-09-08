import { createHmac, timingSafeEqual } from 'node:crypto';

function timingSafeHexEqual(expectedHex: string, actualHex: string): boolean {
  if (expectedHex.length !== actualHex.length) return false;
  return timingSafeEqual(Buffer.from(expectedHex, 'hex'), Buffer.from(actualHex, 'hex'));
}

/**
 * Legacy Creem webhook signature: HMAC-SHA256(secret, utf8 raw body) as hex.
 * Header may include an optional `sha256=` prefix (case-insensitive).
 */
function verifyLegacyCreemSignature(
  payload: string,
  signature: string,
  secret: string
): boolean {
  let hexSignature = signature.trim();
  if (hexSignature.toLowerCase().startsWith('sha256=')) {
    hexSignature = hexSignature.slice('sha256='.length);
  }

  if (!/^[a-fA-F0-9]+$/.test(hexSignature) || hexSignature.length % 2 !== 0) {
    return false;
  }

  const digest = createHmac('sha256', secret).update(payload, 'utf8').digest('hex');
  return timingSafeHexEqual(hexSignature, digest);
}

/**
 * AuthHub timestamped signature: t=<timestamp>,v1=<hex> over `${timestamp}.${payload}`.
 */
function verifyTimestampedCreemSignature(
  payload: string,
  signature: string,
  secret: string
): boolean {
  let timestamp: string | null = null;
  let v1Signature: string | null = null;

  for (const part of signature.split(',')) {
    const [rawKey, ...rawValue] = part.trim().split('=');
    if (!rawKey || rawValue.length === 0) continue;

    const value = rawValue.join('=').trim();
    if (rawKey === 't') timestamp = value;
    if (rawKey === 'v1') v1Signature = value;
  }

  if (!timestamp || !v1Signature) return false;
  if (!/^[a-fA-F0-9]+$/.test(v1Signature) || v1Signature.length % 2 !== 0) return false;

  const signedPayload = `${timestamp}.${payload}`;
  const digest = createHmac('sha256', secret).update(signedPayload).digest('hex');

  return timingSafeHexEqual(v1Signature, digest);
}

/**
 * Verify a Creem webhook signature.
 *
 * Accepts, in order:
 * 1. Legacy Creem HMAC-SHA256 hex digest (optional `sha256=` prefix)
 * 2. AuthHub timestamped `t=...,v1=...` format
 */
export function verifyCreemWebhookSignature(
  payload: string,
  signature: string,
  secret: string
): boolean {
  if (!signature || !secret) return false;

  try {
    if (verifyLegacyCreemSignature(payload, signature, secret)) {
      return true;
    }

    if (verifyTimestampedCreemSignature(payload, signature, secret)) {
      return true;
    }

    return false;
  } catch {
    return false;
  }
}
