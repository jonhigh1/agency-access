import { z } from 'zod';

// Platforms a client may start an OAuth flow for. Shared by both the
// state-creation and exchange schemas so the accepted set cannot drift.
const clientOAuthPlatform = z.enum([
  'google',
  'meta',
  'meta_ads',
  'google_ads',
  'ga4',
  'linkedin',
  'instagram',
  'tiktok',
  'snapchat',
  'mailchimp',
  'pinterest',
  'klaviyo',
]);

export const submitIntakeSchema = z.object({
  intakeResponses: z.record(z.any()),
});

export const createOAuthStateSchema = z.object({
  platform: clientOAuthPlatform,
});

export const oauthExchangeSchema = z.object({
  code: z.string(),
  state: z.string(),
  platform: clientOAuthPlatform.optional(),
});

export const saveAssetsSchema = z.object({
  connectionId: z.string(),
  platform: z.string(),
  selectedAssets: z.object({
    adAccounts: z.array(z.string()).optional(),
    advertisers: z.array(z.string()).optional(),
    pages: z.array(z.string()).optional(),
    instagramAccounts: z.array(z.string()).optional(),
    properties: z.array(z.string()).optional(),
    businessAccounts: z.array(z.string()).optional(),
    containers: z.array(z.string()).optional(),
    sites: z.array(z.string()).optional(),
    merchantAccounts: z.array(z.string()).optional(),
    selectedBusinessCenterId: z.string().optional(),
    selectedAdvertiserIds: z.array(z.string()).optional(),
    availableAssetCount: z.number().int().nonnegative().optional(),
    availableBusinessCenters: z.array(z.any()).optional(),
    availableAdvertisers: z.array(z.any()).optional(),
  }),
});

export const grantPagesAccessSchema = z.object({
  connectionId: z.string(),
  pageIds: z.array(z.string()),
});

export const grantMetaAccessSchema = z.object({
  connectionId: z.string(),
  businessId: z.string().optional(),
  assetTypes: z
    .array(z.enum(['page', 'ad_account', 'instagram_account']))
    .optional(),
});

export const metaPreflightQuerySchema = z.object({
  connectionId: z.string().min(1),
  businessId: z.string().min(1).optional(),
});

export const manualMetaAdAccountShareSchema = z.object({
  connectionId: z.string(),
});

export const adAccountsSharedSchema = z.object({
  connectionId: z.string(),
  sharedAdAccountIds: z.array(z.string()).optional(),
});

export const tiktokPartnerShareSchema = z.object({
  connectionId: z.string(),
  advertiserIds: z.array(z.string()).optional(),
  selectedBusinessCenterId: z.string().optional(),
});

export const tiktokPartnerVerifySchema = z.object({
  connectionId: z.string(),
  advertiserIds: z.array(z.string()).optional(),
});

/**
 * Client Meta popup finalize schema.
 * Used when the client completes Meta JS SDK popup login (no config_id).
 * State must be created via POST /client/:token/oauth-state { platform: 'meta' } first.
 */
export const metaClientFinalizeSchema = z.object({
  state: z.string(),
  accessToken: z.string(),
  userId: z.string(),
  expiresIn: z.number().optional(),
  signedRequest: z.string().optional(),
  dataAccessExpirationTime: z.number().optional(),
});
