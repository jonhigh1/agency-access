import { capturePosthogEvent } from '@/lib/analytics/capture-posthog';
import { omitCustomTokenProperty } from '@/lib/analytics/omit-custom-token-property';

type OnboardingEventProperties = Record<string, unknown>;

/**
 * PostHog adds `properties.token` (phc_ project key) on every event for ingestion.
 * Never pass a custom `token` prop — use `access_request_token` / `accessRequestId`.
 */
export function trackOnboardingEvent(
  eventName: string,
  properties: OnboardingEventProperties
) {
  const captureProperties = omitCustomTokenProperty(properties);
  void capturePosthogEvent(eventName, captureProperties);

  if (typeof window === 'undefined') {
    return;
  }

  const legacyAnalytics = (window as any).analytics;
  if (typeof legacyAnalytics?.track !== 'function') {
    return;
  }

  try {
    legacyAnalytics.track(eventName, captureProperties);
  } catch {
    // Non-blocking analytics path.
  }
}
