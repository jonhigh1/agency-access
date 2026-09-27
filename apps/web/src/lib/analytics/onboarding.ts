import { capturePosthogEvent } from '@/lib/analytics/capture-posthog';
import { omitSensitiveTokenProperties } from '@/lib/analytics/omit-sensitive-token-properties';

type OnboardingEventProperties = Record<string, unknown>;

/**
 * PostHog adds `properties.token` (phc_ project key) on every event for ingestion.
 * Never send bearer values in analytics. Use stable IDs for event correlation.
 */
export function trackOnboardingEvent(
  eventName: string,
  properties: OnboardingEventProperties
) {
  const captureProperties = omitSensitiveTokenProperties(properties);
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
