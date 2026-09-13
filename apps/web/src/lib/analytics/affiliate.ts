import { capturePosthogEvent } from '@/lib/analytics/capture-posthog';

type AffiliateEventProperties = Record<string, unknown>;

export function trackAffiliateEvent(
  eventName: string,
  properties: AffiliateEventProperties
) {
  void capturePosthogEvent(eventName, properties);

  if (typeof window === 'undefined') {
    return;
  }

  const legacyAnalytics = (window as any).analytics;
  if (typeof legacyAnalytics?.track !== 'function') {
    return;
  }

  try {
    legacyAnalytics.track(eventName, properties);
  } catch {
    // Non-blocking analytics path.
  }
}
