import * as Sentry from "@sentry/nextjs";
import {
  redactInviteTokensDeep,
  shouldRecordInviteReplay,
} from "./src/lib/analytics/sanitize-invite-token-properties";

Sentry.init({
  dsn:
    process.env.NEXT_PUBLIC_SENTRY_DSN ||
    "https://336d2646d3970e13ba997b0f41a0c8dd@o4511018218946560.ingest.us.sentry.io/4511018267574272",

  tracesSampleRate: process.env.NODE_ENV === "development" ? 1.0 : 0.1,

  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,

  enableLogs: true,

  beforeSend(event) {
    if (
      process.env.NODE_ENV === "development" &&
      process.env.SENTRY_SEND_IN_DEV !== "true"
    ) {
      return null;
    }
    // KTD13: the invite request token is a bearer credential in the URL path;
    // error events, breadcrumbs, and extras are scrubbed before they leave.
    return redactInviteTokensDeep(event);
  },

  environment: process.env.NODE_ENV || "development",
  release: process.env.NEXT_PUBLIC_APP_VERSION || undefined,
});

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
  typeof window !== "undefined" &&
  shouldRecordInviteReplay(window.location?.pathname ?? "/")
) {
  if (typeof requestIdleCallback === 'function') {
    requestIdleCallback(() => registerReplayIntegration(), { timeout: 4000 });
  } else {
    setTimeout(registerReplayIntegration, 1);
  }
}
