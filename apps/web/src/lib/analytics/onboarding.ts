import posthog from 'posthog-js';

import { stripPhcTokenProperty } from '@/lib/analytics/strip-phc-token';

type OnboardingEventProperties = Record<string, unknown>;

export function trackOnboardingEvent(
  eventName: string,
  properties: OnboardingEventProperties
) {
  const sanitizedProperties = stripPhcTokenProperty(properties);

  try {
    posthog.capture(eventName, sanitizedProperties);
  } catch {
    // Non-blocking analytics path.
  }

  if (typeof window === 'undefined') {
    return;
  }

  const legacyAnalytics = (window as any).analytics;
  if (typeof legacyAnalytics?.track !== 'function') {
    return;
  }

  try {
    legacyAnalytics.track(eventName, sanitizedProperties);
  } catch {
    // Non-blocking analytics path.
  }
}
