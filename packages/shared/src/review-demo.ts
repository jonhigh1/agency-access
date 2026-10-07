import { z } from 'zod';
import { META_CORE_PERMISSIONS } from './types.js';

export const META_REVIEW_DEMO_PERMISSIONS = [...META_CORE_PERMISSIONS] as const;
export type MetaReviewDemoPermission = (typeof META_REVIEW_DEMO_PERMISSIONS)[number];

export const MetaReviewDemoPermissionSchema = z.enum(META_REVIEW_DEMO_PERMISSIONS);

export const REVIEW_DEMO_STEP_ORDER = [
  'pages_show_list',
  'pages_read_engagement',
  'ads_management',
  'business_management',
] as const satisfies readonly MetaReviewDemoPermission[];

export type ReviewDemoStepId = (typeof REVIEW_DEMO_STEP_ORDER)[number];

export const ReviewDemoStepIdSchema = z.enum(REVIEW_DEMO_STEP_ORDER);

export const REVIEW_DEMO_STEP_LABELS: Record<ReviewDemoStepId, string> = {
  pages_show_list: 'pages_show_list',
  pages_read_engagement: 'pages_read_engagement',
  ads_management: 'ads_management',
  business_management: 'business_management',
};

export interface LabReviewPublicMetadata {
  labRole?: 'reviewer' | 'agency' | string;
  lab?: boolean;
}

export function isLabReviewPublicMetadata(value: unknown): value is LabReviewPublicMetadata {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function hasLabReviewAccess(metadata: unknown): boolean {
  if (!isLabReviewPublicMetadata(metadata)) {
    return false;
  }
  if (metadata.lab === true) {
    return true;
  }
  const role = metadata.labRole;
  return role === 'reviewer' || role === 'agency';
}

export const ReviewDemoIdentitySchema = z.object({
  id: z.string(),
  name: z.string(),
  pictureUrl: z.string().url().optional(),
});

export type ReviewDemoIdentity = z.infer<typeof ReviewDemoIdentitySchema>;

export const ReviewDemoPageSchema = z.object({
  id: z.string(),
  name: z.string(),
  pictureUrl: z.string().url().optional(),
});

export const ReviewDemoPageEngagementPageSchema = z.object({
  id: z.string(),
  name: z.string(),
  category: z.string().optional(),
  managedTasks: z.array(z.string()),
  fanCount: z.number().optional(),
  followerCount: z.number().optional(),
});

export const ReviewDemoPageEngagementPostSchema = z.object({
  id: z.string(),
  createdTime: z.string().optional(),
});

export const ReviewDemoPageFeedErrorSchema = z.object({
  code: z.number().optional(),
  errorSubcode: z.number().optional(),
  message: z.string(),
  type: z.string().optional(),
  fbtraceId: z.string().optional(),
  displayMessage: z.string(),
});

export const ReviewDemoConnectedInstagramSchema = z.object({
  id: z.string(),
  username: z.string(),
});

export const ReviewDemoAgencyPartnerSchema = z.object({
  businessId: z.string(),
  name: z.string().optional(),
  permittedTasks: z.array(z.string()),
  verified: z.boolean(),
  metaErrorCode: z.number().optional(),
  metaErrorMessage: z.string().optional(),
  pendingMessage: z.string().optional(),
});

export const ReviewDemoBusinessAssetSchema = z.object({
  id: z.string(),
  name: z.string(),
  kind: z.enum(['business', 'page', 'ad_account']),
});

export const ReviewDemoEmptyStateSchema = z.object({
  code: z.enum(['no_pages', 'no_page_selected', 'no_ad_accounts', 'no_business', 'graph_error']),
  message: z.string(),
});

export type ReviewDemoEmptyState = z.infer<typeof ReviewDemoEmptyStateSchema>;

export const ReviewDemoMetaGraphErrorSchema = z.object({
  code: z.number().optional(),
  errorSubcode: z.number().optional(),
  message: z.string(),
  type: z.string().optional(),
  fbtraceId: z.string().optional(),
  rawBody: z.string().optional(),
});

export type ReviewDemoMetaGraphError = z.infer<typeof ReviewDemoMetaGraphErrorSchema>;

export const ReviewDemoPagePartnerResultSchema = ReviewDemoAgencyPartnerSchema.extend({
  assetId: z.string(),
  assetKind: z.literal('page'),
  granted: z.boolean().optional(),
  graphError: ReviewDemoMetaGraphErrorSchema.optional(),
  rawGraphResponse: z.string().optional(),
});

export type ReviewDemoPagePartnerResult = z.infer<typeof ReviewDemoPagePartnerResultSchema>;

export const ReviewDemoStepPayloadSchema = z.discriminatedUnion('stepId', [
  z.object({
    stepId: z.literal('pages_show_list'),
    pages: z.array(ReviewDemoPageSchema),
    emptyState: ReviewDemoEmptyStateSchema.optional(),
    graphCaptions: z.array(z.string()),
  }),
  z.object({
    stepId: z.literal('pages_read_engagement'),
    page: ReviewDemoPageEngagementPageSchema.optional(),
    posts: z.array(ReviewDemoPageEngagementPostSchema),
    emptyState: ReviewDemoEmptyStateSchema.optional(),
    feedError: ReviewDemoPageFeedErrorSchema.optional(),
    connectedInstagram: ReviewDemoConnectedInstagramSchema.optional(),
    graphCaptions: z.array(z.string()),
  }),
  z.object({
    stepId: z.literal('ads_management'),
    adAccountId: z.string().optional(),
    adAccountName: z.string().optional(),
    emptyState: ReviewDemoEmptyStateSchema.optional(),
    agencyPartner: ReviewDemoAgencyPartnerSchema,
    graphCaptions: z.array(z.string()),
  }),
  z.object({
    stepId: z.literal('business_management'),
    business: ReviewDemoBusinessAssetSchema.optional(),
    assets: z.array(ReviewDemoBusinessAssetSchema),
    sandboxMisconfigured: z.boolean().optional(),
    sandboxMisconfiguredMessage: z.string().optional(),
    emptyState: ReviewDemoEmptyStateSchema.optional(),
    agencyPartner: ReviewDemoAgencyPartnerSchema.extend({
      assetId: z.string(),
      assetKind: z.literal('ad_account'),
    }),
    pagePartner: ReviewDemoPagePartnerResultSchema.optional(),
    stepCaption: z.string().optional(),
    graphCaptions: z.array(z.string()),
  }),
]);

export type ReviewDemoStepPayload = z.infer<typeof ReviewDemoStepPayloadSchema>;

export const ReviewDemoSessionSchema = z.object({
  connected: z.boolean(),
  identity: ReviewDemoIdentitySchema.nullable(),
  grantedPermissions: z.array(MetaReviewDemoPermissionSchema),
  activeStep: ReviewDemoStepIdSchema,
  stepIndex: z.number().int().min(0),
  stepCount: z.number().int().positive(),
  sandbox: z.object({
    businessManagerId: z.string(),
    adAccountId: z.string(),
    pageId: z.string(),
    agencyBusinessId: z.string(),
  }),
  usesSandboxAssets: z.boolean(),
});

export type ReviewDemoSession = z.infer<typeof ReviewDemoSessionSchema>;

/** Default partner tasks for review-lab ad account agency share (matches production defaults). */
export const REVIEW_DEMO_AD_ACCOUNT_PARTNER_TASKS = ['ADVERTISE', 'ANALYZE'] as const;

/** Meta user id for the AuthHub review-lab sandbox Facebook account (Alex). */
export const META_REVIEW_DEFAULT_SANDBOX_META_USER_ID = '61595281164997';

/** Infisical plain-secret name for the isolated Marketing API tier cron token. */
export const META_TIER_CRON_TOKEN_SECRET_NAME = 'meta_tier_cron_token';

/** Page partner tasks for review-demo Page POST (matches production Page agency partner grant). */
export const REVIEW_DEMO_PAGE_PARTNER_TASKS = [
  'MANAGE',
  'CREATE_CONTENT',
  'MODERATE',
  'ADVERTISE',
] as const;
