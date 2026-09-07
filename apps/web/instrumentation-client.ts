import posthog from 'posthog-js';

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
      capture_pageview: true,
      capture_pageleave: true,
      debug: process.env.NODE_ENV === 'development',
    });
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
