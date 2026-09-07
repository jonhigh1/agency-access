import { beforeEach, describe, expect, it, vi } from 'vitest';

const { captureMock } = vi.hoisted(() => ({
  captureMock: vi.fn(),
}));

vi.mock('posthog-js', () => ({
  default: {
    capture: captureMock,
  },
}));

import { trackOnboardingEvent } from '../onboarding';

describe('trackOnboardingEvent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete (window as any).analytics;
  });

  it('captures onboarding events in PostHog', () => {
    trackOnboardingEvent('onboarding_started', {
      version: 'unified_v1',
      userId: 'user_123',
    });

    expect(captureMock).toHaveBeenCalledWith('onboarding_started', {
      version: 'unified_v1',
      userId: 'user_123',
    });
  });

  it('forwards events to legacy analytics when available', () => {
    const legacyTrack = vi.fn();
    (window as any).analytics = { track: legacyTrack };

    trackOnboardingEvent('first_access_link_generated', {
      accessRequestId: 'req_123',
      timeToValueMs: 1234,
    });

    expect(captureMock).toHaveBeenCalledWith('first_access_link_generated', {
      accessRequestId: 'req_123',
      timeToValueMs: 1234,
    });
    expect(legacyTrack).toHaveBeenCalledWith('first_access_link_generated', {
      accessRequestId: 'req_123',
      timeToValueMs: 1234,
    });
  });

  it('omits custom token prop from first_access_link_generated before capture', () => {
    trackOnboardingEvent('first_access_link_generated', {
      accessRequestId: 'req_123',
      access_request_token: 'unique-access-token',
      token: 'phc_BF0Pleaked_project_key',
      timeToValueMs: 1234,
    });

    expect(captureMock).toHaveBeenCalledWith('first_access_link_generated', {
      accessRequestId: 'req_123',
      access_request_token: 'unique-access-token',
      timeToValueMs: 1234,
    });
    expect(captureMock.mock.calls[0]?.[1]).not.toHaveProperty('token');
  });
});
