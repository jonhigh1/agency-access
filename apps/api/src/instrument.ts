/**
 * Sentry Instrumentation for Fastify Backend
 *
 * This file MUST be imported before any other modules to ensure
 * Sentry can capture errors from the entire application lifecycle.
 */

import * as Sentry from "@sentry/node";
import type { ErrorEvent, EventHint } from "@sentry/node";
import { nodeProfilingIntegration } from "@sentry/profiling-node";
import { redactSentryEvent, scrubSentryBreadcrumb } from "./lib/sentry-redaction.js";
import { resolveSentryEnvironment } from "./lib/sentry-environment.js";

// Get DSN from environment
const dsn = process.env.SENTRY_DSN || "https://336d2646d3970e13ba997b0f41a0c8dd@o4511018218946560.ingest.us.sentry.io/4511018267574272";

if (!dsn || dsn === "") {
  if (process.env.NODE_ENV === "production") {
    console.warn("[Sentry] SENTRY_DSN is missing. Error tracking disabled in production.");
  }
} else {
  // Don't initialize in development unless explicitly enabled
  const sendInDev = process.env.SENTRY_SEND_IN_DEV === "true";
  if (process.env.NODE_ENV !== "development" || sendInDev) {
    Sentry.init({
      dsn,

      // Add request headers and IP for users (for debugging)
      sendDefaultPii: true,

      // Integrations
      integrations: [
        // Add our Profiling integration
        nodeProfilingIntegration(),
      ],

      // Set tracesSampleRate to capture performance data
      // Adjust this in production based on your traffic volume
      tracesSampleRate: process.env.NODE_ENV === "development" ? 1.0 : 0.1,

      // Enable profiling for a percentage of sessions
      profileSessionSampleRate: process.env.NODE_ENV === "development" ? 1.0 : 0.1,

      // Enable logs to be sent to Sentry
      enableLogs: true,

      // Environment: SENTRY_ENVIRONMENT (e.g. "staging"), else NODE_ENV
      environment: resolveSentryEnvironment(process.env.SENTRY_ENVIRONMENT, process.env.NODE_ENV),

      // Release tracking for error correlation
      release: process.env.APP_VERSION || undefined,

      // Filter out sensitive data
      beforeSend(event: ErrorEvent, _hint: EventHint) {
        event = redactSentryEvent(event);

        // Filter user data
        if (event.user) {
          delete event.user.email;
          delete event.user.ip_address;
        }

        return event;
      },
      // Outgoing fetch/http breadcrumbs carry Graph URLs (ad account ids, tokens)
      beforeBreadcrumb(breadcrumb) {
        return scrubSentryBreadcrumb(breadcrumb);
      },
      beforeSendTransaction(event) {
        return redactSentryEvent(event);
      },
      beforeSendLog(log) {
        return redactSentryEvent(log);
      },
    });

    console.info("[Sentry] Error tracking initialized");
  } else {
    console.info(
      "[Sentry] Skipping initialization in development. Set SENTRY_SEND_IN_DEV=true to enable."
    );
  }
}

// Export for use in other parts of the app
export { Sentry };
