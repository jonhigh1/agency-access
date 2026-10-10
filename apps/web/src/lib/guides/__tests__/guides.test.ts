import { describe, expect, it } from 'vitest';
import { getAllGuideSlugs, getAllGuides, getGuideBySlug } from '../index';

const REQUIRED_SLUGS = [
  'meta-ads-access',
  'google-ads-access',
  'ga4-access',
  'linkedin-ads-access',
  'tiktok-ads-access',
  'facebook-business-manager-access',
] as const;

describe('guide catalog', () => {
  it('publishes the live how-tos plus the GA4, LinkedIn, TikTok, and Meta BM spokes', () => {
    expect(getAllGuideSlugs()).toEqual([...REQUIRED_SLUGS]);
    for (const slug of REQUIRED_SLUGS) {
      expect(getGuideBySlug(slug)?.slug).toBe(slug);
    }
    expect(getGuideBySlug('not-a-guide')).toBeUndefined();
  });

  it('gives every guide a sibling besides itself', () => {
    const slugs = new Set(getAllGuideSlugs());
    for (const guide of getAllGuides()) {
      expect(guide.relatedSlugs.length).toBeGreaterThan(0);
      expect(guide.relatedSlugs).not.toContain(guide.slug);
      for (const related of guide.relatedSlugs) {
        expect(slugs.has(related)).toBe(true);
      }
    }
  });
});
