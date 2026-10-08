import type { FastifyCorsOptions } from '@fastify/cors';

/**
 * Vercel preview deployments of the agency-access project on Jon's team. Only
 * the two URL shapes Vercel generates for this project are accepted:
 *
 * - Deployment URL: https://agency-access-<9-char hash>-jons-projects-1906288f.vercel.app
 * - Branch URL:     https://agency-access-git-<branch slug>-jons-projects-1906288f.vercel.app
 *   (e.g. the stable staging URL agency-access-git-staging-jons-projects-1906288f.vercel.app)
 *
 * Fully anchored and only honored when allowVercelPreviews is true
 * (CORS_ALLOW_VERCEL_PREVIEWS=true, staging only). Production leaves it off.
 * When CORS_PREVIEW_ORIGINS is set, only those exact origins are allowed instead.
 */
export const VERCEL_PREVIEW_ORIGIN_PATTERN =
  /^https:\/\/agency-access-(?:[a-z0-9]{9}|git-[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)-jons-projects-1906288f\.vercel\.app$/;

export function isVercelPreviewOrigin(origin: string): boolean {
  return VERCEL_PREVIEW_ORIGIN_PATTERN.test(origin);
}

/**
 * Validate an explicit preview allowlist (CORS_PREVIEW_ORIGINS). Every entry must be an
 * exact agency-access Vercel preview origin, so the list cannot be used to open CORS to
 * arbitrary hosts (use CORS_ALLOWED_ORIGINS for that).
 */
export function parseCorsPreviewOrigins(origins: string[]): string[] {
  const invalid = origins.filter((origin) => !isVercelPreviewOrigin(origin));
  if (invalid.length > 0) {
    throw new Error(
      `CORS_PREVIEW_ORIGINS entries must be agency-access Vercel preview origins ` +
        `(https://agency-access-git-<branch>-jons-projects-1906288f.vercel.app or ` +
        `https://agency-access-<hash>-jons-projects-1906288f.vercel.app); invalid: ${invalid.join(', ')}`
    );
  }
  return [...new Set(origins)];
}

export interface CorsOptionsConfig {
  /** Also allow agency-access Vercel preview origins. Default false. */
  allowVercelPreviews?: boolean;
  /**
   * Explicit preview origins (CORS_PREVIEW_ORIGINS). Only used when allowVercelPreviews is
   * true. When non-empty these exact origins replace VERCEL_PREVIEW_ORIGIN_PATTERN.
   */
  previewOrigins?: string[];
}

export function getCorsOptions(
  frontendUrl?: string,
  additionalOrigins: string[] = [],
  { allowVercelPreviews = false, previewOrigins = [] }: CorsOptionsConfig = {}
): FastifyCorsOptions {
  const previewAllowlist: (string | RegExp)[] = !allowVercelPreviews
    ? []
    : previewOrigins.length > 0
      ? parseCorsPreviewOrigins(previewOrigins)
      : [VERCEL_PREVIEW_ORIGIN_PATTERN];

  const allowedOrigins = [
    'http://localhost:3000',
    'https://www.authhub.co',
    'https://authhub.co',
    'https://review.authhub.co',
    frontendUrl,
    ...additionalOrigins,
  ]
    .filter((origin): origin is string => Boolean(origin))
    .filter((origin, index, self) => self.indexOf(origin) === index);

  const origin = [
    ...allowedOrigins,
    ...previewAllowlist.filter(
      (entry) => typeof entry !== 'string' || !allowedOrigins.includes(entry)
    ),
  ];

  return {
    origin,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-agency-id', 'X-Agency-Id'],
    exposedHeaders: ['x-cache', 'x-response-time', 'x-cache-hit-rate', 'server-timing'],
  };
}
