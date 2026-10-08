import { describe, expect, it } from 'vitest';
import {
  isMetaGateBlocking,
  metaGateMessage,
  resolveMetaReadinessFromPlatforms,
  selectionIncludesMeta,
} from '../meta-readiness';

describe('selectionIncludesMeta', () => {
  it('detects the Meta group and Meta products', () => {
    expect(selectionIncludesMeta({ google: ['google'], meta: ['meta'] })).toBe(true);
    expect(selectionIncludesMeta({ meta: ['meta_ads'] })).toBe(true);
    expect(selectionIncludesMeta({ other: ['meta_ads'] })).toBe(true);
  });

  it('ignores empty groups and non-Meta selections', () => {
    expect(selectionIncludesMeta({ google: ['google'] })).toBe(false);
    expect(selectionIncludesMeta({ google: ['google'], meta: [] })).toBe(false);
    expect(selectionIncludesMeta({})).toBe(false);
    expect(selectionIncludesMeta(null)).toBe(false);
  });
});

describe('resolveMetaReadinessFromPlatforms', () => {
  it('is not_connected when Meta is missing, inactive or the payload is malformed', () => {
    expect(resolveMetaReadinessFromPlatforms([])).toEqual({ status: 'not_connected' });
    expect(resolveMetaReadinessFromPlatforms(null)).toEqual({ status: 'not_connected' });
    expect(resolveMetaReadinessFromPlatforms({ data: [] })).toEqual({ status: 'not_connected' });
    expect(
      resolveMetaReadinessFromPlatforms([
        { platform: 'google', connected: true },
        { platform: 'meta', connected: false, metadata: { selectedBusinessId: 'biz_1' } },
      ])
    ).toEqual({ status: 'not_connected' });
  });

  it('needs a portfolio when Meta is connected without a selected business', () => {
    expect(resolveMetaReadinessFromPlatforms([{ platform: 'meta', connected: true, metadata: {} }])).toEqual({
      status: 'needs_portfolio',
    });
    expect(
      resolveMetaReadinessFromPlatforms([{ platform: 'meta', connected: true, metadata: { selectedBusinessId: '  ' } }])
    ).toEqual({ status: 'needs_portfolio' });
  });

  it('is ready with a selected business from metadata or the businessId column', () => {
    expect(
      resolveMetaReadinessFromPlatforms([
        {
          platform: 'meta',
          connected: true,
          metadata: { selectedBusinessId: 'biz_1', selectedBusinessName: 'Example Portfolio' },
        },
      ])
    ).toEqual({ status: 'ready', portfolioName: 'Example Portfolio' });
    expect(resolveMetaReadinessFromPlatforms([{ platform: 'meta', connected: true, businessId: 'biz_2' }])).toEqual({
      status: 'ready',
      portfolioName: undefined,
    });
  });
});

describe('isMetaGateBlocking', () => {
  const withMeta = { google: ['google'], meta: ['meta'] };

  it('never blocks when Meta is not selected', () => {
    expect(isMetaGateBlocking({ google: ['google'] }, { status: 'not_connected' })).toBe(false);
    expect(isMetaGateBlocking({ google: ['google'] }, { status: 'idle' })).toBe(false);
  });

  it('blocks while the Meta portfolio is unknown, missing or not selected', () => {
    expect(isMetaGateBlocking(withMeta, { status: 'idle' })).toBe(true);
    expect(isMetaGateBlocking(withMeta, { status: 'loading' })).toBe(true);
    expect(isMetaGateBlocking(withMeta, { status: 'not_connected' })).toBe(true);
    expect(isMetaGateBlocking(withMeta, { status: 'needs_portfolio' })).toBe(true);
  });

  it('allows Continue once ready, and leaves a failed check to the API', () => {
    expect(isMetaGateBlocking(withMeta, { status: 'ready', portfolioName: 'Example' })).toBe(false);
    expect(isMetaGateBlocking(withMeta, { status: 'error', message: 'offline' })).toBe(false);
  });

  it('explains how to unblock', () => {
    expect(metaGateMessage({ status: 'not_connected' })).toMatch(/connect your agency meta business portfolio/i);
    expect(metaGateMessage({ status: 'needs_portfolio' })).toMatch(/choose your agency meta business portfolio/i);
  });
});
