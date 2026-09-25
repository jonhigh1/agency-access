import { describe, expect, it } from "vitest";

import { getBlogPostBySlug } from "../blog-data";

const SLUG = "best-leadsie-alternatives-2026";

const FORBIDDEN = [
  /Mike Torres/,
  /Jennifer Walsh/,
  /David Park/,
  /Sarah Mitchell/,
  /AgencyAccess (has )?no API/i,
  /does not have an API/i,
  /AuthHub is SOC 2/i,
  /SOC 2 compliant/i,
  /We offer (a )?free migration/i,
  /15-minute migration guarantee/i,
  /only tool.*intake/i,
  /exclusive intake/i,
];

describe("best-leadsie-alternatives-2026 blog claims", () => {
  const post = getBlogPostBySlug(SLUG);

  it("loads the post with exact SEO fields", () => {
    expect(post).toBeDefined();
    expect(post?.metaTitle).toBe(
      "Best Leadsie Alternatives (2026): Fair Comparison for Agencies"
    );
    expect(post?.metaDescription).toBe(
      "Compare the best Leadsie alternatives for agencies in 2026—ClientInvite, AgencyAccess, AuthHub, ClientFuse, and others—on pricing model, platforms, intake, and token refresh."
    );
    expect(post?.title).toBe(
      "Best Leadsie Alternatives (2026): Fair Comparison for Agencies"
    );
  });

  it("avoids stale or unsupported claims in body copy", () => {
    const body = post?.content ?? "";
    for (const pattern of FORBIDDEN) {
      expect(body).not.toMatch(pattern);
    }
    expect(body).toMatch(/public REST API|public API/);
    expect(body).toMatch(/parity, not an exclusive/);
    expect(body).toMatch(/\*\*Not\*\* unlimited clients on all plans/);
  });

  it("locks verified AuthHub pricing and platform framing", () => {
    const body = post?.content ?? "";
    expect(body).toMatch(/\$29.*\$79.*\$149/s);
    expect(body).toMatch(/5 \/ 20 \/ 50/);
    expect(body).toMatch(/~\$24 \/ \$66 \/ \$124/);
    expect(body).toMatch(/15\+/);
    expect(body).toMatch(/Infisical/);
    expect(body).toMatch(/September 25, 2026/);
    expect(body).not.toMatch(/unlimited.*Scale/i);
  });

  it("includes required internal compare and pricing links", () => {
    const body = post?.content ?? "";
    expect(body).toContain("/compare/leadsie-alternative");
    expect(body).toContain("/compare/leadsie-pricing");
    expect(body).toContain("/compare/agencyaccess-alternative");
    expect(body).toContain("/compare/leadsie-vs-agencyaccess-vs-authhub");
    expect(body).toContain("/pricing");
    expect(body).toContain("/blog/best-client-onboarding-software-agencies-2026");
  });
});
