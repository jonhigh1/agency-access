import { describe, expect, it } from 'vitest';

import { omitCustomTokenProperty } from '../omit-custom-token-property';

describe('omitCustomTokenProperty', () => {
  it('removes caller-provided token so helpers never set a custom token prop', () => {
    expect(
      omitCustomTokenProperty({
        access_request_token: 'unique-access-token',
        token: 'phc_BF0Psecret',
      })
    ).toEqual({
      access_request_token: 'unique-access-token',
    });
  });

  it('removes non-phc token values too', () => {
    expect(
      omitCustomTokenProperty({
        access_request_token: 'unique-access-token',
        token: 'legacy-access-token',
      })
    ).toEqual({
      access_request_token: 'unique-access-token',
    });
  });

  it('returns the same object when token is absent', () => {
    const properties = { access_request_token: 'unique-access-token' };
    expect(omitCustomTokenProperty(properties)).toBe(properties);
  });
});
