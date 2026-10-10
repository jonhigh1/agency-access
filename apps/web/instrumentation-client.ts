import * as Sentry from '@sentry/nextjs';
import posthog from 'posthog-js';
import { resolveSentryEnvironment } from '@/lib/sentry-environment';
import { resolveSentryRelease } from '@/lib/sentry-release';
import {
  redactInviteTokensDeep,
  shouldRecordInviteReplay,
} from '@/lib/analytics/sanitize-invite-token-properties';
import { analyticsEnvironmentProperties } from '@/lib/analytics/app-environment';
import { sanitizeAnalyticsProperties } from '@agency-platform/shared';
import { registerPosthogIdentityClient } from '@/lib/analytics/posthog-identity';

/**
 * Client Sentry init must live here (not sentry.client.config.ts).
 * Under Turbopack, sentry.client.config.* is no longer loaded by @sentry/nextjs.
 */
Sentry.init({
  dsn:
    process.env.NEXT_PUBLIC_SENTRY_DSN ||
    'https://336d2646d3970e13ba997b0f41a0c8dd@o4511018218946560.ingest.us.sentry.io/4511018267574272',

  tracesSampleRate: process.env.NODE_ENV === 'development' ? 1.0 : 0.1,

  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,

  enableLogs: true,

  beforeSend(event) {
    if (
      process.env.NODE_ENV === 'development' &&
      process.env.SENTRY_SEND_IN_DEV !== 'true'
    ) {
      return null;
    }
    // KTD13: the invite request token is a bearer credential in the URL path;
    // error events, breadcrumbs, and extras are scrubbed before they leave.
    return redactInviteTokensDeep(event);
  },

  // Browser bundle: only NEXT_PUBLIC_* is inlined, so staging sets NEXT_PUBLIC_SENTRY_ENVIRONMENT.
  environment: resolveSentryEnvironment(
    process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT,
    process.env.NODE_ENV
  ),
  release: resolveSentryRelease(
    process.env.NEXT_PUBLIC_APP_VERSION,
    process.env.NEXT_PUBLIC_SENTRY_RELEASE
  ),
});

/** Required by @sentry/nextjs for App Router navigation instrumentation. */
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;

function registerReplayIntegration() {
  void Sentry.lazyLoadIntegration('replayIntegration')
    .then((replayIntegration) => {
      Sentry.addIntegration(replayIntegration());
    })
    .catch(() => {
      // Replay is optional; error reporting still works without it.
    });
}

// KTD13: replays record the URL bar verbatim, so capture never registers on
// the /invite tree (tokened pages and the oauth-callback sibling).
if (
  typeof window !== 'undefined' &&
  shouldRecordInviteReplay(window.location?.pathname ?? '/')
) {
  if (typeof requestIdleCallback === 'function') {
    requestIdleCallback(() => registerReplayIntegration(), { timeout: 4000 });
  } else {
    setTimeout(registerReplayIntegration, 1);
  }
}

/**
 * Deferred PostHog Initialization
 *
 * Follows the official JS library setup: https://posthog.com/docs/libraries/js
 *
 * - Initialization is deferred via requestIdleCallback to avoid blocking FCP.
 * - In development, events are not sent unless NEXT_PUBLIC_POSTHOG_SEND_IN_DEV=true
 *   (avoids polluting production analytics with local test data).
 * - Uses /ingest proxy (see next.config.ts) to reduce ad-blocker impact.
 *
 * PostHog JS sets `properties.token` to the project API key (phc_…) on every captured
 * event for ingestion auth. HogQL exposes this as properties.token on all events
 * (pageview, onboarding_started, etc.) — it is not a custom app property. Funnels
 * must use `access_request_token` or `accessRequestId`, never properties.token.
 *
 * KTD13: invite URLs carry an anonymous bearer token on a logged-out visit.
 * before_send runs on EVERY captured event (pageviews and explicit captures),
 * and explicit captures), replacing the `/invite/<token>` path segment with a
 * redaction marker in $current_url, $pathname, $referrer, and any other
 * string property. The invite pages also set referrer: 'no-referrer' so the
 * token never leaves the browser via the Referer header either.
 */
function initPosthog() {
  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  if (!key || key === '') {
    if (process.env.NODE_ENV === 'development') {
      console.warn(
        '[PostHog] NEXT_PUBLIC_POSTHOG_KEY is missing. Add it to .env.local and restart the dev server. Events will not be sent.'
      );
    }
    return;
  }

  const host = typeof window !== 'undefined' ? window.location?.host ?? '' : '';
  const isLocalhost =
    host.includes('127.0.0.1') || host.includes('localhost');
  const sendInDev = process.env.NEXT_PUBLIC_POSTHOG_SEND_IN_DEV === 'true';
  if (process.env.NODE_ENV === 'development' && isLocalhost && !sendInDev) {
    console.info(
      '[PostHog] Skipping init on localhost. Set NEXT_PUBLIC_POSTHOG_SEND_IN_DEV=true to send events in development.'
    );
    return;
  }

  try {
    posthog.init(key, {
      api_host: '/ingest',
      ui_host: 'https://us.posthog.com',
      persistence: 'localStorage',
      capture_pageview: 'history_change',
      capture_pageleave: true,
      autocapture: false,
      disable_session_recording: true,
      capture_exceptions: false,
      debug: process.env.NODE_ENV === 'development',
      before_send: (event) => {
        if (!event) return null;
        event.properties = sanitizeAnalyticsProperties(event.properties, true);
        return event;
      },
      loaded: registerPosthogIdentityClient,
    });
    // Staging/preview builds tag every event with `environment`; prod (unset or
    // "production") registers nothing, so its events are unchanged.
    const environmentProperties = analyticsEnvironmentProperties(process.env.NEXT_PUBLIC_APP_ENV);
    if (Object.keys(environmentProperties).length > 0) {
      posthog.register(environmentProperties);
    }
  } catch (e) {
    if (process.env.NODE_ENV === 'development') {
      console.warn('[PostHog] Initialization failed:', e);
    }
  }
}

// Use requestIdleCallback if available, otherwise use setTimeout
if (typeof requestIdleCallback !== 'undefined') {
  requestIdleCallback(() => initPosthog(), { timeout: 3000 });
} else {
  // Fallback for browsers that don't support requestIdleCallback
  setTimeout(() => initPosthog(), 100);
}

// IMPORTANT: Never combine this approach with other client-side PostHog initialization approaches,
// especially components like a PostHogProvider. instrumentation-client.ts is the correct solution
// for initializing client-side PostHog in Next.js 15.3+ apps.
