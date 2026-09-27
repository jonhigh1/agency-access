import { platformGroupOf } from '@agency-platform/shared';

/** Returns whether an access request includes the requested platform group. */
export function isPlatformRequested(accessRequestPlatforms: unknown, platform: string): boolean {
  if (!Array.isArray(accessRequestPlatforms)) return false;

  return accessRequestPlatforms.some((entry: any) => {
    if (entry?.platformGroup === platform) return true;

    const rawPlatform = entry?.platform;
    if (rawPlatform === platform || (typeof rawPlatform === 'string' && platformGroupOf(rawPlatform) === platform)) {
      return true;
    }

    return Array.isArray(entry?.products)
      ? entry.products.some((product: any) =>
          (typeof product === 'string' ? product : product?.product) === platform
        )
      : false;
  });
}
