import { describe, expect, it } from 'vitest';

import {
  isPosthogProjectKey,
  stripPhcTokenProperty,
} from '../strip-phc-token';

describe('stripPhcTokenProperty', () => {
  it('removes token when value is a PostHog project key', () => {
    expect(
      stripPhcTokenProperty({
        access_request_token: 'access-token-abc',
        token: 'phc_BF0Psecret',
      })
    ).toEqual({
      access_request_token: 'access-token-abc',
    });
  });

  it('keeps non-phc token values', () => {
    expect(
      stripPhcTokenProperty({
        token: 'access-token-abc',
        platform: 'meta',
      })
    ).toEqual({
      token: 'access-token-abc',
      platform: 'meta',
    });
  });

  it('returns the same object when token is absent', () => {
    const properties = { access_request_token: 'access-token-abc' };
    expect(stripPhcTokenProperty(properties)).toBe(properties);
  });
});

describe('isPosthogProjectKey', () => {
  it('detects phc_ project keys', () => {
    expect(isPosthogProjectKey('phc_BF0Pabc')).toBe(true);
    expect(isPosthogProjectKey('access-token')).toBe(false);
    expect(isPosthogProjectKey(undefined)).toBe(false);
  });
});
