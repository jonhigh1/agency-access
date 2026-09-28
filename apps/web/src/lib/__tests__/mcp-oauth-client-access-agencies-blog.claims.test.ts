import { describe, expect, it } from "vitest";

import { getBlogPostBySlug } from "../blog-data";

const SLUG = "mcp-oauth-client-access-agencies";

const FORBIDDEN = [
  /Mike Torres/,
  /Jennifer Walsh/,
  /David Park/,
  /Sarah Mitchell/,
  /Pillar AI/,
  /AuthHub is SOC 2/i,
  /SOC 2 compliant/i,
  /SOC 2–ready/i,
  /We offer (a )?free migration/i,
  /15-minute migration guarantee/i,
  /only tool.*intake/i,
  /exclusive intake/i,
  /AgencyAccess is Zapier-only/i,
  /AuthHub (is|ships) an ads MCP server/i,
  /Leadsie parity/i,
];

describe("mcp-oauth-client-access-agencies blog claims", () => {
  const post = getBlogPostBySlug(SLUG);

  it("loads the post with exact SEO fields", () => {
    expect(post).toBeDefined();
    expect(post?.metaTitle).toBe(
      "MCP OAuth for Agencies: Give AI Agents Client Ad Access Without Password Sharing"
    );
    expect(post?.metaDescription).toBe(
      "MCP guides assume you already have client OAuth. Learn how agencies collect Meta, Google, and GA4 access in one link so humans and AI agents can work the same day—without password sharing."
    );
    expect(post?.title).toBe(
      "MCP OAuth for Agencies: Give AI Agents Client Ad Access Without Password Sharing"
    );
    expect(post?.category).toBe("operations");
    expect(post?.publishedAt).toBe("2026-09-28");
  });

  it("avoids stale or unsupported claims in body copy", () => {
    const body = post?.content ?? "";
    for (const pattern of FORBIDDEN) {
      expect(body).not.toMatch(pattern);
    }
    expect(body).toMatch(/parity, not an exclusive/);
    expect(body).toMatch(/\*\*not\*\* Zapier-only/i);
    expect(body).toMatch(/dual-run/i);
    expect(body).toMatch(/absent from AuthHub's GSC top queries/i);
  });

  it("locks verified AuthHub pricing and platform framing", () => {
    const body = post?.content ?? "";
    expect(body).toMatch(/\$29.*\$79.*\$149/s);
    expect(body).toMatch(/5 \/ 20 \/ 50/);
    expect(body).toMatch(/~\$24 \/ \$66 \/ \$124/);
    expect(body).toMatch(/15\+/);
    expect(body).toMatch(/Infisical/);
    expect(body).toMatch(/September 28, 2026/);
    expect(body).toMatch(/What we do \*\*not\*\* claim: \*\*SOC 2\*\*/);
    expect(body).not.toMatch(/unlimited.*Scale/i);
  });

  it("includes required internal compare, pricing, and adjacency links", () => {
    const body = post?.content ?? "";
    expect(body).toContain("/blog/oauth-token-management-agencies");
    expect(body).toContain("/blog/best-client-onboarding-software-agencies-2026");
    expect(body).toContain("/blog/best-leadsie-alternatives-2026");
    expect(body).toContain("/compare/leadsie-alternative");
    expect(body).toContain("/compare/leadsie-pricing");
    expect(body).toContain("/compare/agencyaccess-alternative");
    expect(body).toContain("/compare/leadsie-vs-agencyaccess-vs-authhub");
    expect(body).toContain("/pricing");
  });
});
