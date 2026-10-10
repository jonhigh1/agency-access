import { describe, expect, it } from "vitest";

import { isExcludedBlogSlug } from "@/lib/seo-canonical";
import {
  getBlogPostBySlug,
  getBlogPosts,
  getBlogPostsByCategory,
} from "../blog-data";

describe("blog-data", () => {
  it("parses checked-in Markdown frontmatter and body content", () => {
    const post = getBlogPostBySlug("google-ads-access-agency");

    expect(post).toMatchObject({
      slug: "google-ads-access-agency",
      title: "Google Ads Access Guide: How Clients Grant Agency Permissions (2026)",
      category: "tutorials",
      stage: "consideration",
      author: {
        name: "Jon High",
        role: "Founder",
        slug: "jon-high",
      },
    });
    expect(post?.faqs).toBeUndefined();
    expect(post?.content).toContain("Google's Unique Multi-Product Challenge");
    expect(post?.tags.length).toBeGreaterThan(0);
  });

  it("parses snapchat refresh fields and spend-ready section", () => {
    const post = getBlogPostBySlug("snapchat-ads-access-agencies");

    expect(post).toMatchObject({
      slug: "snapchat-ads-access-agencies",
      publishedAt: "2026-09-11",
      updatedAt: "2026-10-06",
      suppressArticleFooter: true,
      canonical: "https://authhub.co/blog/snapchat-ads-access-agencies",
    });
    expect(post?.metaDescription).toContain("Organization not spend ready");
    expect(post?.content).toContain(
      '"Organization not spend ready" (PERMISSION_DENIED)'
    );
    expect(post?.content).toContain("we don't fix or detect this error");
    expect(post?.content).toContain(
      "Ready to simplify Snapchat (and every other) client invite?"
    );
    expect(post?.content).not.toContain("Agency Access Platform");
  });

  it("parses frontmatter faqs for posts that declare them", () => {
    const post = getBlogPostBySlug("client-onboarding-checklist");
    expect(post?.faqs?.[0]).toEqual({
      question: "What should a client onboarding checklist include?",
      answer:
        "Contract/SOW close, intake and brand assets, platform access with exact roles, expectations (comms, approvals, reporting, scope), kickoff with a written success metric, and a first-value path through a 30-day review. Every task needs an owner and a due day.",
    });
    expect(post?.faqs?.length).toBe(6);
  });

  it("rewrites www canonicals to the non-www origin", () => {
    const post = getBlogPostBySlug("how-to-get-meta-ads-access-from-clients");
    expect(post?.canonical).toBe("https://authhub.co/guides/meta-ads-access");
  });

  it("publishes the 2026 client-access cluster with Jon High bylines", () => {
    const slugs = [
      "admin-vs-standard-vs-read-only-agency-access",
      "meta-partner-vs-employee-access",
      "how-to-explain-an-access-request-to-clients",
      "google-ads-standard-vs-admin",
    ];
    for (const slug of slugs) {
      const post = getBlogPostBySlug(slug);
      expect(post?.author).toMatchObject({ name: "Jon High", slug: "jon-high" });
      expect(post?.faqs?.length).toBeGreaterThanOrEqual(3);
      expect(post?.updatedAt).toBe("2026-10-10");
      expect(isExcludedBlogSlug(slug)).toBe(false);
    }
  });

  it("sorts posts newest first and filters by category", () => {
    const posts = getBlogPosts();
    const securityPosts = getBlogPostsByCategory("security");

    expect(posts.length).toBeGreaterThan(0);
    expect(new Date(posts[0].publishedAt).getTime()).toBeGreaterThanOrEqual(
      new Date(posts[1].publishedAt).getTime()
    );
    expect(securityPosts.length).toBeGreaterThan(0);
    expect(securityPosts.every((post) => post.category === "security")).toBe(
      true
    );
  });
});
