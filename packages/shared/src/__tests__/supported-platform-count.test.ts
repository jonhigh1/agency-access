import { describe, expect, it } from '@jest/globals';
import {
  PLATFORM_HIERARCHY,
  SUPPORTED_PLATFORM_COUNT,
  SUPPORTED_PLATFORM_PRODUCTS,
} from '../types';

describe('SUPPORTED_PLATFORM_COUNT', () => {
  it('lists every client-facing platform product from PLATFORM_HIERARCHY', () => {
    const productIds = Object.values(PLATFORM_HIERARCHY).flatMap((group) =>
      group.products.map((product) => product.id)
    );

    expect([...SUPPORTED_PLATFORM_PRODUCTS]).toEqual(productIds);
  });

  it('derives the count from the product list instead of a hardcoded literal', () => {
    expect(SUPPORTED_PLATFORM_COUNT).toBe(SUPPORTED_PLATFORM_PRODUCTS.length);
  });

  it('counts each product once and never counts group keys', () => {
    expect(new Set(SUPPORTED_PLATFORM_PRODUCTS).size).toBe(SUPPORTED_PLATFORM_COUNT);
    Object.keys(PLATFORM_HIERARCHY).forEach((groupKey) => {
      const groupProducts = PLATFORM_HIERARCHY[groupKey]!.products.map((product) => product.id);
      if (!groupProducts.includes(groupKey)) {
        expect(SUPPORTED_PLATFORM_PRODUCTS).not.toContain(groupKey);
      }
    });
  });

  it('matches the connector count marketing copy quotes today', () => {
    expect(SUPPORTED_PLATFORM_COUNT).toBe(20);
  });
});
