import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'

/**
 * Clerk Proxy (formerly Middleware)
 *
 * Protects routes and handles authentication redirects.
 * - Public routes: home, pricing, contact, blog, guides, compare, features, terms, privacy, authorize callback, invite flow, platform OAuth callback, PostHog ingest proxy
 * - Protected routes: dashboard, connections, clients, settings, access requests
 */

const isPublicRoute = createRouteMatcher([
  '/',
  '/pricing',
  '/contact',
  '/affiliate',
  '/blog',
  '/blog/(.*)',
  '/guides/(.*)',
  '/compare',
  '/compare/(.*)',
  '/features',
  '/features/(.*)',
  '/privacy-policy',
  '/about',
  '/terms',
  '/sign-in',
  '/sign-in/(.*)',
  '/sign-up',
  '/sign-up/(.*)',
  '/authorize/(.*)',
  '/client/(.*)',
  '/invite/(.*)',
  '/platforms/callback',
  '/onboarding/(.*)',
  '/r/(.*)',
  '/sitemap.xml',
  '/robots.txt',
  // PostHog reverse proxy (see rewrites in next.config.ts). Defense in depth:
  // the matcher below already excludes these paths so the middleware never runs.
  '/ingest',
  '/ingest/(.*)',
])

/** Marketing pages that should redirect authenticated users to the dashboard. */
const isMarketingRedirectRoute = createRouteMatcher(['/'])

const isInternalHarnessRoute = createRouteMatcher([
  '/design-system',
  '/dev/(.*)',
  '/perf/(.*)',
  '/test/(.*)',
  '/hero-copy-rewrite',
])

export default clerkMiddleware(async (auth, request) => {
  const isPerfHarnessRequest =
    process.env.NODE_ENV === 'development' &&
    request.headers.get('x-perf-harness') === '1'

  // Redirect users with an existing session cookie away from "/" without
  // triggering Clerk auth resolution on every home page request.
  if (isMarketingRedirectRoute(request)) {
    const hasSessionCookie = Boolean(request.cookies.get('__session')?.value)
    if (hasSessionCookie) {
      return NextResponse.redirect(new URL('/dashboard', request.url))
    }
    return
  }

  if (process.env.NODE_ENV === 'production' && isInternalHarnessRoute(request)) {
    return new Response(null, { status: 404 })
  }

  // Skip auth check for other public routes
  if (isPublicRoute(request)) {
    return
  }

  // Skip auth check in development bypass mode
  if (process.env.NEXT_PUBLIC_BYPASS_AUTH === 'true' && process.env.NODE_ENV === 'development') {
    return
  }

  if (isPerfHarnessRequest) {
    return
  }

  // Protect all other routes
  await auth.protect()
})

export const config = {
  matcher: [
    // Skip Next.js internals, static files, API routes, crawler files (sitemap.xml, robots.txt),
    // and the PostHog ingest proxy (`ingest(?:/|$)` so /ingest-notes stays protected — its rewrite
    // lives in next.config.ts and must not pass through clerkMiddleware/auth.protect()).
    '/((?!_next|api|agency-platforms|ingest(?:/|$)|sitemap\\.xml|robots\\.txt|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
  ],
}
