import { describe, expect, it } from '@jest/globals';
import {
  MetaAssetDeclineSchema,
  MetaClientAuthorizationMetadataSchema,
  MetaDeclinableAssetKindSchema,
} from '../types';

describe('meta asset declines shared contracts', () => {
  it('parses every legal declinable asset kind', () => {
    for (const kind of [
      'ad_account',
      'page',
      'instagram_account',
      'catalog',
      'dataset',
    ] as const) {
      expect(MetaDeclinableAssetKindSchema.parse(kind)).toBe(kind);
    }
  });

  it('rejects kinds that cannot be declined', () => {
    // 'unknown' is a Graph-API placeholder, never a client decision.
    expect(() => MetaDeclinableAssetKindSchema.parse('unknown')).toThrow();
  });

  it('parses a decline record', () => {
    const decline = MetaAssetDeclineSchema.parse({
      assetKind: 'catalog',
      declinedAt: '2026-10-03T12:00:00.000Z',
    });
    expect(decline.assetKind).toBe('catalog');
  });

  it('accepts an optional client-facing label on a decline record', () => {
    const decline = MetaAssetDeclineSchema.parse({
      assetKind: 'catalog',
      declinedAt: '2026-10-03T12:00:00.000Z',
      assetLabel: 'Product catalogs',
    });
    expect(decline.assetLabel).toBe('Product catalogs');
  });

  it('requires a timestamp on a decline record', () => {
    expect(() =>
      MetaAssetDeclineSchema.parse({ assetKind: 'catalog' })
    ).toThrow();
  });

  it('keeps existing authorization metadata parsing unchanged (no declines key)', () => {
    const metadata = MetaClientAuthorizationMetadataSchema.parse({});
    expect(metadata.declinedAssetKinds).toBeUndefined();
    expect(metadata.selection).toBeUndefined();
  });

  it('round-trips declinedAssetKinds on authorization metadata', () => {
    const metadata = MetaClientAuthorizationMetadataSchema.parse({
      declinedAssetKinds: ['catalog', 'dataset'],
    });
    expect(metadata.declinedAssetKinds).toEqual(['catalog', 'dataset']);
  });

  it('rejects unknown kinds inside declinedAssetKinds', () => {
    expect(() =>
      MetaClientAuthorizationMetadataSchema.parse({
        declinedAssetKinds: ['unknown'],
      })
    ).toThrow();
  });
});
