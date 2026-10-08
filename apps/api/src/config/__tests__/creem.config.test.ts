import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  DEFAULT_CREEM_PRODUCT_IDS,
  getIntervalFromProductId,
  getProductId,
  getTierFromProductId,
  getTierProductIds,
  parseCreemProductIds,
  resetCreemProductIdsCacheForTests,
} from '@/config/creem.config';

const TEST_MAP = {
  STARTER: { monthly: 'prod_testStarterM', yearly: 'prod_testStarterY' },
  GROWTH: { monthly: 'prod_testGrowthM', yearly: 'prod_testGrowthY' },
  SCALE: { monthly: 'prod_testScaleM', yearly: 'prod_testScaleY' },
};

describe('parseCreemProductIds', () => {
  it('returns the live defaults exactly when unset or blank', () => {
    for (const raw of [undefined, null, '', '   ']) {
      expect(parseCreemProductIds(raw)).toEqual({
        STARTER: { monthly: 'prod_4SUPfON3XwTo5SKOJzN2dH', yearly: 'prod_6Hyydvn6jh0numRxJecMol' },
        GROWTH: { monthly: 'prod_11NeEMY6WtGEkdnvdd7obj', yearly: 'prod_4vNvJn99RTRwhkMeHgkBT7' },
        SCALE: { monthly: 'prod_5FEs6qBlwvbMWHHun95wkk', yearly: 'prod_6w78r7ZbTUjkJl7mTkNfFr' },
      });
    }
  });

  it('accepts a complete valid map', () => {
    expect(parseCreemProductIds(JSON.stringify(TEST_MAP))).toEqual(TEST_MAP);
  });

  it('rejects malformed JSON', () => {
    expect(() => parseCreemProductIds('{not json')).toThrow('CREEM_PRODUCT_IDS_JSON is not valid JSON');
  });

  it('rejects a map missing a tier or interval', () => {
    const { SCALE: _scale, ...missingTier } = TEST_MAP;
    expect(() => parseCreemProductIds(JSON.stringify(missingTier))).toThrow(/SCALE/);
    expect(() =>
      parseCreemProductIds(JSON.stringify({ ...TEST_MAP, GROWTH: { monthly: 'prod_x' } }))
    ).toThrow(/GROWTH\.yearly/);
  });

  it('rejects unknown tiers, non-product ids and duplicates', () => {
    expect(() =>
      parseCreemProductIds(JSON.stringify({ ...TEST_MAP, ENTERPRISE: TEST_MAP.SCALE }))
    ).toThrow(/invalid/);
    expect(() =>
      parseCreemProductIds(JSON.stringify({ ...TEST_MAP, STARTER: { monthly: 'price_1', yearly: 'prod_ok' } }))
    ).toThrow(/STARTER\.monthly/);
    expect(() =>
      parseCreemProductIds(JSON.stringify({ ...TEST_MAP, SCALE: { monthly: 'prod_testGrowthM', yearly: 'prod_z' } }))
    ).toThrow(/unique/);
    expect(() => parseCreemProductIds('[]')).toThrow(/invalid/);
  });
});

describe('creem config lookups', () => {
  const original = process.env.CREEM_PRODUCT_IDS_JSON;

  afterEach(() => {
    if (original === undefined) delete process.env.CREEM_PRODUCT_IDS_JSON;
    else process.env.CREEM_PRODUCT_IDS_JSON = original;
    resetCreemProductIdsCacheForTests();
  });

  it('uses live ids when the env var is unset', () => {
    delete process.env.CREEM_PRODUCT_IDS_JSON;
    resetCreemProductIdsCacheForTests();
    expect(getProductId('GROWTH', 'yearly')).toBe(DEFAULT_CREEM_PRODUCT_IDS.GROWTH.yearly);
    expect(getTierFromProductId('prod_5FEs6qBlwvbMWHHun95wkk')).toBe('SCALE');
    expect(getIntervalFromProductId('prod_6Hyydvn6jh0numRxJecMol')).toBe('yearly');
  });

  it('uses the env map when set, and no longer recognizes live ids', () => {
    process.env.CREEM_PRODUCT_IDS_JSON = JSON.stringify(TEST_MAP);
    resetCreemProductIdsCacheForTests();
    expect(getProductId('STARTER')).toBe('prod_testStarterM');
    expect(getTierProductIds('SCALE')).toEqual(TEST_MAP.SCALE);
    expect(getTierFromProductId('prod_testGrowthY')).toBe('GROWTH');
    expect(getIntervalFromProductId('prod_testScaleY')).toBe('yearly');
    expect(() => getTierFromProductId(DEFAULT_CREEM_PRODUCT_IDS.STARTER.monthly)).toThrow(
      'Unknown Creem product ID'
    );
  });
});

describe('env boot validation', () => {
  const original = process.env.CREEM_PRODUCT_IDS_JSON;

  afterEach(() => {
    if (original === undefined) delete process.env.CREEM_PRODUCT_IDS_JSON;
    else process.env.CREEM_PRODUCT_IDS_JSON = original;
    vi.resetModules();
  });

  it('fails fast at startup when CREEM_PRODUCT_IDS_JSON is set but invalid', async () => {
    process.env.CREEM_PRODUCT_IDS_JSON = '{"STARTER":{"monthly":"prod_only"}}';
    vi.resetModules();
    await expect(import('@/lib/env')).rejects.toThrow(/CREEM_PRODUCT_IDS_JSON is invalid/);
  });

  it('boots normally when CREEM_PRODUCT_IDS_JSON is unset', async () => {
    delete process.env.CREEM_PRODUCT_IDS_JSON;
    vi.resetModules();
    const { env } = await import('@/lib/env');
    expect(env.CREEM_PRODUCT_IDS_JSON).toBeUndefined();
  });
});
