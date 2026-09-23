import { describe, expect, it } from "vitest";

import { getBlogPostBySlug } from "../blog-data";

const SLUG = "best-client-onboarding-software-agencies-2026";

const FORBIDDEN = [
  /850\+ onboarding professionals/,
  /Mike Torres/,
  /Jennifer Walsh/,
  /Only tool that combines/,
  /\$49\/month \(credit-based, 3 credits\)/,
  /From \$49\/month/,
  /costs agencies \$1,500\/month/,
  /8-12 hours per month/,
  /Pinterest\) in one session/,
  /same-day support/i,
  /AuthHub is SOC 2/i,
  /Contact for pricing/,
  /relies on email instructions rather than a guided client flow/,
];

describe("best-client-onboarding-software-agencies-2026 blog claims", () => {
  const post = getBlogPostBySlug(SLUG);

  it("loads the post with exact SEO fields", () => {
    expect(post).toBeDefined();
    expect(post?.metaTitle).toBe(
      "Best Client Onboarding Software for Agencies (2026): Access Tools vs Portals"
    );
    expect(post?.metaDescription).toBe(
      'Most "best onboarding software" lists mix portals, PM tools, and access tools. Here\'s the four-job map for agencies—and when AuthHub\'s one-link OAuth access belongs in the stack.'
    );
    expect(post?.openGraphDescription).toMatch(
      /Portals collect forms and signatures; access tools unlock Meta and Google/
    );
  });

  it("avoids stale or unsupported claims in body copy", () => {
    const body = post?.content ?? "";
    for (const pattern of FORBIDDEN) {
      expect(body).not.toMatch(pattern);
    }
  });

  it("locks verified pricing and platform framing", () => {
    const body = post?.content ?? "";
    expect(body).toMatch(/\$29\/mo.*\$79\/mo.*\$149\/mo/s);
    expect(body).toMatch(/5.*20.*50/);
    expect(body).toMatch(/\$59 \/ \$129 \/ \$299/);
    expect(body).toMatch(/\$50 overage packs/);
    expect(body).toMatch(/Meta, Google Ads, GA4, LinkedIn, TikTok/);
    expect(body).toMatch(/15\+/);
    expect(body).toMatch(/combines access \+ intake in one client flow/);
    expect(body).toMatch(/September 23, 2026/);
    expect(body).toMatch(/Infisical/);
    expect(body).not.toMatch(/Pinterest.*all platforms/i);
  });

  it("includes required internal compare and pricing links", () => {
    const body = post?.content ?? "";
    expect(body).toContain("/compare/leadsie-alternative");
    expect(body).toContain("/compare/leadsie-pricing");
    expect(body).toContain("/compare/agencyaccess-alternative");
    expect(body).toContain("/pricing");
    expect(body).toContain("/blog/oauth-token-management-agencies");
  });
});
