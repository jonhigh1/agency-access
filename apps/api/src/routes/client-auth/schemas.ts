import { z } from 'zod';

// Platforms a client may start an OAuth flow for. Shared by both the
// state-creation and exchange schemas so the accepted set cannot drift.
const clientOAuthPlatform = z.enum([
  'google',
  'meta',
  'meta_ads',
  'meta_pages',
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
  intakeResponses: z.record(z.string().max(10_000)).refine(
    (responses) => Object.keys(responses).length <= 50,
    'Too many intake responses'
  ),
});

export const createOAuthStateSchema = z.object({
  platform: clientOAuthPlatform,
  presentation: z.enum(['redirect', 'popup']).optional(),
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
    // Client-controlled claim (KTD5): the route validates it against the
    // business this connection's platform token can actually see.
    selectedBusinessId: z.string().optional(),
    adAccounts: z.array(z.string()).optional(),
    advertisers: z.array(z.string()).optional(),
    pages: z.array(z.string()).optional(),
    instagramAccounts: z.array(z.string()).optional(),
    catalogs: z.array(z.string()).optional(),
    datasets: z.array(z.string()).optional(),
    selectedPagesWithNames: z.array(z.object({ id: z.string(), name: z.string() })).optional(),
    selectedAdAccountsWithNames: z.array(z.object({ id: z.string(), name: z.string() })).optional(),
    selectedInstagramWithNames: z.array(z.object({ id: z.string(), name: z.string() })).optional(),
    selectedCatalogsWithNames: z.array(z.object({ id: z.string(), name: z.string() })).optional(),
    selectedDatasetsWithNames: z.array(z.object({ id: z.string(), name: z.string() })).optional(),
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

export const grantMetaAccessSchema = z.object({
  connectionId: z.string(),
  businessId: z.string().optional(),
  assetTypes: z
    .array(z.enum(['page', 'ad_account', 'instagram_account', 'catalog', 'dataset']))
    .optional(),
});

export const metaPreflightQuerySchema = z.object({
  connectionId: z.string().min(1),
  businessId: z.string().min(1).optional(),
});

export const manualMetaAdAccountShareSchema = z.object({
  connectionId: z.string(),
});

export const manualMetaDatasetVerifySchema = z.object({
  connectionId: z.string().min(1),
  datasetIds: z.array(z.string().min(1)),
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
