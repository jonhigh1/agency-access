export const CANONICAL_ORIGIN = "https://authhub.co";

export const SITEMAP_EXCLUDED_BLOG_SLUGS = [
  "how-to-get-meta-ads-access-from-clients",
  "leadsie-vs-authhub-comparison",
  "ga4-access-agencies",
  "linkedin-ads-access-agency",
  "tiktok-ads-access-agency",
  "meta-business-manager-access-guide",
] as const;

export const AI_SEARCH_USER_AGENTS = [
  "GPTBot",
  "ChatGPT-User",
  "PerplexityBot",
  "ClaudeBot",
  "Google-Extended",
] as const;

export function toCanonicalUrl(url: string): string {
  return url.replace(/^https?:\/\/www\.authhub\.co/i, CANONICAL_ORIGIN);
}

export function isExcludedBlogSlug(slug: string): boolean {
  return (SITEMAP_EXCLUDED_BLOG_SLUGS as readonly string[]).includes(slug);
}

export function sitemapLastmod(
  ...candidates: Array<string | undefined>
): string | undefined {
  for (const candidate of candidates) {
    if (!candidate) continue;
    const date = new Date(candidate);
    if (!Number.isNaN(date.getTime())) {
      return date.toISOString();
    }
  }
  return undefined;
}
