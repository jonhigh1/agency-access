import path from "node:path";
import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const sentryRelease =
  process.env.NEXT_PUBLIC_SENTRY_RELEASE ||
  process.env.SENTRY_RELEASE ||
  process.env.VERCEL_GIT_COMMIT_SHA ||
  process.env.NEXT_PUBLIC_APP_VERSION ||
  undefined;

const nextConfig: NextConfig = {
  /* config options here */
  typescript: {
    ignoreBuildErrors: false,
  },
  typedRoutes: true,
  // Expose the build git SHA to the browser so client events share the release
  // used for sourcemap upload (Vercel sets VERCEL_GIT_COMMIT_SHA at build time).
  env: {
    NEXT_PUBLIC_SENTRY_RELEASE: sentryRelease ?? '',
  },
  turbopack: {
    root: path.resolve(import.meta.dirname, '..', '..'),
  },

  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
      },
      {
        protocol: 'https',
        hostname: 'cdn.brandfetch.io',
        pathname: '/**',
      },
    ],
    formats: ['image/avif', 'image/webp'],
    deviceSizes: [24, 32, 64, 96, 128],
    imageSizes: [24, 32, 64, 96, 128],
  },

  // Proxy API requests to backend server (running on port 3001)
  // Only enabled in development. In production, NEXT_PUBLIC_API_URL should point to the deployed backend.
  async rewrites() {
    // PostHog reverse proxy rewrites (always enabled to avoid ad blockers)
    const posthogRewrites = [
      {
        source: '/ingest/static/:path*',
        destination: 'https://us-assets.i.posthog.com/static/:path*',
      },
      {
        source: '/ingest/:path*',
        destination: 'https://us.i.posthog.com/:path*',
      },
    ];

    // In production, only return PostHog rewrites
    if (process.env.NODE_ENV === 'production') {
      return posthogRewrites;
    }

    const backendUrl = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:3001';

    // In development, include both PostHog and API proxy rewrites
    return [
      ...posthogRewrites,
      {
        source: '/api/:path*',
        destination: `${backendUrl}/api/:path*`,
      },
      {
        source: '/agency-platforms/:path*',
        destination: `${backendUrl}/agency-platforms/:path*`,
      },
    ];
  },

  // This is required to support PostHog trailing slash API requests
  skipTrailingSlashRedirect: true,

  // Permanent redirects for SEO and content consolidation
  async redirects() {
    return [
      {
        source: '/blog/how-to-get-meta-ads-access-from-clients',
        destination: '/guides/meta-ads-access',
        permanent: true, // 301 redirect
      },
      {
        source: '/blog/leadsie-vs-authhub-comparison',
        destination: '/compare/leadsie-vs-agencyaccess-vs-authhub',
        permanent: true,
      },
    ];
  },

};

export default withSentryConfig(nextConfig, {
  // CLI-verified live project in org authhub (DSN project id 4511018267574272).
  org: process.env.SENTRY_ORG ?? 'authhub',
  project: process.env.SENTRY_PROJECT ?? 'node',
  authToken: process.env.SENTRY_AUTH_TOKEN,
  release: sentryRelease ? { name: sentryRelease } : undefined,
  // Skip sourcemap upload when no token (local builds)
  sourcemaps: { disable: !process.env.SENTRY_AUTH_TOKEN },
  silent: true,
});
