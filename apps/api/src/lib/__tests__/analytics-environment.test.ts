import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  analyticsEnvironmentProperties,
  resolveAnalyticsEnvironment,
} from '@/lib/analytics-environment';

const mockEnv = vi.hoisted(() => ({
  NODE_ENV: 'test',
  POSTHOG_API_KEY: 'phc_test_key' as string | undefined,
  POSTHOG_HOST: 'https://posthog.example.com' as string | undefined,
  APP_ENV: undefined as string | undefined,
}));

vi.mock('@/lib/env.js', () => ({ env: mockEnv }));

describe('resolveAnalyticsEnvironment', () => {
  it('returns null for unset, blank or production (prod unchanged)', () => {
    for (const raw of [undefined, null, '', '  ', 'production', 'Production ']) {
      expect(resolveAnalyticsEnvironment(raw)).toBeNull();
      expect(analyticsEnvironmentProperties(raw)).toEqual({});
    }
  });

  it('returns the normalized label otherwise', () => {
    expect(resolveAnalyticsEnvironment(' Staging ')).toBe('staging');
    expect(analyticsEnvironmentProperties('staging')).toEqual({ environment: 'staging' });
  });
});

describe('captureServerPosthogEvent environment property', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    fetchMock.mockResolvedValue({ ok: true, status: 200 });
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    mockEnv.APP_ENV = undefined;
  });

  async function sentProperties(properties?: Record<string, unknown>) {
    const { captureServerPosthogEvent } = await import('@/lib/posthog');
    await captureServerPosthogEvent({ distinctId: 'agency-1', event: 'subscription_started', properties });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    return JSON.parse(fetchMock.mock.calls[0][1].body).properties;
  }

  it('adds no environment property when APP_ENV is unset', async () => {
    expect(await sentProperties({ tier: 'STARTER' })).toEqual({ tier: 'STARTER' });
  });

  it('adds no environment property when APP_ENV=production', async () => {
    mockEnv.APP_ENV = 'production';
    expect(await sentProperties({ tier: 'STARTER' })).toEqual({ tier: 'STARTER' });
  });

  it('tags events with environment when APP_ENV=staging, letting explicit props win', async () => {
    mockEnv.APP_ENV = 'staging';
    expect(await sentProperties({ tier: 'STARTER' })).toEqual({ environment: 'staging', tier: 'STARTER' });
    fetchMock.mockClear();
    expect(await sentProperties({ environment: 'override' })).toEqual({ environment: 'override' });
  });
});
