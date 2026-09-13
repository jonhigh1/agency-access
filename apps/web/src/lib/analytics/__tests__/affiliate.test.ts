import { beforeEach, describe, expect, it, vi } from 'vitest';

const { captureMock } = vi.hoisted(() => ({
  captureMock: vi.fn(),
}));

vi.mock('@/lib/analytics/capture-posthog', () => ({
  capturePosthogEvent: captureMock,
}));

import { trackAffiliateEvent } from '../affiliate';

describe('trackAffiliateEvent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete (window as any).analytics;
  });

  it('captures affiliate events in PostHog', () => {
    trackAffiliateEvent('affiliate_page_viewed', {
      surface: 'affiliate_program',
    });

    expect(captureMock).toHaveBeenCalledWith('affiliate_page_viewed', {
      surface: 'affiliate_program',
    });
  });

  it('forwards affiliate events to legacy analytics when available', () => {
    const legacyTrack = vi.fn();
    (window as any).analytics = { track: legacyTrack };

    trackAffiliateEvent('affiliate_checkout_started', {
      surface: 'billing_checkout',
      targetTier: 'STARTER',
    });

    expect(legacyTrack).toHaveBeenCalledWith('affiliate_checkout_started', {
      surface: 'billing_checkout',
      targetTier: 'STARTER',
    });
  });
});
