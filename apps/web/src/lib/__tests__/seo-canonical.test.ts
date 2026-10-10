import { describe, expect, it } from "vitest";

import {
  CANONICAL_ORIGIN,
  SITEMAP_EXCLUDED_BLOG_SLUGS,
  isExcludedBlogSlug,
  sitemapLastmod,
  toCanonicalUrl,
} from "../seo-canonical";

describe("toCanonicalUrl", () => {
  it("rewrites www.authhub.co to the non-www origin", () => {
    expect(toCanonicalUrl("https://www.authhub.co/guides/meta-ads-access")).toBe(
      `${CANONICAL_ORIGIN}/guides/meta-ads-access`
    );
  });

  it("leaves already-canonical authhub.co URLs unchanged", () => {
    expect(toCanonicalUrl(`${CANONICAL_ORIGIN}/blog/snapchat-ads-access-agencies`)).toBe(
      `${CANONICAL_ORIGIN}/blog/snapchat-ads-access-agencies`
    );
  });
});

describe("sitemap exclusions", () => {
  it("excludes blog slugs that 301 to a canonical page", () => {
    expect(SITEMAP_EXCLUDED_BLOG_SLUGS).toEqual([
      "how-to-get-meta-ads-access-from-clients",
      "leadsie-vs-authhub-comparison",
    ]);
    expect(isExcludedBlogSlug("how-to-get-meta-ads-access-from-clients")).toBe(true);
    expect(isExcludedBlogSlug("google-ads-access-agency")).toBe(false);
  });
});

describe("sitemapLastmod", () => {
  it("prefers the first parseable candidate so updatedAt wins over publishedAt", () => {
    expect(sitemapLastmod("2026-10-06", "2026-09-11")).toBe(
      new Date("2026-10-06").toISOString()
    );
  });

  it("falls through to publishedAt when updatedAt is missing", () => {
    expect(sitemapLastmod(undefined, "2026-01-15")).toBe(
      new Date("2026-01-15").toISOString()
    );
  });
});
