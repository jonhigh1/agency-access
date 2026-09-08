import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { verifyCreemWebhookSignature } from '@/lib/creem-signature';

function createTimestampedSignature(
  payload: string,
  secret: string,
  timestamp = '1234567890'
): string {
  const signedPayload = `${timestamp}.${payload}`;
  const digest = createHmac('sha256', secret).update(signedPayload).digest('hex');
  return `t=${timestamp},v1=${digest}`;
}

function createLegacySignature(payload: string, secret: string): string {
  return createHmac('sha256', secret).update(payload, 'utf8').digest('hex');
}

describe('verifyCreemWebhookSignature', () => {
  const payload = JSON.stringify({ id: 'evt_123', type: 'subscription.created' });
  const secret = 'whsec_test_secret';

  describe('legacy Creem HMAC hex digest', () => {
    it('returns true for a valid legacy hex signature', () => {
      const signature = createLegacySignature(payload, secret);

      expect(verifyCreemWebhookSignature(payload, signature, secret)).toBe(true);
    });

    it('returns true for sha256= prefixed legacy signature', () => {
      const signature = `sha256=${createLegacySignature(payload, secret)}`;

      expect(verifyCreemWebhookSignature(payload, signature, secret)).toBe(true);
    });

    it('returns false for wrong secret on legacy signature', () => {
      const signature = createLegacySignature(payload, secret);

      expect(verifyCreemWebhookSignature(payload, signature, 'wrong_secret')).toBe(false);
    });

    it('returns false for invalid legacy hex signature', () => {
      expect(verifyCreemWebhookSignature(payload, 'not-hex', secret)).toBe(false);
    });
  });

  describe('AuthHub timestamped t=,v1= format', () => {
    it('returns true for a valid timestamped signature', () => {
      const signature = createTimestampedSignature(payload, secret);

      expect(verifyCreemWebhookSignature(payload, signature, secret)).toBe(true);
    });

    it('returns false for wrong secret on timestamped signature', () => {
      const signature = createTimestampedSignature(payload, secret);

      expect(verifyCreemWebhookSignature(payload, signature, 'wrong_secret')).toBe(false);
    });

    it('returns false when timestamp is missing', () => {
      const signature = createTimestampedSignature(payload, secret);
      const withoutTimestamp = signature.replace(/t=\d+,?/, '');

      expect(verifyCreemWebhookSignature(payload, withoutTimestamp, secret)).toBe(false);
    });

    it('returns false when v1 signature is missing', () => {
      const signature = 't=1234567890';

      expect(verifyCreemWebhookSignature(payload, signature, secret)).toBe(false);
    });

    it('returns false for non-hex v1 signature', () => {
      const signature = 't=1234567890,v1=not-hex-signature';

      expect(verifyCreemWebhookSignature(payload, signature, secret)).toBe(false);
    });

    it('returns false for signature length mismatch', () => {
      const signature = 't=1234567890,v1=abcd';

      expect(verifyCreemWebhookSignature(payload, signature, secret)).toBe(false);
    });
  });

  it('returns false for empty signature', () => {
    expect(verifyCreemWebhookSignature(payload, '', secret)).toBe(false);
  });
});
