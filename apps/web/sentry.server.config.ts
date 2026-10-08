import * as Sentry from "@sentry/nextjs";
import { resolveSentryEnvironment } from "./src/lib/sentry-environment";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN || "https://336d2646d3970e13ba997b0f41a0c8dd@o4511018218946560.ingest.us.sentry.io/4511018267574272",

  // Set tracesSampleRate to 1.0 to capture 100%
  // of transactions for performance monitoring.
  // We recommend adjusting this value in production
  tracesSampleRate: process.env.NODE_ENV === "development" ? 1.0 : 0.1,
  // Enable logs to be sent to Sentry
  enableLogs: true,

  // Filter out sensitive data
  beforeSend(event, hint) {
    // Don't send events in development unless explicitly enabled
    if (process.env.NODE_ENV === "development" && process.env.SENTRY_SEND_IN_DEV !== "true") {
      return null;
    }

    // Filter out sensitive data from request headers
    if (event.request?.headers) {
      const { authorization, cookie, ...safeHeaders } = event.request.headers;
      event.request.headers = safeHeaders;
    }

    return event;
  },

  // Environment
  // SENTRY_ENVIRONMENT (e.g. "staging"), else NODE_ENV.
  environment: resolveSentryEnvironment(
    process.env.SENTRY_ENVIRONMENT,
    process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT,
    process.env.NODE_ENV
  ),

  // Release tracking for error correlation
  release: process.env.NEXT_PUBLIC_APP_VERSION || undefined,
});
