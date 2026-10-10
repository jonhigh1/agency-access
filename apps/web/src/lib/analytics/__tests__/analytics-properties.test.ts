import { describe, expect, it } from 'vitest';
import { sanitizeAnalyticsProperties } from '@agency-platform/shared';

describe('analytics property boundary', () => {
  it('strips nested secrets and PII on every event without removing join keys', () => {
    expect(sanitizeAnalyticsProperties({
      agency_id: 'agency-1', access_request_id: 'request-1', token: 'bearer',
      nested: { client_email: 'private@example.com', refresh_token: 'private', count: 2 },
      assets: [{ asset_name: 'Private client', asset_id: 'native-id', kind: 'page' }],
    })).toEqual({ agency_id: 'agency-1', access_request_id: 'request-1', nested: { count: 2 }, assets: [{ kind: 'page' }] });
  });

  it('removes callback secrets outside the invite tree and fragments from SDK metadata', () => {
    expect(sanitizeAnalyticsProperties({
      $current_url: 'https://authhub.co/platforms/callback?code=private&state=secret#token',
      $set: { $initial_referrer: 'https://example.com/?email=private@example.com' },
      $pathname: '/invite/link-secret',
    })).toEqual({ $current_url: 'https://authhub.co/platforms/callback', $set: { $initial_referrer: 'https://example.com/' }, $pathname: '/invite/[removed]' });
  });

  it('preserves only the SDK root ingestion token when explicitly requested', () => {
    expect(sanitizeAnalyticsProperties({ token: 'phc_key', nested: { token: 'bearer' } }, true))
      .toEqual({ token: 'phc_key', nested: {} });
  });

  it('omits cycles and deep branches rather than returning unsanitized values', () => {
    const input: Record<string, unknown> = { count: 1 }; input.self = input;
    expect(sanitizeAnalyticsProperties(input)).toEqual({ count: 1 });
    let nested: Record<string, unknown> = { access_token: 'private' };
    for (let i = 0; i < 12; i++) nested = { nested };
    expect(JSON.stringify(sanitizeAnalyticsProperties(nested))).not.toContain('private');
  });
});
