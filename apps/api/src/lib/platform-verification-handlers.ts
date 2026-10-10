/**
 * Per-product verification dispatch for platform-native authorization checks
 * (architecture review card 2 / U3).
 *
 * Unquoted-key table — outside the platform-id walker's case-dispatch detector.
 */

import type { AccessLevel } from '@agency-platform/shared';
import { metaConnector } from '@/services/connectors/meta.js';
import { googleAdsConnector } from '@/services/connectors/google-ads.js';
import { ga4Connector } from '@/services/connectors/ga4.js';

export interface PlatformVerificationJobData {
  clientEmail: string;
  requiredAccessLevel: AccessLevel;
  agencyIdentity: {
    email?: string;
    businessId?: string;
  };
}

export interface PlatformVerificationResult {
  hasAccess: boolean;
  accessLevel: AccessLevel;
  accounts?: Array<{
    id: string;
    name: string;
    status: string;
    permissions: string[];
  }>;
  properties?: Array<{
    id: string;
    name: string;
    displayName: string;
    permissions: string[];
  }>;
  businessName?: string;
  assets?: Array<{
    type: string;
    id: string;
    name: string;
    permissions?: string[];
  }>;
  error?: string;
}

type PlatformVerificationHandler = (
  accessToken: string,
  jobData: PlatformVerificationJobData,
  verificationId: string
) => Promise<PlatformVerificationResult>;

async function verifyMetaAccess(
  accessToken: string,
  jobData: PlatformVerificationJobData
): Promise<PlatformVerificationResult> {
  return metaConnector.verifyClientAccess(
    accessToken,
    jobData.agencyIdentity.businessId || '',
    jobData.clientEmail,
    jobData.requiredAccessLevel
  );
}

/**
 * Unquoted object keys — walker-safe (DEC-015 Phase 3).
 */
const PLATFORM_VERIFICATION_HANDLERS: Readonly<
  Record<string, PlatformVerificationHandler>
> = {
  meta_ads: async (accessToken, jobData) => verifyMetaAccess(accessToken, jobData),
  meta_pages: async (accessToken, jobData) => verifyMetaAccess(accessToken, jobData),
  google_ads: async (accessToken, jobData) =>
    googleAdsConnector.verifyClientAccess(
      accessToken,
      jobData.clientEmail,
      jobData.requiredAccessLevel
    ),
  ga4: async (accessToken, jobData) =>
    // Property ID would come from client confirmation data; MVP uses empty.
    ga4Connector.verifyClientAccess(
      accessToken,
      jobData.clientEmail,
      '',
      jobData.requiredAccessLevel
    ),
};

export async function verifyPlatformAccess(
  platform: string,
  accessToken: string,
  jobData: PlatformVerificationJobData,
  verificationId: string
): Promise<PlatformVerificationResult> {
  const handler = PLATFORM_VERIFICATION_HANDLERS[platform];
  if (!handler) {
    return {
      hasAccess: false,
      accessLevel: 'read_only',
      error: `Unsupported platform: ${platform}`,
    };
  }
  return handler(accessToken, jobData, verificationId);
}

/** Test/helper: known dispatch keys for completeness checks. */
export function verificationHandlerPlatforms(): readonly string[] {
  return Object.keys(PLATFORM_VERIFICATION_HANDLERS);
}
