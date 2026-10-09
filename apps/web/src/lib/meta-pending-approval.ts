/**
 * Google-first mode while Meta App Review is pending.
 *
 * Until Meta approves the app, Meta OAuth shows "This app needs at least one
 * supported permission" to anyone without an app role. With
 * NEXT_PUBLIC_META_PENDING_APPROVAL=true the web app defaults to Google and
 * shows Meta as pending (not selectable, no Meta OAuth on the client page).
 * Unset or any other value: behavior is unchanged.
 *
 * NEXT_PUBLIC_ vars are inlined at build time, so flipping the flag needs a
 * redeploy. Keep the literal `process.env.NEXT_PUBLIC_META_PENDING_APPROVAL`
 * access so Next.js can inline it.
 */

import { PLATFORM_HIERARCHY, platformGroupOf } from '@agency-platform/shared';

export const META_PENDING_APPROVAL_LABEL = 'Pending Meta approval (coming soon)';
export const META_ACCESS_COMING_SOON = 'Meta access coming soon';

export function isMetaPendingApproval(): boolean {
  return process.env.NEXT_PUBLIC_META_PENDING_APPROVAL === 'true';
}

/** True for the Meta group key or any Meta-group product (meta_ads, instagram, ...). */
export function isMetaGroupPlatform(platform: string | null | undefined): boolean {
  if (!platform) return false;
  return platform === 'meta' || platformGroupOf(platform) === 'meta';
}

/**
 * The selection with every Meta-group platform removed. Groups left empty are
 * dropped. Use only when isMetaPendingApproval() is true.
 */
export function withoutMetaPlatforms(
  selection: Record<string, readonly string[] | undefined> | null | undefined
): Record<string, string[]> {
  const next: Record<string, string[]> = {};
  for (const [group, platforms] of Object.entries(selection ?? {})) {
    if (isMetaGroupPlatform(group)) continue;
    const kept = (platforms ?? []).filter(
      (platform): platform is string => typeof platform === 'string' && platform.length > 0 && !isMetaGroupPlatform(platform)
    );
    if (kept.length > 0) next[group] = kept;
  }
  return next;
}

/** Every Google product, as the hierarchical access-request selectors store it. */
export function defaultGoogleProductSelection(): Record<string, string[]> {
  return { google: (PLATFORM_HIERARCHY.google?.products ?? []).map((product) => product.id) };
}
