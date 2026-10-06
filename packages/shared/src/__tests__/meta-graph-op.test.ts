import { describe, expect, it } from '@jest/globals';
import {
  MetaGraphOpRecordSchema,
  formatMetaGraphOpCaption,
  normalizeMetaGraphEdge,
  serializeMetaGraphOp,
  assertNoTokenMaterialInSerializedGraphOps,
} from '../meta-graph-op';

describe('Meta Graph operation envelope', () => {
  it('formats a caption-safe operation summary', () => {
    const record = MetaGraphOpRecordSchema.parse({
      method: 'GET',
      edge: '/me/accounts',
      tokenClass: 'client_user',
      outcome: 'ok',
    });
    expect(formatMetaGraphOpCaption(record)).toBe('GET /me/accounts · client_user · ok');
  });

  it('includes Meta error code in caption when present', () => {
    const record = MetaGraphOpRecordSchema.parse({
      method: 'POST',
      edge: '/{asset_id}/assigned_users',
      tokenClass: 'client_user',
      outcome: 'error',
      metaCode: 190,
    });
    expect(formatMetaGraphOpCaption(record)).toBe(
      'POST /{asset_id}/assigned_users · client_user · error (190)'
    );
  });

  it('normalizes Graph URLs to stable edge paths without query tokens', () => {
    expect(
      normalizeMetaGraphEdge(
        'https://graph.facebook.com/v25.0/me/accounts?fields=id,name&access_token=secret'
      )
    ).toBe('/me/accounts');
    expect(
      normalizeMetaGraphEdge('https://graph.facebook.com/v25.0/123456789/assigned_users')
    ).toBe('/{asset_id}/assigned_users');
    expect(normalizeMetaGraphEdge('https://graph.facebook.com/v25.0/123456789/agencies')).toBe(
      '/{asset_id}/agencies'
    );
    expect(normalizeMetaGraphEdge('https://graph.facebook.com/v25.0/me/businesses')).toBe(
      '/me/businesses'
    );
  });

  it('serializes only envelope fields and rejects token-like substrings', () => {
    const serialized = serializeMetaGraphOp({
      method: 'GET',
      edge: '/{page_id}/feed',
      tokenClass: 'selected_page',
      outcome: 'ok',
    });
    expect(JSON.parse(serialized)).toEqual({
      method: 'GET',
      edge: '/{page_id}/feed',
      tokenClass: 'selected_page',
      outcome: 'ok',
    });
    assertNoTokenMaterialInSerializedGraphOps(serialized, [
      'EAAFAKECLIENTTOKEN1234567890',
      'Bearer super-secret',
      'access_token=leaked',
    ]);
  });
});
