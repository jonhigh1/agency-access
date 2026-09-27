import { describe, expect, it } from 'vitest';
import { readMetaAuthorizationMetadata } from '../meta-authorization-metadata.js';

describe('readMetaAuthorizationMetadata', () => {
  it('preserves root metadata and returns validated Meta metadata', () => {
    const rootMetadata = {
      unrelated: 'kept',
      meta: {
        selection: {
          clientBusinessId: 'business-1',
          selectedAt: '2026-09-23T00:00:00.000Z',
        },
      },
    };

    expect(readMetaAuthorizationMetadata(rootMetadata)).toEqual({
      rootMetadata,
      metaMetadata: {
        selection: {
          clientBusinessId: 'business-1',
          selectedAt: '2026-09-23T00:00:00.000Z',
        },
      },
    });
  });

  it.each([null, [], { meta: null }, { meta: { unknown: true } }])(
    'uses empty metadata for invalid input %j',
    (input) => {
      expect(readMetaAuthorizationMetadata(input).metaMetadata).toEqual({});
    }
  );
});
