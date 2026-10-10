import { beforeEach, describe, expect, it, vi } from 'vitest';

const metaVerify = vi.fn();
const googleAdsVerify = vi.fn();
const ga4Verify = vi.fn();

vi.mock('@/services/connectors/meta.js', () => ({
  metaConnector: { verifyClientAccess: (...args: unknown[]) => metaVerify(...args) },
}));

vi.mock('@/services/connectors/google-ads.js', () => ({
  googleAdsConnector: { verifyClientAccess: (...args: unknown[]) => googleAdsVerify(...args) },
}));

vi.mock('@/services/connectors/ga4.js', () => ({
  ga4Connector: { verifyClientAccess: (...args: unknown[]) => ga4Verify(...args) },
}));

import {
  verificationHandlerPlatforms,
  verifyPlatformAccess,
} from '../platform-verification-handlers.js';

const jobData = {
  clientEmail: 'client@example.com',
  requiredAccessLevel: 'manage' as const,
  agencyIdentity: { businessId: 'bm-1', email: 'agency@example.com' },
};

describe('verifyPlatformAccess', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    metaVerify.mockResolvedValue({ hasAccess: true, accessLevel: 'manage' });
    googleAdsVerify.mockResolvedValue({ hasAccess: true, accessLevel: 'manage' });
    ga4Verify.mockResolvedValue({ hasAccess: true, accessLevel: 'manage' });
  });

  it('dispatches meta_ads and meta_pages through the Meta connector', async () => {
    await verifyPlatformAccess('meta_ads', 'token', jobData, 'v1');
    await verifyPlatformAccess('meta_pages', 'token', jobData, 'v2');

    expect(metaVerify).toHaveBeenCalledTimes(2);
    expect(metaVerify).toHaveBeenCalledWith('token', 'bm-1', 'client@example.com', 'manage');
    expect(googleAdsVerify).not.toHaveBeenCalled();
  });

  it('dispatches google_ads through the Google Ads connector', async () => {
    await verifyPlatformAccess('google_ads', 'token', jobData, 'v1');
    expect(googleAdsVerify).toHaveBeenCalledWith('token', 'client@example.com', 'manage');
  });

  it('dispatches ga4 through the GA4 connector', async () => {
    await verifyPlatformAccess('ga4', 'token', jobData, 'v1');
    expect(ga4Verify).toHaveBeenCalledWith('token', 'client@example.com', '', 'manage');
  });

  it('returns unsupported for unknown platforms', async () => {
    await expect(verifyPlatformAccess('tiktok', 'token', jobData, 'v1')).resolves.toEqual({
      hasAccess: false,
      accessLevel: 'read_only',
      error: 'Unsupported platform: tiktok',
    });
  });

  it('exposes the four dispatched product keys', () => {
    expect(verificationHandlerPlatforms().sort()).toEqual(
      ['ga4', 'google_ads', 'meta_ads', 'meta_pages'].sort()
    );
  });
});
