/**
 * Lazy-loads posthog-js so analytics does not compete with interaction (INP) on the main thread.
 * Captures are serialized through a shared queue so concurrent voided calls cannot drop events
 * during the first dynamic import (e.g. invite_link_copied + invite_sent on Copy Link).
 */
import type posthog from 'posthog-js';

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

export async function capturePosthogEvent(
  event: string,
  properties?: Record<string, unknown>
): Promise<void> {
  await enqueueCapture((posthog) => {
    posthog.capture(event, properties);
  });
}

export async function capturePosthogEvents(events: PosthogCapture[]): Promise<void> {
  await enqueueCapture((posthog) => {
    for (const { event, properties } of events) {
      posthog.capture(event, properties);
    }
  });
}

/** Test-only reset for module-level capture queue state. */
export function resetCapturePosthogForTests(): void {
  posthogModulePromise = null;
  captureChain = Promise.resolve();
}
