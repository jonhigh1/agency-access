import { beforeEach, describe, expect, it, vi } from 'vitest';

const { capturePosthogEventMock } = vi.hoisted(() => ({
  capturePosthogEventMock: vi.fn(),
}));

vi.mock('../capture-posthog', () => ({
  capturePosthogEvent: capturePosthogEventMock,
}));

import {
  trackPendingNudgeBannerShown,
  trackPendingNudgeBannerCta,
} from '../pending-nudge-events';

describe('pending-nudge-events', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('tracks pending_nudge_banner_shown with cliff and surface', () => {
    trackPendingNudgeBannerShown({
      access_request_id: 'req-1',
      access_request_token: 'token-1',
      cliff: '24h',
      surface: 'dashboard',
    });

    expect(capturePosthogEventMock).toHaveBeenCalledWith('pending_nudge_banner_shown', {
      access_request_id: 'req-1',
      access_request_token: 'token-1',
      cliff: '24h',
      surface: 'dashboard',
    });
  });

  it('tracks pending_nudge_banner_cta with action', () => {
    trackPendingNudgeBannerCta({
      access_request_id: 'req-2',
      access_request_token: 'token-2',
      cliff: '72h',
      surface: 'detail',
      cta: 'send_reminder',
    });

    expect(capturePosthogEventMock).toHaveBeenCalledWith('pending_nudge_banner_cta', {
      access_request_id: 'req-2',
      access_request_token: 'token-2',
      cliff: '72h',
      surface: 'detail',
      cta: 'send_reminder',
    });
  });
});
