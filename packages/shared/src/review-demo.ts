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

export const ReviewDemoStepPayloadSchema = z.discriminatedUnion('stepId', [
  z.object({
    stepId: z.literal('pages_show_list'),
    pages: z.array(ReviewDemoPageSchema),
    graphCaptions: z.array(z.string()),
  }),
  z.object({
    stepId: z.literal('pages_read_engagement'),
    page: ReviewDemoPageEngagementPageSchema,
    posts: z.array(ReviewDemoPageEngagementPostSchema),
    feedError: ReviewDemoPageFeedErrorSchema.optional(),
    connectedInstagram: ReviewDemoConnectedInstagramSchema.optional(),
    graphCaptions: z.array(z.string()),
  }),
  z.object({
    stepId: z.literal('ads_management'),
    adAccountId: z.string(),
    adAccountName: z.string().optional(),
    agencyPartner: ReviewDemoAgencyPartnerSchema,
    graphCaptions: z.array(z.string()),
  }),
  z.object({
    stepId: z.literal('business_management'),
    business: ReviewDemoBusinessAssetSchema,
    assets: z.array(ReviewDemoBusinessAssetSchema),
    sandboxMisconfigured: z.boolean().optional(),
    sandboxMisconfiguredMessage: z.string().optional(),
    agencyPartner: ReviewDemoAgencyPartnerSchema.extend({
      assetId: z.string(),
      assetKind: z.literal('ad_account'),
    }),
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
});

export type ReviewDemoSession = z.infer<typeof ReviewDemoSessionSchema>;

/** Default partner tasks for review-lab ad account agency share (matches production defaults). */
export const REVIEW_DEMO_AD_ACCOUNT_PARTNER_TASKS = ['ADVERTISE', 'ANALYZE'] as const;
