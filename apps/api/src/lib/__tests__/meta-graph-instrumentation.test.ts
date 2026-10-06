import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  clearRecordedMetaGraphOps,
  getRecordedMetaGraphOps,
  metaGraphFetch,
  recordMetaGraphOp,
} from '../meta-graph-instrumentation.js';
import { assertNoTokenMaterialInSerializedGraphOps, serializeMetaGraphOp } from '@agency-platform/shared';

describe('metaGraphFetch instrumentation', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    clearRecordedMetaGraphOps();
  });

  it('records sanitized envelope fields on success without token material in serialized events', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ data: [] }),
    });
    vi.stubGlobal('fetch', fetchMock);

    await metaGraphFetch(
      'https://graph.facebook.com/v25.0/me/accounts?fields=id&access_token=must-not-log',
      {
        method: 'GET',
        accessToken: 'EAAFAKECLIENTTOKEN1234567890abcdefghij',
        tokenClass: 'client_user',
      }
    );

    const ops = getRecordedMetaGraphOps();
    expect(ops).toHaveLength(1);
    expect(ops[0]).toEqual({
      method: 'GET',
      edge: '/me/accounts',
      tokenClass: 'client_user',
      outcome: 'ok',
    });

    const serialized = JSON.stringify(ops);
    assertNoTokenMaterialInSerializedGraphOps(serialized, [
      'EAAFAKECLIENTTOKEN1234567890abcdefghij',
      'must-not-log',
      'Bearer',
    ]);
  });

  it('records Meta error code on Graph error responses', async () => {
    const errorBody = JSON.stringify({
      error: { message: 'Invalid OAuth access token', code: 190 },
    });
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      clone: () => ({
        text: async () => errorBody,
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    await metaGraphFetch('https://graph.facebook.com/v25.0/me/businesses', {
      method: 'GET',
      accessToken: 'client-token',
      tokenClass: 'client_user',
    });

    expect(getRecordedMetaGraphOps()[0]).toMatchObject({
      method: 'GET',
      edge: '/me/businesses',
      tokenClass: 'client_user',
      outcome: 'error',
      metaCode: 190,
    });
  });

  it('records assigned_users and agencies partner verify edges', async () => {
    recordMetaGraphOp({
      method: 'GET',
      edge: '/{asset_id}/agencies',
      tokenClass: 'client_user',
      outcome: 'ok',
    });
    recordMetaGraphOp({
      method: 'POST',
      edge: '/{asset_id}/assigned_users',
      tokenClass: 'client_user',
      outcome: 'ok',
    });

    const serialized = getRecordedMetaGraphOps().map(serializeMetaGraphOp).join('\n');
    expect(serialized).toContain('/{asset_id}/agencies');
    expect(serialized).toContain('/{asset_id}/assigned_users');
    assertNoTokenMaterialInSerializedGraphOps(serialized);
  });
});
