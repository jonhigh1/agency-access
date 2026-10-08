import { FastifyCorsOptions } from '@fastify/cors';

/**
 * Vercel preview deployments of the agency-access project on Jon's team, e.g.
 * https://agency-access-abc123def-jons-projects-1906288f.vercel.app or
 * https://agency-access-git-staging-jons-projects-1906288f.vercel.app.
 *
 * Fully anchored and only honored when allowVercelPreviews is true
 * (CORS_ALLOW_VERCEL_PREVIEWS=true, staging only). Production leaves it off.
 */
export const VERCEL_PREVIEW_ORIGIN_PATTERN =
  /^https:\/\/agency-access-[a-z0-9-]+-jons-projects-1906288f\.vercel\.app$/;

export interface CorsOptionsConfig {
  /** Also allow Vercel preview origins matching VERCEL_PREVIEW_ORIGIN_PATTERN. Default false. */
  allowVercelPreviews?: boolean;
}

export function getCorsOptions(
  frontendUrl?: string,
  additionalOrigins: string[] = [],
  { allowVercelPreviews = false }: CorsOptionsConfig = {}
): FastifyCorsOptions {
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

  return {
    origin: allowVercelPreviews
      ? [...allowedOrigins, VERCEL_PREVIEW_ORIGIN_PATTERN]
      : allowedOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-agency-id', 'X-Agency-Id'],
    exposedHeaders: ['x-cache', 'x-response-time', 'x-cache-hit-rate', 'server-timing'],
  };
}
