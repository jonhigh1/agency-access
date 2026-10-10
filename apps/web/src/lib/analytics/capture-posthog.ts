/**
 * Lazy-loads posthog-js so analytics does not compete with interaction (INP) on the main thread.
 * Captures are serialized through a shared queue so concurrent voided calls cannot drop events
 * during the first dynamic import (e.g. invite_link_copied + invite_sent on Copy Link).
 */
import type posthog from 'posthog-js';
import { sanitizeAnalyticsProperties } from '@agency-platform/shared';
import { withInviteFunnelProperties } from './invite-funnel-properties';

type PosthogClient = typeof posthog;

type PosthogCapture = {
  event: string;
  properties?: Record<string, unknown>;
};

let posthogModulePromise: Promise<PosthogClient> | null = null;
let captureChain: Promise<void> = Promise.resolve();

function loadPosthog(): Promise<PosthogClient> {
  posthogModulePromise ??= import('posthog-js').then((module) => module.default);
  return posthogModulePromise;
}

function enqueueCapture(task: (posthog: PosthogClient) => void): Promise<void> {
  const next = captureChain.then(async () => {
    try {
      const posthog = await loadPosthog();
      task(posthog);
    } catch {
      // Ignore analytics failures.
    }
  });

  captureChain = next.catch(() => undefined);
  return next;
}

function sanitizeCaptureProperties(
  properties?: Record<string, unknown>
): Record<string, unknown> | undefined {
  if (!properties) return undefined;
  return sanitizeAnalyticsProperties(properties);
}

export async function capturePosthogEvent(
  event: string,
  properties?: Record<string, unknown>
): Promise<void> {
  // Resolve funnel context at call time, not when the lazy import settles.
  const enriched = withInviteFunnelProperties(event, properties);
  await enqueueCapture((posthog) => {
    posthog.capture(event, sanitizeCaptureProperties(enriched));
  });
}

export async function capturePosthogEvents(events: PosthogCapture[]): Promise<void> {
  const enrichedEvents = events.map(({ event, properties }) => ({
    event,
    properties: withInviteFunnelProperties(event, properties),
  }));
  await enqueueCapture((posthog) => {
    for (const { event, properties } of enrichedEvents) {
      posthog.capture(event, sanitizeCaptureProperties(properties));
    }
  });
}

/** Test-only reset for module-level capture queue state. */
export function resetCapturePosthogForTests(): void {
  posthogModulePromise = null;
  captureChain = Promise.resolve();
}
