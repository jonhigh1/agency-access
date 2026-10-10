import { describe, expect, it } from "vitest";

import sitemap from "@/app/sitemap";
import { getBlogPostBySlug } from "@/lib/blog-data";
import { getComparisonLastVerified } from "@/lib/comparison-data";
import { SITEMAP_EXCLUDED_BLOG_SLUGS } from "@/lib/seo-canonical";

function pathnames(): string[] {
  return sitemap().map((entry) => new URL(entry.url).pathname);
}

describe("sitemap indexation", () => {
  it("omits blog slugs that 301 to a canonical page", () => {
    const paths = pathnames();
    for (const slug of SITEMAP_EXCLUDED_BLOG_SLUGS) {
      expect(paths).not.toContain(`/blog/${slug}`);
    }
  });

  it("keeps the canonical destinations for those redirects", () => {
    const paths = pathnames();
    expect(paths).toContain("/guides/meta-ads-access");
    expect(paths).toContain("/compare/leadsie-vs-agencyaccess-vs-authhub");
  });

  it("uses updatedAt for lastmod when a post has been refreshed", () => {
    const snapchat = getBlogPostBySlug("snapchat-ads-access-agencies");
    expect(snapchat?.updatedAt).toBe("2026-10-06");

    const entry = sitemap().find(
      (item) => new URL(item.url).pathname === "/blog/snapchat-ads-access-agencies"
    );
    expect(entry?.lastModified).toBe(new Date("2026-10-06").toISOString());
  });

  it("uses lastVerified for compare page lastmod", () => {
    const verified = getComparisonLastVerified("clientinvite-alternative");
    expect(verified).toBe("2026-10-01");

    const entry = sitemap().find(
      (item) => new URL(item.url).pathname === "/compare/clientinvite-alternative"
    );
    expect(entry?.lastModified).toBe(new Date("2026-10-01").toISOString());
  });
});
