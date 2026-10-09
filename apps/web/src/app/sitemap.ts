import { MetadataRoute } from 'next';
import { getBlogPosts } from '@/lib/blog-data';
import { getAllComparisonPageSlugs } from '@/lib/comparison-data';

/**
 * Dynamic sitemap generation for AuthHub
 *
 * Next.js 16 App Router convention: export a sitemap function
 * that returns MetadataRoute.Sitemap format.
 *
 * Generates sitemap.xml at /sitemap.xml for Google Search Console.
 * Follows 2026 best practices:
 * - Only index-worthy URLs (canonical, clean, HTTPS)
 * - Accurate lastmod where known (blog publishedAt)
 * - No thin/duplicate/internal pages
 * - Absolute URLs with full protocol
 *
 * Reference: https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '') || 'https://authhub.co';
  const buildDate = new Date().toISOString();

  // Ensure base URL uses https in production for sitemap submission
  const canonicalBase =
    baseUrl.startsWith('http') ? baseUrl : `https://${baseUrl}`;

  // Helper: format date string to ISO for lastmod (W3C Datetime)
  const toLastmod = (dateStr: string): string => {
    if (!dateStr) return buildDate;
    const d = new Date(dateStr);
    return Number.isNaN(d.getTime()) ? buildDate : d.toISOString();
  };

  const entry = (
    path: string,
    lastmod: string,
    changeFreq: MetadataRoute.Sitemap[number]['changeFrequency'] = 'monthly',
    pri = 0.8
  ): MetadataRoute.Sitemap[number] => ({
    url: `${canonicalBase}${path}`,
    lastModified: lastmod,
    changeFrequency: changeFreq,
    priority: pri,
  });

  // Static marketing pages (index-worthy only)
  const staticPages: MetadataRoute.Sitemap = [
    entry('/', buildDate, 'weekly', 1.0),
    entry('/pricing', buildDate, 'monthly', 0.9),
    entry('/blog', buildDate, 'daily', 0.9),
    entry('/about', buildDate, 'monthly', 0.6),
    entry('/contact', buildDate, 'yearly', 0.6),
    entry('/affiliate', buildDate, 'monthly', 0.7),
    entry('/terms', buildDate, 'yearly', 0.3),
    entry('/privacy-policy', buildDate, 'yearly', 0.3),
    entry('/security', buildDate, 'monthly', 0.7),
  ];

  // Blog posts — use publishedAt for lastmod (accurate per 2026 guidelines)
  const blogPosts = getBlogPosts();
  const blogUrls: MetadataRoute.Sitemap = blogPosts.map((post) =>
    entry(`/blog/${post.slug}`, toLastmod(post.publishedAt), 'monthly', 0.7)
  );

  // Compare pages (programmatic SEO)
  const compareSlugs = getAllComparisonPageSlugs();
  const compareUrls: MetadataRoute.Sitemap = compareSlugs.map((slug) =>
    entry(`/compare/${slug}`, buildDate, 'monthly', 0.7)
  );

  // Platform guides
  const guideUrls: MetadataRoute.Sitemap = [
    entry('/guides/meta-ads-access', buildDate, 'monthly', 0.8),
    entry('/guides/google-ads-access', buildDate, 'monthly', 0.8),
  ];

  const featureUrls: MetadataRoute.Sitemap = [
    entry('/features/white-label', buildDate, 'monthly', 0.8),
  ];

  return [...staticPages, ...blogUrls, ...compareUrls, ...guideUrls, ...featureUrls];
}
