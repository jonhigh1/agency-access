/**
 * Creem Product/Price Configuration
 *
 * Maps subscription tiers to Creem product IDs.
 *
 * By default these are the live product IDs from the Creem dashboard (below).
 * Non-production environments (e.g. staging on Creem Test Mode) can override the
 * whole map with CREEM_PRODUCT_IDS_JSON, for example:
 *
 *   CREEM_PRODUCT_IDS_JSON='{"STARTER":{"monthly":"prod_a","yearly":"prod_b"},
 *     "GROWTH":{"monthly":"prod_c","yearly":"prod_d"},
 *     "SCALE":{"monthly":"prod_e","yearly":"prod_f"}}'
 *
 * When the variable is unset or empty, the live defaults are used unchanged.
 * A set-but-invalid value fails fast (see env.ts) instead of silently falling
 * back to live product IDs.
 *
 * Production Products:
 * - Starter (Monthly): prod_4SUPfON3XwTo5SKOJzN2dH
 * - Starter (Annual): prod_6Hyydvn6jh0numRxJecMol
 * - Growth (Monthly): prod_11NeEMY6WtGEkdnvdd7obj
 * - Growth (Annual): prod_4vNvJn99RTRwhkMeHgkBT7
 * - Agency (Monthly): prod_5FEs6qBlwvbMWHHun95wkk
 * - Agency (Annual): prod_6w78r7ZbTUjkJl7mTkNfFr
 */

import { z } from 'zod';
import type { SubscriptionTier } from '@agency-platform/shared';

export type BillingInterval = 'monthly' | 'yearly';

interface CreemProductConfig {
  monthly: string;
  yearly: string;
}

export type CreemProductIdMap = Record<SubscriptionTier, CreemProductConfig>;

/** Live Creem product IDs, used whenever CREEM_PRODUCT_IDS_JSON is unset. */
export const DEFAULT_CREEM_PRODUCT_IDS: Readonly<CreemProductIdMap> = Object.freeze({
  STARTER: Object.freeze({
    monthly: 'prod_4SUPfON3XwTo5SKOJzN2dH',
    yearly: 'prod_6Hyydvn6jh0numRxJecMol',
  }),
  GROWTH: Object.freeze({
    monthly: 'prod_11NeEMY6WtGEkdnvdd7obj',
    yearly: 'prod_4vNvJn99RTRwhkMeHgkBT7',
  }),
  SCALE: Object.freeze({
    monthly: 'prod_5FEs6qBlwvbMWHHun95wkk',
    yearly: 'prod_6w78r7ZbTUjkJl7mTkNfFr',
  }),
});

const productIdSchema = z
  .string()
  .regex(/^prod_[A-Za-z0-9]+$/, 'must look like a Creem product id (prod_...)');

const tierProductsSchema = z
  .object({ monthly: productIdSchema, yearly: productIdSchema })
  .strict();

const productIdMapSchema = z
  .object({
    STARTER: tierProductsSchema,
    GROWTH: tierProductsSchema,
    SCALE: tierProductsSchema,
  })
  .strict();

/**
 * Parse and validate a CREEM_PRODUCT_IDS_JSON value.
 * Unset/blank returns the live defaults; anything else must be a complete,
 * valid map with six distinct product IDs or this throws.
 */
export function parseCreemProductIds(raw: string | undefined | null): CreemProductIdMap {
  if (raw === undefined || raw === null || raw.trim() === '') {
    return DEFAULT_CREEM_PRODUCT_IDS as CreemProductIdMap;
  }

  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    throw new Error('CREEM_PRODUCT_IDS_JSON is not valid JSON');
  }

  const result = productIdMapSchema.safeParse(json);
  if (!result.success) {
    const details = result.error.issues
      .map((issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`)
      .join('; ');
    throw new Error(`CREEM_PRODUCT_IDS_JSON is invalid: ${details}`);
  }

  const ids = Object.values(result.data).flatMap((config) => [config.monthly, config.yearly]);
  if (new Set(ids).size !== ids.length) {
    throw new Error('CREEM_PRODUCT_IDS_JSON is invalid: product ids must be unique');
  }

  return result.data;
}

let cachedProductIds: CreemProductIdMap | null = null;

function productIds(): CreemProductIdMap {
  if (!cachedProductIds) {
    cachedProductIds = parseCreemProductIds(process.env.CREEM_PRODUCT_IDS_JSON);
  }
  return cachedProductIds;
}

/** Test-only: drop the memoized map so a changed env value is re-read. */
export function resetCreemProductIdsCacheForTests(): void {
  cachedProductIds = null;
}

/**
 * Get the Creem product ID for a given subscription tier and billing interval
 */
export function getProductId(tier: SubscriptionTier, interval: BillingInterval = 'monthly'): string {
  const productId = productIds()[tier][interval];

  if (productId.startsWith('prod_tbd')) {
    throw new Error(`${tier} tier (${interval} billing) product ID is not yet configured. Please contact Creem support.`);
  }

  return productId;
}

/**
 * Get all Creem product IDs for a given subscription tier
 */
export function getTierProductIds(tier: SubscriptionTier): CreemProductConfig {
  return productIds()[tier];
}

/**
 * Get subscription tier from a Creem product ID
 */
export function getTierFromProductId(productId: string): SubscriptionTier {
  for (const [tier, config] of Object.entries(productIds())) {
    if (config.monthly === productId || config.yearly === productId) {
      return tier as SubscriptionTier;
    }
  }

  throw new Error(`Unknown Creem product ID: ${productId}`);
}

/**
 * Get billing interval from a Creem product ID
 */
export function getIntervalFromProductId(productId: string): BillingInterval {
  for (const config of Object.values(productIds())) {
    if (config.monthly === productId) return 'monthly';
    if (config.yearly === productId) return 'yearly';
  }

  throw new Error(`Unknown Creem product ID: ${productId}`);
}
