import { describe, expect, it } from 'vitest';
import { omitSensitiveTokenProperties } from '../omit-sensitive-token-properties';

describe('omitSensitiveTokenProperties', () => {
  it('removes caller and invite bearer values but keeps event context', () => {
    expect(omitSensitiveTokenProperties({
      access_request_token: 'invite-secret',
      token: 'provider-secret',
      access_request_id: 'request-1',
    })).toEqual({ access_request_id: 'request-1' });
  });

  it('returns the same object when no bearer values exist', () => {
    const properties = { access_request_id: 'request-1' };
    expect(omitSensitiveTokenProperties(properties)).toBe(properties);
  });
});
