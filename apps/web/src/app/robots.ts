import { MetadataRoute } from 'next';
import { AI_SEARCH_USER_AGENTS } from '@/lib/seo-canonical';

/**
 * Robots.txt configuration for AuthHub
 *
 * Next.js 16 App Router convention: export a robots function
 * that returns MetadataRoute.Robots format
 *
 * This generates robots.txt at build time.
 *
 * Robots.txt rules:
 * - Allow all crawlers (default)
 * - Explicitly allow AI search crawlers (citation, not training-only)
 * - Disallow API routes (no index needed for backend endpoints)
 * - Disallow admin/agency routes (authenticated areas)
 * - Reference sitemap.xml for discovery
 *
 * This file cannot noindex github.com blob pages of the public repo.
 */
export default function robots(): MetadataRoute.Robots {
  const baseUrl = 'https://authhub.co';

  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/api/', '/admin/', '/agency/'],
      },
      ...AI_SEARCH_USER_AGENTS.map((userAgent) => ({
        userAgent,
        allow: '/' as const,
      })),
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
