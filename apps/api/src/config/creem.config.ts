/**
 * Creem Product/Price Configuration
 *
 * Maps subscription tiers to Creem product IDs.
 * These are the actual product IDs from the Creem dashboard.
 *
 * Production Products:
 * - Starter (Monthly): prod_4SUPfON3XwTo5SKOJzN2dH
 * - Starter (Annual): prod_6Hyydvn6jh0numRxJecMol
 * - Growth (Monthly): prod_11NeEMY6WtGEkdnvdd7obj
 * - Growth (Annual): prod_4vNvJn99RTRwhkMeHgkBT7
 * - Agency (Monthly): prod_5FEs6qBlwvbMWHHun95wkk
 * - Agency (Annual): prod_6w78r7ZbTUjkJl7mTkNfFr
 */

import type { SubscriptionTier } from '@agency-platform/shared';

export type BillingInterval = 'monthly' | 'yearly';

interface CreemProductConfig {
  monthly: string;
  yearly: string;
}

const CREEM_PRODUCT_IDS: Record<SubscriptionTier, CreemProductConfig> = {
  STARTER: {
    monthly: 'prod_4SUPfON3XwTo5SKOJzN2dH',
    yearly: 'prod_6Hyydvn6jh0numRxJecMol',
  },
  GROWTH: {
    monthly: 'prod_11NeEMY6WtGEkdnvdd7obj',
    yearly: 'prod_4vNvJn99RTRwhkMeHgkBT7',
  },
  SCALE: {
    monthly: 'prod_5FEs6qBlwvbMWHHun95wkk',
    yearly: 'prod_6w78r7ZbTUjkJl7mTkNfFr',
  },
};

/**
 * Get the Creem product ID for a given subscription tier and billing interval
 */
export function getProductId(tier: SubscriptionTier, interval: BillingInterval = 'monthly'): string {
  const productId = CREEM_PRODUCT_IDS[tier][interval];

  if (productId.startsWith('prod_tbd')) {
    throw new Error(`${tier} tier (${interval} billing) product ID is not yet configured. Please contact Creem support.`);
  }

  return productId;
}

/**
 * Get all Creem product IDs for a given subscription tier
 */
export function getTierProductIds(tier: SubscriptionTier): CreemProductConfig {
  return CREEM_PRODUCT_IDS[tier];
}

/**
 * Get subscription tier from a Creem product ID
 */
export function getTierFromProductId(productId: string): SubscriptionTier {
  for (const [tier, config] of Object.entries(CREEM_PRODUCT_IDS)) {
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
  for (const config of Object.values(CREEM_PRODUCT_IDS)) {
    if (config.monthly === productId) return 'monthly';
    if (config.yearly === productId) return 'yearly';
  }

  throw new Error(`Unknown Creem product ID: ${productId}`);
}
