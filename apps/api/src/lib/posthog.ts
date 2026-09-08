/**
 * Server-side PostHog capture for webhook-driven lifecycle events.
 * Uses the HTTP capture API — no client token is ever sent as a custom property.
 */

import { env } from '@/lib/env.js';

type ServerCaptureProps = Record<string, unknown>;

let warnedMissingKey = false;

function getPosthogConfig(): { apiKey: string; host: string } | null {
  const apiKey = env.POSTHOG_API_KEY?.trim();
  if (!apiKey) {
    if (env.NODE_ENV !== 'test' && !warnedMissingKey) {
      warnedMissingKey = true;
      console.warn('[PostHog] POSTHOG_API_KEY is not set; server billing events will be skipped.');
    }
    return null;
  }

  const host = (env.POSTHOG_HOST ?? 'https://us.i.posthog.com').replace(/\/$/, '');
  return { apiKey, host };
}

export async function captureServerPosthogEvent(input: {
  distinctId: string;
  event: string;
  properties?: ServerCaptureProps;
}): Promise<void> {
  const config = getPosthogConfig();
  if (!config) return;

  try {
    const response = await fetch(`${config.host}/capture/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: config.apiKey,
        event: input.event,
        distinct_id: input.distinctId,
        properties: input.properties ?? {},
      }),
    });

    if (!response.ok) {
      console.warn(`[PostHog] capture failed (${response.status}) for ${input.event}`);
    }
  } catch (error) {
    console.warn('[PostHog] capture error:', error);
  }
}
