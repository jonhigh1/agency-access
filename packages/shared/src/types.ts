import { z } from 'zod';

// Platform types (includes both group-level and product-level platforms)
// Group-level: 'google', 'meta' - single OAuth for multiple products
// Product-level: 'google_ads', 'ga4', 'meta_ads', etc. - individual OAuth per product
export const PlatformSchema = z.enum([
  'google',
  'meta',
  'google_ads',
  'ga4',
  'meta_ads',
  'meta_pages',
  'tiktok',
  'tiktok_ads',
  'linkedin',
  'linkedin_ads',
  'linkedin_pages',
  'snapchat',
  'snapchat_ads',
  'instagram',
  'kit', // Kit (ConvertKit) - OAuth 2.0
  'beehiiv', // Beehiiv - API key authentication (team invitation workflow)
  'mailchimp', // Mailchimp - OAuth 2.0
  'pinterest', // Pinterest Ads - OAuth 2.0
  'klaviyo', // Klaviyo - OAuth 2.0 with PKCE
  'shopify', // Shopify - OAuth 2.0 with shop context
  'zapier', // Zapier - OAuth 2.0
]);
export type Platform = z.infer<typeof PlatformSchema>;

export const PlatformConnectionMethodSchema = z.enum(['oauth', 'manual', 'api_key']);
export type PlatformConnectionMethod = z.infer<typeof PlatformConnectionMethodSchema>;

export const PlatformTokenKindSchema = z.enum(['oauth', 'api_key', 'none']);
export type PlatformTokenKind = z.infer<typeof PlatformTokenKindSchema>;

export const PlatformRefreshStrategySchema = z.enum(['automatic', 'reconnect', 'none']);
export type PlatformRefreshStrategy = z.infer<typeof PlatformRefreshStrategySchema>;

export const PlatformHealthStrategySchema = z.enum([
  'live_verify',
  'expiry_only',
  'api_key_verify',
  'manual',
  'none',
]);
export type PlatformHealthStrategy = z.infer<typeof PlatformHealthStrategySchema>;

export const PlatformExpiryBehaviorSchema = z.enum(['expiring', 'non_expiring', 'none']);
export type PlatformExpiryBehavior = z.infer<typeof PlatformExpiryBehaviorSchema>;

export interface PlatformTokenCapability {
  connectionMethod: PlatformConnectionMethod;
  tokenKind: PlatformTokenKind;
  refreshStrategy: PlatformRefreshStrategy;
  healthStrategy: PlatformHealthStrategy;
  expiryBehavior: PlatformExpiryBehavior;
}

export const PLATFORM_TOKEN_CAPABILITIES: Record<Platform, PlatformTokenCapability> = {
  google: {
    connectionMethod: 'oauth',
    tokenKind: 'oauth',
    refreshStrategy: 'automatic',
    healthStrategy: 'live_verify',
    expiryBehavior: 'expiring',
  },
  meta: {
    connectionMethod: 'oauth',
    tokenKind: 'oauth',
    refreshStrategy: 'reconnect',
    healthStrategy: 'live_verify',
    expiryBehavior: 'expiring',
  },
  google_ads: {
    connectionMethod: 'oauth',
    tokenKind: 'oauth',
    refreshStrategy: 'automatic',
    healthStrategy: 'live_verify',
    expiryBehavior: 'expiring',
  },
  ga4: {
    connectionMethod: 'oauth',
    tokenKind: 'oauth',
    refreshStrategy: 'automatic',
    healthStrategy: 'live_verify',
    expiryBehavior: 'expiring',
  },
  meta_ads: {
    connectionMethod: 'oauth',
    tokenKind: 'oauth',
    refreshStrategy: 'reconnect',
    healthStrategy: 'live_verify',
    expiryBehavior: 'expiring',
  },
  meta_pages: {
    connectionMethod: 'oauth',
    tokenKind: 'oauth',
    refreshStrategy: 'reconnect',
    healthStrategy: 'live_verify',
    expiryBehavior: 'expiring',
  },
  tiktok: {
    connectionMethod: 'oauth',
    tokenKind: 'oauth',
    refreshStrategy: 'reconnect',
    healthStrategy: 'live_verify',
    expiryBehavior: 'expiring',
  },
  tiktok_ads: {
    connectionMethod: 'oauth',
    tokenKind: 'oauth',
    refreshStrategy: 'reconnect',
    healthStrategy: 'live_verify',
    expiryBehavior: 'expiring',
  },
  linkedin: {
    connectionMethod: 'oauth',
    tokenKind: 'oauth',
    refreshStrategy: 'automatic',
    healthStrategy: 'live_verify',
    expiryBehavior: 'expiring',
  },
  linkedin_ads: {
    connectionMethod: 'oauth',
    tokenKind: 'oauth',
    refreshStrategy: 'automatic',
    healthStrategy: 'live_verify',
    expiryBehavior: 'expiring',
  },
  linkedin_pages: {
    connectionMethod: 'oauth',
    tokenKind: 'oauth',
    refreshStrategy: 'automatic',
    healthStrategy: 'live_verify',
    expiryBehavior: 'expiring',
  },
  snapchat: {
    connectionMethod: 'manual',
    tokenKind: 'none',
    refreshStrategy: 'none',
    healthStrategy: 'manual',
    expiryBehavior: 'none',
  },
  snapchat_ads: {
    connectionMethod: 'manual',
    tokenKind: 'none',
    refreshStrategy: 'none',
    healthStrategy: 'manual',
    expiryBehavior: 'none',
  },
  instagram: {
    connectionMethod: 'oauth',
    tokenKind: 'oauth',
    refreshStrategy: 'reconnect',
    healthStrategy: 'live_verify',
    expiryBehavior: 'expiring',
  },
  kit: {
    connectionMethod: 'manual',
    tokenKind: 'none',
    refreshStrategy: 'none',
    healthStrategy: 'manual',
    expiryBehavior: 'none',
  },
  beehiiv: {
    connectionMethod: 'api_key',
    tokenKind: 'api_key',
    refreshStrategy: 'none',
    healthStrategy: 'api_key_verify',
    expiryBehavior: 'non_expiring',
  },
  mailchimp: {
    connectionMethod: 'manual',
    tokenKind: 'none',
    refreshStrategy: 'none',
    healthStrategy: 'manual',
    expiryBehavior: 'none',
  },
  pinterest: {
    connectionMethod: 'manual',
    tokenKind: 'none',
    refreshStrategy: 'none',
    healthStrategy: 'manual',
    expiryBehavior: 'none',
  },
  klaviyo: {
    connectionMethod: 'manual',
    tokenKind: 'none',
    refreshStrategy: 'none',
    healthStrategy: 'manual',
    expiryBehavior: 'none',
  },
  shopify: {
    connectionMethod: 'manual',
    tokenKind: 'none',
    refreshStrategy: 'none',
    healthStrategy: 'manual',
    expiryBehavior: 'none',
  },
  zapier: {
    connectionMethod: 'manual',
    tokenKind: 'none',
    refreshStrategy: 'none',
    healthStrategy: 'manual',
    expiryBehavior: 'none',
  },
};

export function getPlatformTokenCapability(platform: Platform): PlatformTokenCapability {
  return PLATFORM_TOKEN_CAPABILITIES[platform];
}

// Health status for token monitoring
export const HealthStatusSchema = z.enum(['healthy', 'expiring', 'expired', 'unknown']);
export type HealthStatus = z.infer<typeof HealthStatusSchema>;

// Access request status
export const AccessRequestStatusSchema = z.enum(['pending', 'partial', 'completed', 'expired', 'revoked']);
export type AccessRequestStatus = z.infer<typeof AccessRequestStatusSchema>;

// Connection status
export const ConnectionStatusSchema = z.enum(['active', 'revoked', 'expired']);
export type ConnectionStatus = z.infer<typeof ConnectionStatusSchema>;

// Authorization status
export const AuthorizationStatusSchema = z.enum(['active', 'expired', 'invalid', 'revoked']);
export type AuthorizationStatus = z.infer<typeof AuthorizationStatusSchema>;

// Agent-native access operations
export const AgentPermissionSchema = z.enum([
  'workspace:read',
  'agency:write',
  'clients:read',
  'clients:write',
  'templates:read',
  'connections:read',
  'connections:handoff',
  'requests:read',
  'requests:prepare',
  'requests:dispatch',
  'requests:cancel',
  'operations:read',
  'offboarding:read',
  'offboarding:prepare',
]);
export type AgentPermission = z.infer<typeof AgentPermissionSchema>;

export const AgentGrantStateSchema = z.enum(['active', 'revoked']);
export type AgentGrantState = z.infer<typeof AgentGrantStateSchema>;

export const AgentRiskClassSchema = z.enum([
  'read',
  'reversible',
  'consequential',
  'human_only',
]);
export type AgentRiskClass = z.infer<typeof AgentRiskClassSchema>;

export const AgentOperationStatusSchema = z.enum([
  'prepared',
  'pending_approval',
  'approved',
  'executing',
  'succeeded',
  'failed_retryable',
  'failed_terminal',
  'declined',
  'expired',
  'canceled',
]);
export type AgentOperationStatus = z.infer<typeof AgentOperationStatusSchema>;

export const AgentCompletionStateSchema = z.enum([
  'pending',
  'partial',
  'completed',
  'expired',
  'revoked',
  'invalid',
  'follow_up_needed',
]);
export type AgentCompletionState = z.infer<typeof AgentCompletionStateSchema>;

export const AgentWorkspacePaginationSchema = z
  .object({
    cursor: z.string().min(1).optional(),
    limit: z.number().int().min(1).max(100).default(25),
  })
  .strict();
export type AgentWorkspacePagination = z.infer<typeof AgentWorkspacePaginationSchema>;

export const AgentGrantSchema = z
  .object({
    id: z.string().min(1),
    agencyId: z.string().min(1),
    ownerSubject: z.string().min(1),
    oauthClientId: z.string().min(1),
    displayName: z.string().min(1).max(120),
    permissions: z.array(AgentPermissionSchema).min(1),
    state: AgentGrantStateSchema,
    lastUsedAt: z.string().datetime().nullable().optional(),
    revokedAt: z.string().datetime().nullable().optional(),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
  })
  .strict();
export type AgentGrant = z.infer<typeof AgentGrantSchema>;

export const AgentApprovalPreviewSchema = z
  .object({
    agency: z.object({ id: z.string().min(1), name: z.string().min(1) }).strict(),
    client: z
      .object({ id: z.string().min(1), name: z.string().min(1) })
      .strict()
      .nullable()
      .optional(),
    platforms: z.array(z.string().min(1)),
    permissions: z.array(z.string().min(1)),
    externalEffect: z.string().min(1).max(500),
    requestingAgent: z
      .object({
        grantId: z.string().min(1),
        oauthClientId: z.string().min(1),
        displayName: z.string().min(1),
      })
      .strict(),
    expiresAt: z.string().datetime(),
    changes: z.array(
      z
        .object({
          field: z.string().min(1),
          before: z.string().nullable(),
          after: z.string().nullable(),
        })
        .strict()
    ),
  })
  .strict();
export type AgentApprovalPreview = z.infer<typeof AgentApprovalPreviewSchema>;

export const AgentOperationResultSchema = z
  .object({
    resourceType: z.string().min(1).nullable().optional(),
    resourceId: z.string().min(1).nullable().optional(),
    completionState: AgentCompletionStateSchema.optional(),
    message: z.string().max(1000),
    retryable: z.boolean(),
    remediation: z.array(z.string().max(500)).default([]),
  })
  .strict();
export type AgentOperationResult = z.infer<typeof AgentOperationResultSchema>;

export const AgentOperationSchema = z
  .object({
    id: z.string().min(1),
    grantId: z.string().min(1),
    agencyId: z.string().min(1),
    actionType: z.string().min(1).max(120),
    riskClass: AgentRiskClassSchema,
    status: AgentOperationStatusSchema,
    idempotencyKey: z.string().min(1).max(200),
    inputHash: z.string().min(1).max(128),
    approvalPreview: AgentApprovalPreviewSchema.nullable().optional(),
    result: AgentOperationResultSchema.nullable().optional(),
    expiresAt: z.string().datetime().nullable().optional(),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
  })
  .strict()
  .superRefine((operation, context) => {
    if (
      operation.riskClass === 'consequential' &&
      operation.status === 'pending_approval' &&
      !operation.approvalPreview
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['approvalPreview'],
        message: 'Consequential pending operations require an approval preview',
      });
    }
  });
export type AgentOperation = z.infer<typeof AgentOperationSchema>;

// Agency member roles
export const AgencyRoleSchema = z.enum(['admin', 'member', 'viewer']);
export type AgencyRole = z.infer<typeof AgencyRoleSchema>;

// Unified onboarding lifecycle (server-persisted progress for re-entry and recovery)
export const UnifiedOnboardingStatusSchema = z.enum([
  'not_started',
  'in_progress',
  'activated',
  'completed',
]);
export type UnifiedOnboardingStatus = z.infer<typeof UnifiedOnboardingStatusSchema>;

const UnifiedOnboardingProgressFieldsSchema = z.object({
  status: UnifiedOnboardingStatusSchema.optional(),
  lastCompletedStep: z.number().int().min(0).max(6).optional(),
  lastVisitedStep: z.number().int().min(0).max(6).optional(),
  startedAt: z.string().datetime().optional(),
  activatedAt: z.string().datetime().optional(),
  completedAt: z.string().datetime().optional(),
  dismissedAt: z.string().datetime().optional(),
  accessRequestId: z.string().min(1).optional(),
});

export const UnifiedOnboardingProgressSchema = UnifiedOnboardingProgressFieldsSchema.refine((value) => Object.keys(value).length > 0, {
  message: 'At least one onboarding progress field is required',
});
export type UnifiedOnboardingProgress = z.infer<typeof UnifiedOnboardingProgressSchema>;

export const MetaAssetKindSchema = z.enum([
  'ad_account',
  'page',
  'instagram_account',
  'catalog',
  'dataset',
  'unknown',
]);
export type MetaAssetKind = z.infer<typeof MetaAssetKindSchema>;

export const MetaBusinessPortfolioRefSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  verticalName: z.string().optional(),
  verificationStatus: z.string().optional(),
});
export type MetaBusinessPortfolioRef = z.infer<typeof MetaBusinessPortfolioRefSchema>;

export const MetaClientBusinessSelectionSchema = z.object({
  clientBusinessId: z.string().min(1),
  clientBusinessName: z.string().optional(),
  selectedAt: z.string().datetime(),
  source: z.enum(['user_selection', 'auto_selected', 'created']).optional(),
});
export type MetaClientBusinessSelection = z.infer<typeof MetaClientBusinessSelectionSchema>;

export const MetaDiscoverySnapshotSchema = z.object({
  availableBusinesses: z.array(MetaBusinessPortfolioRefSchema).optional(),
  discoveredAt: z.string().datetime().optional(),
});
export type MetaDiscoverySnapshot = z.infer<typeof MetaDiscoverySnapshotSchema>;

export const MetaManagedBusinessLinkStatusSchema = z.enum([
  'not_started',
  'pending',
  'linked',
  'failed',
]);
export type MetaManagedBusinessLinkStatus = z.infer<typeof MetaManagedBusinessLinkStatusSchema>;

export const MetaManagedBusinessLinkStateSchema = z.object({
  status: MetaManagedBusinessLinkStatusSchema,
  partnerBusinessId: z.string().min(1),
  clientBusinessId: z.string().min(1),
  establishedAt: z.string().datetime().optional(),
  lastAttemptAt: z.string().datetime().optional(),
  lastErrorCode: z.string().optional(),
  lastErrorMessage: z.string().optional(),
});
export type MetaManagedBusinessLinkState = z.infer<typeof MetaManagedBusinessLinkStateSchema>;

export const MetaSystemUserProvisionStatusSchema = z.enum([
  'not_started',
  'pending',
  'ready',
  'failed',
]);
export type MetaSystemUserProvisionStatus = z.infer<typeof MetaSystemUserProvisionStatusSchema>;

export const MetaSystemUserProvisionStateSchema = z.object({
  status: MetaSystemUserProvisionStatusSchema,
  clientBusinessId: z.string().min(1),
  appId: z.string().min(1),
  scopes: z.array(z.string().min(1)).default([]),
  systemUserId: z.string().optional(),
  tokenSecretId: z.string().optional(),
  provisionedAt: z.string().datetime().optional(),
  lastAttemptAt: z.string().datetime().optional(),
  lastErrorCode: z.string().optional(),
  lastErrorMessage: z.string().optional(),
});
export type MetaSystemUserProvisionState = z.infer<typeof MetaSystemUserProvisionStateSchema>;

export const MetaAssetGrantStatusSchema = z.enum([
  'pending',
  'granted',
  'verified',
  'failed',
  'unresolved',
]);
export type MetaAssetGrantStatus = z.infer<typeof MetaAssetGrantStatusSchema>;

export const MetaAssetGrantResultSchema = z.object({
  assetId: z.string().min(1),
  assetType: MetaAssetKindSchema,
  requestedTasks: z.array(z.string().min(1)).default([]),
  status: MetaAssetGrantStatusSchema,
  grantedAt: z.string().datetime().optional(),
  verifiedAt: z.string().datetime().optional(),
  errorCode: z.string().optional(),
  errorMessage: z.string().optional(),
});
export type MetaAssetGrantResult = z.infer<typeof MetaAssetGrantResultSchema>;

export const MetaOBOStateSchema = z.object({
  managedBusinessLink: MetaManagedBusinessLinkStateSchema.optional(),
  clientSystemUser: MetaSystemUserProvisionStateSchema.optional(),
  assetGrantResults: z.array(MetaAssetGrantResultSchema).optional(),
  lastVerifiedAt: z.string().datetime().optional(),
});
export type MetaOBOState = z.infer<typeof MetaOBOStateSchema>;

export const MetaClientAuthorizationMetadataSchema = z.object({
  discovery: MetaDiscoverySnapshotSchema.optional(),
  selection: MetaClientBusinessSelectionSchema.optional(),
  obo: MetaOBOStateSchema.optional(),
});
export type MetaClientAuthorizationMetadata = z.infer<typeof MetaClientAuthorizationMetadataSchema>;

// Platform display names
export const PLATFORM_NAMES: Record<Platform, string> = {
  google: 'Google',
  meta: 'Meta',
  meta_ads: 'Meta Ads',
  meta_pages: 'Meta Pages',
  google_ads: 'Google Ads',
  ga4: 'Google Analytics',
  tiktok: 'TikTok Ads',
  tiktok_ads: 'TikTok Ads',
  linkedin: 'LinkedIn',
  linkedin_ads: 'LinkedIn Ads',
  linkedin_pages: 'LinkedIn Pages',
  snapchat: 'Snapchat Ads',
  snapchat_ads: 'Snapchat Ads',
  instagram: 'Instagram',
  kit: 'Kit',
  beehiiv: 'Beehiiv',
  mailchimp: 'Mailchimp',
  pinterest: 'Pinterest',
  klaviyo: 'Klaviyo',
  shopify: 'Shopify',
  zapier: 'Zapier',
};

// Platform domains for Brandfetch Logo API
export const PLATFORM_DOMAINS: Record<Platform, string> = {
  // Group-level platforms
  google: 'google.com',
  meta: 'meta.com',
  linkedin: 'linkedin.com',

  // Product-level platforms
  google_ads: 'google.com',
  ga4: 'google.com',
  meta_ads: 'meta.com',
  meta_pages: 'meta.com',
  tiktok: 'tiktok.com',
  tiktok_ads: 'tiktok.com',
  linkedin_ads: 'linkedin.com',
  linkedin_pages: 'linkedin.com',
  snapchat: 'snapchat.com',
  snapchat_ads: 'snapchat.com',
  instagram: 'instagram.com',
  kit: 'kit.com',
  beehiiv: 'beehiiv.com',
  mailchimp: 'mailchimp.com',
  pinterest: 'pinterest.com',
  klaviyo: 'klaviyo.com',
  shopify: 'shopify.com',
  zapier: 'zapier.com',
};

// Platform OAuth scopes
export const PLATFORM_SCOPES: Record<Platform, string[]> = {
  // Unified Google - covers all Google products with single OAuth
  google: [
    'https://www.googleapis.com/auth/adwords', // Google Ads
    'https://www.googleapis.com/auth/analytics.readonly', // Google Analytics
    'https://www.googleapis.com/auth/business.manage', // Google Business Profile
    'https://www.googleapis.com/auth/tagmanager.readonly', // Google Tag Manager
    'https://www.googleapis.com/auth/content', // Google Merchant Center
  ],
  meta: [
    'ads_management',
    'ads_read',
    'business_management',
    // pages_manage_metadata and pages_show_list removed - not valid OAuth scopes
    'pages_read_engagement',
    // Instagram accounts are accessed through Facebook Pages via business_management scope
    // No Instagram-specific OAuth scopes needed
  ],
  meta_ads: [
    'ads_management',
    'ads_read',
    'business_management',
    // pages_manage_metadata and pages_show_list removed - not valid OAuth scopes
    'pages_read_engagement',
  ],
  meta_pages: [
    'business_management',
    'pages_read_engagement',
  ],
  google_ads: [
    'https://www.googleapis.com/auth/adwords',
  ],
  ga4: [
    'https://www.googleapis.com/auth/analytics.readonly',
  ],
  tiktok: [
    'advertiser.info',
  ],
  tiktok_ads: [
    'advertiser.info',
  ],
  linkedin: [
    'openid',
    'profile',
    'email',
    'rw_ads',
    'r_ads_reporting',
  ],
  linkedin_ads: [
    'openid',
    'profile',
    'email',
    'rw_ads',
    'r_ads_reporting',
  ],
  linkedin_pages: [
    'openid',
    'profile',
    'email',
    'rw_organization_admin',
  ],
  snapchat: [
    'snapchat-marketing-api',
  ],
  snapchat_ads: [
    'snapchat-marketing-api',
  ],
  instagram: [
    // Instagram Business accounts are accessed through Facebook Pages
    // Use business_management and pages_read_engagement scopes
    'business_management',
    'pages_read_engagement',
  ],
  kit: [
    // Kit OAuth scopes
    'public', // Default scope, fine-grained coming soon
  ],
  beehiiv: [
    // Beehiiv uses API key authentication (team invitation workflow)
    // No OAuth scopes required
  ],
  mailchimp: [
    // Mailchimp uses account-level permissions - no granular OAuth scopes
    // Access token grants access based on user's account permissions
  ],
  pinterest: [
    'ads:read',
    'ads:write',
    'user_accounts:read',
  ],
  klaviyo: [
    'lists:write',
    'campaigns:write',
    'metrics:read',
    'events:read',
  ],
  shopify: [
    'read_products',
    'read_orders',
    'read_customers',
    'read_marketing_events',
  ],
  zapier: [
    'read',
    'write',
  ],
};

// Platform categorization for UI display
export const PLATFORM_CATEGORIES = {
  // Group-level platforms (recommended for new connections)
  recommended: ['google', 'meta', 'linkedin'] as const,
  // Product-level platforms (legacy, still supported)
  other: ['google_ads', 'ga4', 'meta_ads', 'meta_pages', 'tiktok', 'snapchat', 'instagram', 'linkedin_pages', 'kit', 'beehiiv', 'mailchimp', 'klaviyo', 'shopify', 'zapier'] as const,
} as const;

export type RecommendedPlatform = typeof PLATFORM_CATEGORIES.recommended[number];
export type OtherPlatform = typeof PLATFORM_CATEGORIES.other[number];

// Platforms supported on the in-app Connections page.
export const SUPPORTED_CONNECTION_PLATFORMS = [
  'google',
  'meta',
  'linkedin',
  'kit',
  'beehiiv',
  'tiktok',
  'snapchat',
  'mailchimp',
  'pinterest',
  'klaviyo',
  'shopify',
  'zapier',
] as const satisfies readonly Platform[];

export const RECOMMENDED_CONNECTION_PLATFORMS = ['google', 'meta', 'linkedin'] as const satisfies readonly Platform[];

// Helper to get category for a platform
export function getPlatformCategory(platform: Platform): 'recommended' | 'other' {
  if (PLATFORM_CATEGORIES.recommended.includes(platform as any)) {
    return 'recommended';
  }
  return 'other';
}

// Helper for Connections page categorization.
export function getConnectionPlatformCategory(platform: Platform): 'recommended' | 'other' {
  if (RECOMMENDED_CONNECTION_PLATFORMS.includes(platform as any)) {
    return 'recommended';
  }
  return 'other';
}

// ============================================================
// PHASE 5: Enhanced Access Request Creation Types
// ============================================================

// Access level types (granular permissions)
export type AccessLevel = 'admin' | 'standard' | 'read_only' | 'email_only';

export const ACCESS_LEVEL_DESCRIPTIONS: Record<AccessLevel, { title: string; description: string; permissions: string[] }> = {
  admin: {
    title: 'Admin Access',
    description: 'Full control over the account',
    permissions: ['Create campaigns', 'Edit settings', 'Delete content', 'Manage billing', 'Add/remove users'],
  },
  standard: {
    title: 'Standard Access',
    description: 'Can create and edit, but not delete',
    permissions: ['Create campaigns', 'Edit settings', 'View reports', 'No delete permissions'],
  },
  read_only: {
    title: 'Read Only',
    description: 'View-only access for reporting',
    permissions: ['View campaigns', 'View reports', 'Export data', 'No editing allowed'],
  },
  email_only: {
    title: 'Email Only',
    description: 'Basic email access for notifications',
    permissions: ['Receive email reports', 'View shared dashboards', 'No direct account access'],
  },
};

// Enhanced platform info with connection details
export interface PlatformInfo {
  platform: Platform;
  name: string;
  category: 'recommended' | 'other';
  connected: boolean;
  status?: 'active' | 'expired' | 'invalid' | 'revoked';
  connectedEmail?: string;
  connectedAt?: string;
  expiresAt?: string;
  metadata?: Record<string, any>;
}

// API response for available platforms endpoint
export interface AvailablePlatformsResponse {
  data: PlatformInfo[];
  error?: {
    code: string;
    message: string;
  };
}

// Platform hierarchy structure
export interface PlatformProduct {
  id: string;
  name: string;
  icon: string;
  description: string;
}

export interface PlatformGroup {
  name: string;
  icon: string;
  description: string;
  products: PlatformProduct[];
}

export const GOOGLE_IDENTITY_SCOPE = 'https://www.googleapis.com/auth/userinfo.email';

export const GOOGLE_PLATFORM_PRODUCT_IDS = [
  'google_ads',
  'ga4',
  'google_business_profile',
  'google_tag_manager',
  'google_search_console',
  'google_merchant_center',
] as const;

export type GooglePlatformProductId = (typeof GOOGLE_PLATFORM_PRODUCT_IDS)[number];

export type GoogleProductCapabilityTier = 'native_grant_supported' | 'discovery_only';

export interface GoogleProductOAuthRequirement {
  capabilityTier: GoogleProductCapabilityTier;
  discoveryScopes: string[];
  managementScopes: string[];
}

export const GoogleProductFulfillmentModeSchema = z.enum([
  'discovery',
  'user_invite',
  'manager_link',
  'access_binding',
  'account_admin',
  'location_admin',
  'user_permission',
  'merchant_user',
]);
export type GoogleProductFulfillmentMode = z.infer<typeof GoogleProductFulfillmentModeSchema>;

export const GoogleNativeGrantStatusSchema = z.enum([
  'not_started',
  'pending',
  'awaiting_client_acceptance',
  'awaiting_agency_acceptance',
  'verified',
  'failed',
  'follow_up_needed',
]);
export type GoogleNativeGrantStatus = z.infer<typeof GoogleNativeGrantStatusSchema>;

export const GooglePendingActorSchema = z.enum(['none', 'system', 'client', 'agency']);
export type GooglePendingActor = z.infer<typeof GooglePendingActorSchema>;

export const GoogleProductFulfillmentStateSchema = z.enum([
  'authorization_required',
  'oauth_only_insufficient',
  'pending_native_grant',
  'fulfilled',
  'follow_up_needed',
  'unsupported_automation_path',
]);
export type GoogleProductFulfillmentState = z.infer<typeof GoogleProductFulfillmentStateSchema>;

export interface GoogleProductGrantLifecycle {
  product: GooglePlatformProductId;
  capabilityTier: GoogleProductCapabilityTier;
  fulfillmentMode: GoogleProductFulfillmentMode;
  state: GoogleProductFulfillmentState;
  requiresNativeGrant: boolean;
  isFulfilled: boolean;
  grantStatus?: GoogleNativeGrantStatus;
  pendingActor: GooglePendingActor;
}

export interface EvaluateGoogleProductFulfillmentInput {
  productId: GooglePlatformProductId;
  hasOAuthAuthorization: boolean;
  fulfillmentMode: GoogleProductFulfillmentMode;
  grantStatus?: GoogleNativeGrantStatus;
}

export const GOOGLE_PRODUCT_OAUTH_REQUIREMENTS: Record<
  GooglePlatformProductId,
  GoogleProductOAuthRequirement
> = {
  google_ads: {
    capabilityTier: 'native_grant_supported',
    discoveryScopes: ['https://www.googleapis.com/auth/adwords'],
    managementScopes: [],
  },
  ga4: {
    capabilityTier: 'native_grant_supported',
    discoveryScopes: ['https://www.googleapis.com/auth/analytics.readonly'],
    managementScopes: ['https://www.googleapis.com/auth/analytics.manage.users'],
  },
  google_business_profile: {
    capabilityTier: 'native_grant_supported',
    discoveryScopes: ['https://www.googleapis.com/auth/business.manage'],
    managementScopes: [],
  },
  google_tag_manager: {
    capabilityTier: 'native_grant_supported',
    discoveryScopes: ['https://www.googleapis.com/auth/tagmanager.readonly'],
    managementScopes: ['https://www.googleapis.com/auth/tagmanager.manage.users'],
  },
  google_search_console: {
    capabilityTier: 'discovery_only',
    discoveryScopes: ['https://www.googleapis.com/auth/webmasters'],
    managementScopes: [],
  },
  google_merchant_center: {
    capabilityTier: 'native_grant_supported',
    discoveryScopes: ['https://www.googleapis.com/auth/content'],
    managementScopes: [],
  },
};

// ======================================================================
// Google Client Offboarding
// ======================================================================

export const OffboardingRunStatusSchema = z.enum([
  'prepared',
  'awaiting_approval',
  'queued',
  'executing',
  'receipt_pending',
  'completed',
  'completed_with_manual_follow_up',
  'incomplete',
  'canceled',
]);
export type OffboardingRunStatus = z.infer<typeof OffboardingRunStatusSchema>;

export const OffboardingItemStatusSchema = z.enum([
  'pending',
  'revoked_verified',
  'already_absent',
  'awaiting_client_approval',
  'manual_action_required',
  'reconnect_required',
  'not_safely_reversible',
  'failed_retryable',
  'failed_terminal',
  'attestation_recorded',
]);
export type OffboardingItemStatus = z.infer<typeof OffboardingItemStatusSchema>;

export const OffboardingItemClassificationSchema = z.enum([
  'eligible_automatic',
  'manual_action_required',
  'not_safely_reversible',
  'reconnect_required',
]);
export type OffboardingItemClassification = z.infer<typeof OffboardingItemClassificationSchema>;

export const OffboardingProviderOutcomeSchema = z.enum([
  'deleted',
  'already_absent',
  'approval_pending',
  'manual_handoff',
  'reconnect_required',
  'transient_failure',
  'terminal_failure',
  'verification_failed',
]);
export type OffboardingProviderOutcome = z.infer<typeof OffboardingProviderOutcomeSchema>;

export const OffboardingItemSchema = z.object({
  id: z.string(),
  runId: z.string(),
  productId: z.string(),
  classification: OffboardingItemClassificationSchema,
  status: OffboardingItemStatusSchema,
  assetLabel: z.string(),
  grantId: z.string(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type OffboardingItem = z.infer<typeof OffboardingItemSchema>;

export const OffboardingRunSchema = z.object({
  id: z.string(),
  agencyId: z.string(),
  connectionId: z.string(),
  status: OffboardingRunStatusSchema,
  idempotencyKey: z.string(),
  snapshotHash: z.string(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type OffboardingRun = z.infer<typeof OffboardingRunSchema>;

const DISCOVERY_ONLY_FULFILLMENT_MODES = new Set<GoogleProductFulfillmentMode>(['discovery']);

function getPendingActor(
  state: GoogleProductFulfillmentState,
  grantStatus?: GoogleNativeGrantStatus
): GooglePendingActor {
  if (state === 'authorization_required' || state === 'oauth_only_insufficient') {
    return 'system';
  }

  if (grantStatus === 'awaiting_client_acceptance') {
    return 'client';
  }

  if (grantStatus === 'awaiting_agency_acceptance') {
    return 'agency';
  }

  return 'none';
}

export function evaluateGoogleProductFulfillment(
  input: EvaluateGoogleProductFulfillmentInput
): GoogleProductGrantLifecycle {
  const requirement = GOOGLE_PRODUCT_OAUTH_REQUIREMENTS[input.productId];
  const requiresNativeGrant = requirement.capabilityTier === 'native_grant_supported';

  if (!input.hasOAuthAuthorization) {
    return {
      product: input.productId,
      capabilityTier: requirement.capabilityTier,
      fulfillmentMode: input.fulfillmentMode,
      state: 'authorization_required',
      requiresNativeGrant,
      isFulfilled: false,
      grantStatus: input.grantStatus,
      pendingActor: 'system',
    };
  }

  if (!requiresNativeGrant) {
    const supportedMode = DISCOVERY_ONLY_FULFILLMENT_MODES.has(input.fulfillmentMode);

    return {
      product: input.productId,
      capabilityTier: requirement.capabilityTier,
      fulfillmentMode: input.fulfillmentMode,
      state: supportedMode ? 'fulfilled' : 'unsupported_automation_path',
      requiresNativeGrant: false,
      isFulfilled: supportedMode,
      grantStatus: input.grantStatus,
      pendingActor: supportedMode ? 'none' : 'system',
    };
  }

  if (input.grantStatus === 'verified') {
    return {
      product: input.productId,
      capabilityTier: requirement.capabilityTier,
      fulfillmentMode: input.fulfillmentMode,
      state: 'fulfilled',
      requiresNativeGrant: true,
      isFulfilled: true,
      grantStatus: input.grantStatus,
      pendingActor: 'none',
    };
  }

  if (input.grantStatus === 'failed' || input.grantStatus === 'follow_up_needed') {
    return {
      product: input.productId,
      capabilityTier: requirement.capabilityTier,
      fulfillmentMode: input.fulfillmentMode,
      state: 'follow_up_needed',
      requiresNativeGrant: true,
      isFulfilled: false,
      grantStatus: input.grantStatus,
      pendingActor: 'system',
    };
  }

  if (
    input.grantStatus === 'pending' ||
    input.grantStatus === 'awaiting_client_acceptance' ||
    input.grantStatus === 'awaiting_agency_acceptance'
  ) {
    const state: GoogleProductFulfillmentState = 'pending_native_grant';

    return {
      product: input.productId,
      capabilityTier: requirement.capabilityTier,
      fulfillmentMode: input.fulfillmentMode,
      state,
      requiresNativeGrant: true,
      isFulfilled: false,
      grantStatus: input.grantStatus,
      pendingActor: getPendingActor(state, input.grantStatus),
    };
  }

  return {
    product: input.productId,
    capabilityTier: requirement.capabilityTier,
    fulfillmentMode: input.fulfillmentMode,
    state: 'oauth_only_insufficient',
    requiresNativeGrant: true,
    isFulfilled: false,
    grantStatus: input.grantStatus,
    pendingActor: 'system',
  };
}

export interface ResolveGoogleOAuthScopesOptions {
  includeManagementScopes?: boolean;
  includeIdentityScope?: boolean;
}

const GOOGLE_PLATFORM_PRODUCT_ID_SET = new Set<string>(GOOGLE_PLATFORM_PRODUCT_IDS);

function isGooglePlatformProductId(productId: string): productId is GooglePlatformProductId {
  return GOOGLE_PLATFORM_PRODUCT_ID_SET.has(productId);
}

export function resolveGoogleOAuthScopes(
  productIds: string[],
  options: ResolveGoogleOAuthScopesOptions = {}
): string[] {
  const {
    includeManagementScopes = true,
    includeIdentityScope = true,
  } = options;

  const scopes: string[] = [];
  const seenScopes = new Set<string>();

  const appendScope = (scope: string) => {
    if (seenScopes.has(scope)) {
      return;
    }

    seenScopes.add(scope);
    scopes.push(scope);
  };

  for (const productId of productIds) {
    if (!isGooglePlatformProductId(productId)) {
      continue;
    }

    const requirement = GOOGLE_PRODUCT_OAUTH_REQUIREMENTS[productId];

    for (const scope of requirement.discoveryScopes) {
      appendScope(scope);
    }

    if (includeManagementScopes) {
      for (const scope of requirement.managementScopes) {
        appendScope(scope);
      }
    }
  }

  if (includeIdentityScope) {
    appendScope(GOOGLE_IDENTITY_SCOPE);
  }

  return scopes;
}

export const PLATFORM_HIERARCHY: Record<string, PlatformGroup> = {
  google: {
    name: 'Google',
    icon: 'GoogleIcon',
    description: 'Google Marketing Platform',
    products: [
      { id: 'google_ads', name: 'Google Ads', icon: 'GoogleAdsIcon', description: 'Search and display advertising' },
      { id: 'ga4', name: 'Google Analytics 4', icon: 'GA4Icon', description: 'Website and app analytics' },
      { id: 'google_tag_manager', name: 'Tag Manager', icon: 'GTMIcon', description: 'Tag management system' },
      { id: 'google_merchant_center', name: 'Merchant Center', icon: 'GMCIcon', description: 'Product feed management' },
      { id: 'google_search_console', name: 'Search Console', icon: 'GSCIcon', description: 'Search performance monitoring' },
      { id: 'google_business_profile', name: 'Business Profile', icon: 'GBPIcon', description: 'Local business presence' },
    ],
  },
  meta: {
    name: 'Meta',
    icon: 'MetaIcon',
    description: 'Meta Business Platform',
    products: [
      { id: 'meta_ads', name: 'Meta Ads', icon: 'MetaAdsIcon', description: 'Facebook and Instagram advertising' },
      { id: 'meta_pages', name: 'Meta Pages', icon: 'MetaPagesIcon', description: 'Facebook Pages access and management' },
      { id: 'instagram', name: 'Instagram', icon: 'InstagramIcon', description: 'Instagram business profile' },
    ],
  },
  linkedin: {
    name: 'LinkedIn',
    icon: 'LinkedInIcon',
    description: 'LinkedIn Marketing',
    products: [
      { id: 'linkedin_ads', name: 'LinkedIn Ads', icon: 'LinkedInAdsIcon', description: 'Professional network advertising' },
      { id: 'linkedin_pages', name: 'LinkedIn Pages', icon: 'LinkedInIcon', description: 'Company Pages and organic presence' },
    ],
  },
  tiktok: {
    name: 'TikTok',
    icon: 'TikTokIcon',
    description: 'TikTok for Business',
    products: [
      { id: 'tiktok_ads', name: 'TikTok Ads', icon: 'TikTokAdsIcon', description: 'Short-form video advertising' },
    ],
  },
  snapchat: {
    name: 'Snapchat',
    icon: 'SnapchatIcon',
    description: 'Snapchat Marketing',
    products: [
      { id: 'snapchat_ads', name: 'Snapchat Ads', icon: 'SnapchatAdsIcon', description: 'Augmented reality advertising' },
    ],
  },
  mailchimp: {
    name: 'Mailchimp',
    icon: 'MailchimpIcon',
    description: 'Email Marketing Platform',
    products: [
      { id: 'mailchimp', name: 'Mailchimp', icon: 'MailchimpIcon', description: 'Email marketing and automation' },
    ],
  },
  pinterest: {
    name: 'Pinterest',
    icon: 'PinterestIcon',
    description: 'Pinterest Marketing',
    products: [
      { id: 'pinterest', name: 'Pinterest Ads', icon: 'PinterestAdsIcon', description: 'Visual discovery and advertising' },
    ],
  },
  klaviyo: {
    name: 'Klaviyo',
    icon: 'KlaviyoIcon',
    description: 'Email & SMS Marketing',
    products: [
      { id: 'klaviyo', name: 'Klaviyo', icon: 'KlaviyoIcon', description: 'Email and SMS marketing automation' },
    ],
  },
  shopify: {
    name: 'Shopify',
    icon: 'ShopifyIcon',
    description: 'E-commerce Platform',
    products: [
      { id: 'shopify', name: 'Shopify', icon: 'ShopifyIcon', description: 'Online store and e-commerce platform' },
    ],
  },
  kit: {
    name: 'Kit',
    icon: 'KitIcon',
    description: 'Email Marketing Platform',
    products: [
      { id: 'kit', name: 'Kit', icon: 'KitIcon', description: 'Email marketing and automation' },
    ],
  },
  beehiiv: {
    name: 'Beehiiv',
    icon: 'BeehiivIcon',
    description: 'Newsletter Platform',
    products: [
      { id: 'beehiiv', name: 'Beehiiv', icon: 'BeehiivIcon', description: 'Newsletter publishing and growth' },
    ],
  },
  zapier: {
    name: 'Zapier',
    icon: 'ZapierIcon',
    description: 'Automation Platform',
    products: [
      { id: 'zapier', name: 'Zapier', icon: 'ZapierIcon', description: 'Workflow automation and integration' },
    ],
  },
};

// Inverted PLATFORM_HIERARCHY lookup: product id -> group key, group key -> itself.
const PLATFORM_GROUP_BY_PRODUCT: ReadonlyMap<string, string> = new Map(
  Object.entries(PLATFORM_HIERARCHY).flatMap(([groupKey, group]): [string, string][] => [
    [groupKey, groupKey],
    ...group.products.map((product): [string, string] => [product.id, groupKey]),
  ])
);

/**
 * Resolve the platform group for a product id or group key.
 * Unknown values return the input unchanged (identity fallback).
 */
export function platformGroupOf(platform: string): string {
  return PLATFORM_GROUP_BY_PRODUCT.get(platform) ?? platform;
}

// Platform product configuration for access requests
export interface PlatformProductConfig {
  product: string;
  accessLevel: AccessLevel;
  accounts: string[];
}

export interface PlatformGroupConfig {
  platformGroup: string;
  products: PlatformProductConfig[];
}

// Language types
export type ClientLanguage = 'en' | 'es' | 'nl';

// ============================================================
// META ASSET TYPES
// ============================================================

export interface MetaAdAccount {
  id: string;
  name: string;
  accountStatus: string;
  currency: string;
}

export interface MetaPage {
  id: string;
  name: string;
  category: string;
  tasks: string[];
}

export interface MetaInstagramAccount {
  id: string;
  username: string;
  profilePictureUrl?: string;
}

export interface MetaProductCatalog {
  id: string;
  name: string;
  catalogType: string;
}

export interface MetaBusinessPortfolio {
  id: string;
  name: string;
  verticalName?: string;
  verificationStatus?: string;
}

export type MetaPagePermission = 
  | 'content'
  | 'community_activity'
  | 'messages'
  | 'ads'
  | 'insights'
  | 'revenue'
  | 'leads'
  | 'partial_access'
  | 'maximum_permissions';

export interface MetaAssetSettings {
  adAccount: { enabled: boolean; permissionLevel: MetaPermissionLevel };
  page: { 
    enabled: boolean; 
    permissionLevel: MetaPermissionLevel; 
    limitPermissions?: boolean;
    selectedPermissions?: MetaPagePermission[];
  };
  catalog: { enabled: boolean; permissionLevel: MetaPermissionLevel };
  dataset: { enabled: boolean; requestFullAccess: boolean };
  instagramAccount: { enabled: boolean; requestFullAccess: boolean };
}

export interface MetaAllAssets {
  businessId: string;
  businessName: string;
  adAccounts: MetaAdAccount[];
  pages: MetaPage[];
  instagramAccounts: MetaInstagramAccount[];
  productCatalogs: MetaProductCatalog[];
}

export type MetaPermissionLevel = 'admin' | 'advertise' | 'analyze' | 'manage';

export interface MetaAssetSelection {
  assetType: 'ad_account' | 'page' | 'instagram' | 'catalog';
  assetId: string;
  permissionLevel: MetaPermissionLevel;
  selected: boolean;
}

// ============================================================
// GOOGLE ASSET TYPES
// ============================================================

export interface GoogleAdsAccount {
  id: string;
  name: string;
  formattedId?: string;
  isManager?: boolean;
  nameSource?: 'hierarchy' | 'direct' | 'fallback';
  type: 'google_ads';
  status: string;
}

export interface GoogleAnalyticsProperty {
  id: string;
  name: string;
  displayName: string;
  type: 'ga4';
  accountName: string;
}

export interface GoogleBusinessAccount {
  id: string;
  name: string;
  type: 'google_business';
  locationCount?: number;
}

export interface GoogleTagManagerContainer {
  id: string;
  name: string;
  type: 'google_tag_manager';
  accountId: string;
  accountName: string;
}

export interface GoogleSearchConsoleSite {
  id: string;
  url: string;
  type: 'google_search_console';
  permissionLevel: string;
}

export interface GoogleMerchantCenterAccount {
  id: string;
  name: string;
  type: 'google_merchant_center';
  websiteUrl?: string;
}

export interface GoogleAccountsResponse {
  adsAccounts: GoogleAdsAccount[];
  analyticsProperties: GoogleAnalyticsProperty[];
  businessAccounts: GoogleBusinessAccount[];
  tagManagerContainers: GoogleTagManagerContainer[];
  searchConsoleSites: GoogleSearchConsoleSite[];
  merchantCenterAccounts: GoogleMerchantCenterAccount[];
  hasAccess: boolean;
}

export const GoogleAdsGrantModeSchema = z.enum(['manager_link', 'user_invite']);
export type GoogleAdsGrantMode = z.infer<typeof GoogleAdsGrantModeSchema>;

export interface GoogleAdsManagementSettings {
  preferredGrantMode: GoogleAdsGrantMode;
  managerCustomerId?: string;
  managerAccountLabel?: string;
  inviteEmail?: string;
}

function normalizeGoogleAdsCustomerId(value: unknown): unknown {
  if (typeof value !== 'string') {
    return value;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return undefined;
  }

  return trimmed.replace(/\D/g, '');
}

export const GoogleAdsManagementSettingsSchema = z
  .object({
    preferredGrantMode: GoogleAdsGrantModeSchema.default('user_invite'),
    managerCustomerId: z.preprocess(
      normalizeGoogleAdsCustomerId,
      z
        .string()
        .regex(/^\d{10}$/, 'Manager customer ID must be a 10-digit Google Ads customer ID')
        .optional()
    ),
    managerAccountLabel: z.string().trim().min(1).optional(),
    inviteEmail: z.string().trim().email('Invite email must be a valid email address').optional(),
  })
  .superRefine((value, ctx) => {
    if (value.preferredGrantMode === 'manager_link' && !value.managerCustomerId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['managerCustomerId'],
        message: 'Manager customer ID is required when MCC linking is the default.',
      });
    }

    if (value.preferredGrantMode === 'user_invite' && !value.inviteEmail) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['inviteEmail'],
        message: 'Invite email is required when direct user invite is the default.',
      });
    }
  });

export interface GoogleAssetSettings {
  googleAdsManagement?: GoogleAdsManagementSettings;
  googleAds: {
    enabled: boolean;
    accountId?: string;
    requestManageUsers?: boolean;
  };
  googleAnalytics: {
    enabled: boolean;
    propertyId?: string;
    requestManageUsers?: boolean;
  };
  googleBusinessProfile: {
    enabled: boolean;
    locationId?: string;
    requestManageUsers?: boolean;
  };
  googleTagManager: {
    enabled: boolean;
    containerId?: string;
    requestManageUsers?: boolean;
  };
  googleSearchConsole: {
    enabled: boolean;
    siteUrl?: string;
    requestManageUsers?: boolean;
  };
  googleMerchantCenter: {
    enabled: boolean;
    accountId?: string;
    requestManageUsers?: boolean;
  };
}

export const GoogleAssetSettingsSchema = z.object({
  googleAdsManagement: GoogleAdsManagementSettingsSchema.optional(),
  googleAds: z.object({
    enabled: z.boolean(),
    accountId: z.string().min(1).optional(),
    requestManageUsers: z.boolean().optional(),
  }),
  googleAnalytics: z.object({
    enabled: z.boolean(),
    propertyId: z.string().min(1).optional(),
    requestManageUsers: z.boolean().optional(),
  }),
  googleBusinessProfile: z.object({
    enabled: z.boolean(),
    locationId: z.string().min(1).optional(),
    requestManageUsers: z.boolean().optional(),
  }),
  googleTagManager: z.object({
    enabled: z.boolean(),
    containerId: z.string().min(1).optional(),
    requestManageUsers: z.boolean().optional(),
  }),
  googleSearchConsole: z.object({
    enabled: z.boolean(),
    siteUrl: z.string().min(1).optional(),
    requestManageUsers: z.boolean().optional(),
  }),
  googleMerchantCenter: z.object({
    enabled: z.boolean(),
    accountId: z.string().min(1).optional(),
    requestManageUsers: z.boolean().optional(),
  }),
});

export function getDefaultGoogleAssetSettings(inviteEmail?: string): GoogleAssetSettings {
  return {
    googleAdsManagement: {
      preferredGrantMode: 'user_invite',
      ...(inviteEmail ? { inviteEmail } : {}),
    },
    googleAds: { enabled: true, requestManageUsers: false },
    googleAnalytics: { enabled: true, requestManageUsers: false },
    googleBusinessProfile: { enabled: true, requestManageUsers: false },
    googleTagManager: { enabled: true, requestManageUsers: false },
    googleSearchConsole: { enabled: true, requestManageUsers: false },
    googleMerchantCenter: { enabled: true, requestManageUsers: false },
  };
}

// ============================================================
// PINTEREST ASSET TYPES
// ============================================================

/**
 * Pinterest connection metadata
 * Business ID is optional - Pinterest API works without it, but it's useful for:
 * - Identifying which business the connection represents
 * - Future business-specific operations (audience sharing, partnerships)
 * - Better metadata and reporting
 */
export interface PinterestConnectionMetadata {
  businessId?: string;  // Pinterest Business ID from Business Manager
  businessName?: string; // Optional: Business name for display
}

// ============================================================
// CLIENT TYPES
// ============================================================

export interface Client {
  id: string;
  agencyId: string;
  name: string;
  company: string;
  email: string;
  website: string | null;
  language: ClientLanguage;
  createdAt: Date;
  updatedAt: Date;
}

export const SUPPORTED_LANGUAGES: Record<ClientLanguage, { name: string; flag: string; code: string }> = {
  en: { name: 'English', flag: '🇬🇧', code: 'en' },
  es: { name: 'Español', flag: '🇪🇸', code: 'es' },
  nl: { name: 'Nederlands', flag: '🇳🇱', code: 'nl' },
};

// ============================================================
// REQUEST TEMPLATES: Agency-wide reusable access request templates
// ============================================================

// Intake field definition (same as in AccessRequestContext)
export interface IntakeField {
  id: string;
  label: string;
  type: 'text' | 'email' | 'phone' | 'url' | 'dropdown' | 'textarea';
  required: boolean;
  options?: string[];
  order: number;
}

// Branding configuration (same as in AccessRequestContext)
export interface BrandingConfig {
  logoUrl: string;
  primaryColor: string;
  subdomain: string;
}

export const IntakeFieldTypeSchema = z.enum(['text', 'email', 'phone', 'url', 'dropdown', 'textarea']);

export const AccessRequestIntakeFieldSchema = z.object({
  id: z.string().optional(),
  label: z.string(),
  type: IntakeFieldTypeSchema,
  required: z.boolean(),
  options: z.array(z.string()).optional(),
  order: z.number().optional(),
});
export type AccessRequestIntakeFieldInput = z.infer<typeof AccessRequestIntakeFieldSchema>;

export const AccessRequestBrandingUpdateSchema = z.object({
  logoUrl: z.string().url().optional(),
  primaryColor: z.string().regex(/^#[0-9A-F]{6}$/i, 'Invalid hex color').optional(),
  subdomain: z.string().min(3).max(63).regex(/^[a-z0-9-]+$/, 'Invalid subdomain').optional(),
});
export type AccessRequestBrandingUpdate = z.infer<typeof AccessRequestBrandingUpdateSchema>;

export const AccessRequestPlatformUpdateSchema = z.object({
  platform: z.string().min(1),
  accessLevel: z.enum(['manage', 'view_only']),
});
export type AccessRequestPlatformUpdate = z.infer<typeof AccessRequestPlatformUpdateSchema>;

export const AccessRequestUpdatePayloadSchema = z.object({
  externalReference: z.string().max(255).optional(),
  platforms: z.array(AccessRequestPlatformUpdateSchema).min(1).optional(),
  intakeFields: z.array(AccessRequestIntakeFieldSchema).optional(),
  branding: AccessRequestBrandingUpdateSchema.optional(),
  status: AccessRequestStatusSchema.optional(),
}).refine((value) => Object.keys(value).length > 0, {
  message: 'At least one field is required to update an access request',
});
export type AccessRequestUpdatePayload = z.infer<typeof AccessRequestUpdatePayloadSchema>;

export const WEBHOOK_API_VERSION_V1 = '2026-03-08';
export const WEBHOOK_API_VERSION_V2 = '2026-03-19';

export const WebhookApiVersionSchema = z.enum([
  WEBHOOK_API_VERSION_V1,
  WEBHOOK_API_VERSION_V2,
]);
export type WebhookApiVersion = z.infer<typeof WebhookApiVersionSchema>;

export const WebhookEventTypeSchema = z.enum([
  'webhook.test',
  'access_request.partial',
  'access_request.completed',
  'access_request.revoked',
  'access_request.expired',
  'connection.status_changed',
]);
export type WebhookEventType = z.infer<typeof WebhookEventTypeSchema>;

export const WebhookAccessRequestLifecycleEventTypeSchema = z.enum([
  'access_request.partial',
  'access_request.completed',
  'access_request.revoked',
  'access_request.expired',
]);
export type WebhookAccessRequestLifecycleEventType = z.infer<typeof WebhookAccessRequestLifecycleEventTypeSchema>;

export const WebhookEndpointStatusSchema = z.enum(['active', 'disabled']);
export type WebhookEndpointStatus = z.infer<typeof WebhookEndpointStatusSchema>;

export const WebhookDeliveryStatusSchema = z.enum(['pending', 'delivered', 'failed']);
export type WebhookDeliveryStatus = z.infer<typeof WebhookDeliveryStatusSchema>;

export const WebhookEndpointConfigInputSchema = z.object({
  url: z.string().url(),
  subscribedEvents: z.array(WebhookEventTypeSchema).min(1).max(6),
  preferredApiVersion: WebhookApiVersionSchema.optional(),
});
export type WebhookEndpointConfigInput = z.infer<typeof WebhookEndpointConfigInputSchema>;

export const WebhookEndpointSummarySchema = z.object({
  id: z.string(),
  agencyId: z.string(),
  url: z.string().url(),
  status: WebhookEndpointStatusSchema,
  subscribedEvents: z.array(WebhookEventTypeSchema),
  preferredApiVersion: WebhookApiVersionSchema,
  failureCount: z.number().int().min(0),
  secretLastFour: z.string().length(4).optional().nullable(),
  lastDeliveredAt: z.string().datetime().optional().nullable(),
  lastFailedAt: z.string().datetime().optional().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type WebhookEndpointSummary = z.infer<typeof WebhookEndpointSummarySchema>;

export const WebhookDeliverySummarySchema = z.object({
  id: z.string(),
  eventId: z.string(),
  eventType: WebhookEventTypeSchema,
  status: WebhookDeliveryStatusSchema,
  attemptNumber: z.number().int().min(1),
  responseStatus: z.number().int().min(100).max(599).optional().nullable(),
  responseBodySnippet: z.string().optional().nullable(),
  errorMessage: z.string().optional().nullable(),
  deliveredAt: z.string().datetime().optional().nullable(),
  createdAt: z.string().datetime(),
});
export type WebhookDeliverySummary = z.infer<typeof WebhookDeliverySummarySchema>;

const WebhookAccessRequestSnapshotSchema = z.object({
  id: z.string(),
  status: AccessRequestStatusSchema,
  createdAt: z.string().datetime(),
  authorizedAt: z.string().datetime().optional().nullable(),
  expiresAt: z.string().datetime(),
  requestUrl: z.string().url(),
  clientPortalUrl: z.string().url().optional(),
  requestedPlatforms: z.array(z.string()),
  completedPlatforms: z.array(z.string()),
  externalReference: z.string().optional().nullable(),
  accessLevel: z.enum(['admin', 'standard', 'read_only', 'email_only']).optional(),
});

const WebhookClientSnapshotSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string().email(),
  company: z.string().optional(),
});

export const WebhookConnectionAssetV2Schema = z.object({
  assetId: z.string(),
  assetName: z.string(),
  assetType: z.string(),
  platform: z.string(),
  connectionStatus: z.enum(['Connected', 'Failed', 'Pending']),
  accessLevel: z.enum(['ViewOnly', 'Manage', 'Owner']).optional(),
  grantedAt: z.string().datetime().optional(),
  notes: z.string().optional(),
  linkToAsset: z.string().optional(),
  statusLastCheckedAt: z.string().datetime().optional(),
});

export type WebhookConnectionAssetV2 = z.infer<typeof WebhookConnectionAssetV2Schema>;

const WebhookConnectionSummarySchema = z.object({
  connectionId: z.string(),
  status: ConnectionStatusSchema,
  platforms: z.array(z.string()),
  grantedAssetsSummary: z.record(z.unknown()).optional(),
  assets: z.array(WebhookConnectionAssetV2Schema).optional(),
});

export const WebhookAccessRequestEventDataSchema = z.object({
  accessRequest: WebhookAccessRequestSnapshotSchema,
  client: WebhookClientSnapshotSchema,
  connections: z.array(WebhookConnectionSummarySchema),
});
export type WebhookAccessRequestEventData = z.infer<typeof WebhookAccessRequestEventDataSchema>;

export const WebhookTestEventDataSchema = z.object({
  message: z.string(),
});
export type WebhookTestEventData = z.infer<typeof WebhookTestEventDataSchema>;

const WebhookEventEnvelopeBaseSchema = z.object({
  id: z.string(),
  apiVersion: WebhookApiVersionSchema,
  createdAt: z.string().datetime(),
  isReplay: z.boolean().optional(),
});

export const WebhookTestEventEnvelopeSchema = WebhookEventEnvelopeBaseSchema.extend({
  type: z.literal('webhook.test'),
  data: WebhookTestEventDataSchema,
});
export type WebhookTestEventEnvelope = z.infer<typeof WebhookTestEventEnvelopeSchema>;

export const WebhookAccessRequestPartialEventEnvelopeSchema = WebhookEventEnvelopeBaseSchema.extend({
  type: z.literal('access_request.partial'),
  data: WebhookAccessRequestEventDataSchema,
});
export type WebhookAccessRequestPartialEventEnvelope = z.infer<typeof WebhookAccessRequestPartialEventEnvelopeSchema>;

export const WebhookAccessRequestCompletedEventEnvelopeSchema = WebhookEventEnvelopeBaseSchema.extend({
  type: z.literal('access_request.completed'),
  data: WebhookAccessRequestEventDataSchema,
});
export type WebhookAccessRequestCompletedEventEnvelope = z.infer<typeof WebhookAccessRequestCompletedEventEnvelopeSchema>;

// --- Revoked / Expired event data (extends base access request snapshot) ---

const WebhookAccessRequestRevokedEventDataSchema = z.object({
  accessRequest: WebhookAccessRequestSnapshotSchema.extend({
    revokedAt: z.string().datetime(),
    revokedBy: z.string().optional(),
  }),
  client: WebhookClientSnapshotSchema,
  connections: z.array(WebhookConnectionSummarySchema),
});
export type WebhookAccessRequestRevokedEventData = z.infer<typeof WebhookAccessRequestRevokedEventDataSchema>;

export const WebhookAccessRequestRevokedEventEnvelopeSchema = WebhookEventEnvelopeBaseSchema.extend({
  type: z.literal('access_request.revoked'),
  data: WebhookAccessRequestRevokedEventDataSchema,
});
export type WebhookAccessRequestRevokedEventEnvelope = z.infer<typeof WebhookAccessRequestRevokedEventEnvelopeSchema>;

const WebhookAccessRequestExpiredEventDataSchema = z.object({
  accessRequest: WebhookAccessRequestSnapshotSchema.extend({
    expiredAt: z.string().datetime(),
  }),
  client: WebhookClientSnapshotSchema,
});
export type WebhookAccessRequestExpiredEventData = z.infer<typeof WebhookAccessRequestExpiredEventDataSchema>;

export const WebhookAccessRequestExpiredEventEnvelopeSchema = WebhookEventEnvelopeBaseSchema.extend({
  type: z.literal('access_request.expired'),
  data: WebhookAccessRequestExpiredEventDataSchema,
});
export type WebhookAccessRequestExpiredEventEnvelope = z.infer<typeof WebhookAccessRequestExpiredEventEnvelopeSchema>;

// --- Connection status changed event data ---

const WebhookConnectionStatusChangedEventDataSchema = z.object({
  connectionId: z.string(),
  agencyId: z.string(),
  platform: z.string(),
  previousStatus: z.string(),
  newStatus: z.string(),
  detectedAt: z.string().datetime(),
  client: z.object({
    id: z.string(),
    name: z.string(),
    email: z.string(),
    company: z.string().optional(),
  }).optional(),
});
export type WebhookConnectionStatusChangedEventData = z.infer<typeof WebhookConnectionStatusChangedEventDataSchema>;

export const WebhookConnectionStatusChangedEventEnvelopeSchema = WebhookEventEnvelopeBaseSchema.extend({
  type: z.literal('connection.status_changed'),
  data: WebhookConnectionStatusChangedEventDataSchema,
});
export type WebhookConnectionStatusChangedEventEnvelope = z.infer<typeof WebhookConnectionStatusChangedEventEnvelopeSchema>;

export const WebhookEventEnvelopeSchema = z.discriminatedUnion('type', [
  WebhookTestEventEnvelopeSchema,
  WebhookAccessRequestPartialEventEnvelopeSchema,
  WebhookAccessRequestCompletedEventEnvelopeSchema,
  WebhookAccessRequestRevokedEventEnvelopeSchema,
  WebhookAccessRequestExpiredEventEnvelopeSchema,
  WebhookConnectionStatusChangedEventEnvelopeSchema,
]);
export type WebhookEventEnvelope = z.infer<typeof WebhookEventEnvelopeSchema>;

// Additional agency identity details used for manual invite flows.
export interface ManualInviteTarget {
  agencyEmail?: string;
  businessId?: string;
  shopDomain?: string;
  collaboratorCode?: string;
}

// Client-side completion progress for multi-platform authorization.
export interface ClientFulfilledProduct {
  product: string;
  platformGroup: string;
}

export interface ClientUnresolvedProduct {
  product: string;
  platformGroup: string;
  reason: 'no_assets' | 'selection_required' | string;
}

export interface ClientAuthorizationProgress {
  completedPlatforms: string[];
  isComplete: boolean;
  fulfilledProducts?: ClientFulfilledProduct[];
  unresolvedProducts?: ClientUnresolvedProduct[];
  googleProductFulfillment?: GoogleProductGrantLifecycle[];
}

export interface ClientAccessRequestPlatformProduct {
  product: string;
  accessLevel: string;
}

export interface ClientAccessRequestPlatformGroup {
  platformGroup: Platform;
  products: ClientAccessRequestPlatformProduct[];
}

// Public payload returned by GET /api/client/:token.
export interface ClientAccessRequestPayload {
  id: string;
  agencyId: string;
  agencyName: string;
  clientName: string;
  clientEmail: string;
  externalReference?: string;
  status: AccessRequestStatus;
  uniqueToken: string;
  expiresAt: string;
  platforms: ClientAccessRequestPlatformGroup[];
  intakeFields: IntakeField[];
  branding: Partial<BrandingConfig>;
  manualInviteTargets: Record<string, ManualInviteTarget>;
  authorizationProgress: ClientAuthorizationProgress;
}

// Platform selection format for hierarchical platform organization
// Used in access requests and templates
// Format: { google: ['google_ads', 'ga4'], meta: ['meta_ads'] }
export type PlatformSelection = Record<string, string[]>;

// Access Request Template - mirrors AccessRequest wizard state
export interface AccessRequestTemplate {
  id: string;
  agencyId: string;
  name: string;
  description?: string;
  platforms: Record<string, string[]>; // Hierarchical format: { google: ['google_ads', 'ga4'] }
  globalAccessLevel: AccessLevel;
  intakeFields: IntakeField[];
  branding: BrandingConfig;
  isDefault: boolean;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

// Input types for template CRUD operations
export interface CreateTemplateInput {
  agencyId: string;
  name: string;
  description?: string;
  platforms: Record<string, string[]>;
  globalAccessLevel: AccessLevel;
  intakeFields: IntakeField[];
  branding: Partial<BrandingConfig>;
  isDefault?: boolean;
  createdBy: string;
}

export interface UpdateTemplateInput {
  name?: string;
  description?: string;
  platforms?: Record<string, string[]>;
  globalAccessLevel?: AccessLevel;
  intakeFields?: IntakeField[];
  branding?: Partial<BrandingConfig>;
  isDefault?: boolean;
}

// API response types
export interface TemplateResponse {
  data?: AccessRequestTemplate;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
}

export interface TemplatesListResponse {
  data?: AccessRequestTemplate[];
  error?: {
    code: string;
    message: string;
  };
}

// ============================================================
// CLIENT DETAIL PAGE TYPES
// ============================================================

// ============================================================
// AFFILIATE PROGRAM TYPES
// ============================================================

export const AffiliatePartnerStatusSchema = z.enum(['applied', 'approved', 'rejected', 'disabled']);
export type AffiliatePartnerStatus = z.infer<typeof AffiliatePartnerStatusSchema>;

export const AffiliateReferralStatusSchema = z.enum(['attributed', 'qualified', 'review_required', 'disqualified']);
export type AffiliateReferralStatus = z.infer<typeof AffiliateReferralStatusSchema>;

export const AffiliateCommissionStatusSchema = z.enum([
  'pending',
  'approved',
  'paid',
  'void',
  'review_required',
]);
export type AffiliateCommissionStatus = z.infer<typeof AffiliateCommissionStatusSchema>;

export const AffiliatePayoutStatusSchema = z.enum([
  'draft',
  'approved',
  'exported',
  'paid',
  'canceled',
]);
export type AffiliatePayoutStatus = z.infer<typeof AffiliatePayoutStatusSchema>;

export const AffiliateLinkStatusSchema = z.enum(['active', 'disabled', 'archived']);
export type AffiliateLinkStatus = z.infer<typeof AffiliateLinkStatusSchema>;

export const AffiliateAudienceSizeSchema = z.enum([
  'under_1k',
  '1k_to_10k',
  '10k_to_50k',
  '50k_to_250k',
  '250k_plus',
]);
export type AffiliateAudienceSize = z.infer<typeof AffiliateAudienceSizeSchema>;

export const AffiliateApplicationInputSchema = z.object({
  name: z.string().min(2).max(120),
  email: z.string().email(),
  companyName: z.string().min(2).max(160).optional(),
  websiteUrl: z.string().url().optional(),
  audienceSize: AffiliateAudienceSizeSchema.optional(),
  promotionPlan: z.string().min(10).max(2000),
  termsAccepted: z.literal(true),
});
export type AffiliateApplicationInput = z.infer<typeof AffiliateApplicationInputSchema>;

export const AffiliatePartnerSummarySchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string().email(),
  status: AffiliatePartnerStatusSchema,
  defaultCommissionBps: z.number().int().min(0).max(10000),
  commissionDurationMonths: z.number().int().min(1).max(60),
});
export type AffiliatePartnerSummary = z.infer<typeof AffiliatePartnerSummarySchema>;

export const AffiliateLinkSummarySchema = z.object({
  id: z.string(),
  code: z.string(),
  status: AffiliateLinkStatusSchema,
  destinationPath: z.string(),
  campaign: z.string().nullable().optional(),
  url: z.string().url().optional(),
});
export type AffiliateLinkSummary = z.infer<typeof AffiliateLinkSummarySchema>;

export const AffiliatePortalLinkCreateInputSchema = z.object({
  campaign: z.string().min(2).max(80),
  destinationPath: z.string().startsWith('/'),
});
export type AffiliatePortalLinkCreateInput = z.infer<typeof AffiliatePortalLinkCreateInputSchema>;

export const AffiliatePortalMetricsSchema = z.object({
  clicks: z.number().int().nonnegative(),
  referrals: z.number().int().nonnegative(),
  customers: z.number().int().nonnegative(),
  pendingCommissionCents: z.number().int().nonnegative(),
  paidCommissionCents: z.number().int().nonnegative(),
});
export type AffiliatePortalMetrics = z.infer<typeof AffiliatePortalMetricsSchema>;

export const AffiliatePartnerPortalOverviewSchema = z.object({
  partner: AffiliatePartnerSummarySchema,
  metrics: AffiliatePortalMetricsSchema,
  primaryLink: AffiliateLinkSummarySchema.nullable().optional(),
  links: z.array(AffiliateLinkSummarySchema).default([]),
});
export type AffiliatePartnerPortalOverview = z.infer<typeof AffiliatePartnerPortalOverviewSchema>;

export const AffiliateCommissionLedgerEntrySchema = z.object({
  id: z.string(),
  customerName: z.string(),
  status: AffiliateCommissionStatusSchema,
  currency: z.string(),
  amountCents: z.number().int(),
  revenueAmountCents: z.number().int(),
  commissionBps: z.number().int().min(0).max(10000),
  invoiceDate: z.string().datetime().nullable(),
  holdUntil: z.string().datetime(),
  approvedAt: z.string().datetime().nullable(),
  paidAt: z.string().datetime().nullable(),
  voidedAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
  payoutBatchId: z.string().nullable(),
  payoutBatchStatus: AffiliatePayoutStatusSchema.nullable(),
});
export type AffiliateCommissionLedgerEntry = z.infer<typeof AffiliateCommissionLedgerEntrySchema>;

export const AffiliatePayoutBatchSummarySchema = z.object({
  id: z.string(),
  status: AffiliatePayoutStatusSchema,
  currency: z.string(),
  totalAmountCents: z.number().int().nonnegative(),
  commissionCount: z.number().int().nonnegative(),
  periodStart: z.string().datetime(),
  periodEnd: z.string().datetime(),
  exportedAt: z.string().datetime().nullable(),
  paidAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
});
export type AffiliatePayoutBatchSummary = z.infer<typeof AffiliatePayoutBatchSummarySchema>;

export const AffiliatePartnerCommissionHistorySchema = z.object({
  commissions: z.array(AffiliateCommissionLedgerEntrySchema).default([]),
  payouts: z.array(AffiliatePayoutBatchSummarySchema).default([]),
});
export type AffiliatePartnerCommissionHistory = z.infer<typeof AffiliatePartnerCommissionHistorySchema>;

export const AffiliateAdminPayoutBatchListItemSchema = z.object({
  id: z.string(),
  status: AffiliatePayoutStatusSchema,
  currency: z.string(),
  totalAmount: z.number().int().nonnegative(),
  commissionCount: z.number().int().nonnegative(),
  periodStart: z.string().datetime(),
  periodEnd: z.string().datetime(),
  notes: z.string().nullable(),
  exportedAt: z.string().datetime().nullable(),
  paidAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
});
export type AffiliateAdminPayoutBatchListItem = z.infer<typeof AffiliateAdminPayoutBatchListItemSchema>;

export const AffiliateAdminPayoutBatchListSchema = z.object({
  items: z.array(AffiliateAdminPayoutBatchListItemSchema).default([]),
  total: z.number().int().nonnegative(),
  page: z.number().int().positive(),
  limit: z.number().int().positive(),
});
export type AffiliateAdminPayoutBatchList = z.infer<typeof AffiliateAdminPayoutBatchListSchema>;

export const AffiliateAdminPayoutBatchExportSchema = z.object({
  batchId: z.string(),
  fileName: z.string(),
  exportedAt: z.string().datetime(),
  rowCount: z.number().int().nonnegative(),
  csv: z.string(),
});
export type AffiliateAdminPayoutBatchExport = z.infer<typeof AffiliateAdminPayoutBatchExportSchema>;

export const AffiliateAdminFraudReferralQueueItemSchema = z.object({
  id: z.string(),
  partnerId: z.string(),
  partnerName: z.string(),
  referredAgencyId: z.string(),
  referredAgencyName: z.string(),
  status: AffiliateReferralStatusSchema,
  riskReasons: z.array(z.string()).default([]),
  createdAt: z.string().datetime(),
  qualifiedAt: z.string().datetime().nullable(),
  commissionCount: z.number().int().nonnegative(),
});
export type AffiliateAdminFraudReferralQueueItem = z.infer<typeof AffiliateAdminFraudReferralQueueItemSchema>;

export const AffiliateAdminFraudCommissionQueueItemSchema = z.object({
  id: z.string(),
  referralId: z.string(),
  partnerId: z.string(),
  partnerName: z.string(),
  customerName: z.string(),
  status: AffiliateCommissionStatusSchema,
  amountCents: z.number().int().nonnegative(),
  holdUntil: z.string().datetime(),
  createdAt: z.string().datetime(),
  riskReasons: z.array(z.string()).default([]),
  notes: z.string().nullable(),
});
export type AffiliateAdminFraudCommissionQueueItem = z.infer<typeof AffiliateAdminFraudCommissionQueueItemSchema>;

export const AffiliateAdminFraudQueueSchema = z.object({
  referrals: z.array(AffiliateAdminFraudReferralQueueItemSchema).default([]),
  commissions: z.array(AffiliateAdminFraudCommissionQueueItemSchema).default([]),
  counts: z.object({
    flaggedReferrals: z.number().int().nonnegative(),
    flaggedCommissions: z.number().int().nonnegative(),
  }),
});
export type AffiliateAdminFraudQueue = z.infer<typeof AffiliateAdminFraudQueueSchema>;

export const AffiliateAdminPartnerListItemSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string().email(),
  companyName: z.string().nullable(),
  websiteUrl: z.string().url().nullable(),
  audienceSize: AffiliateAudienceSizeSchema.nullable(),
  status: AffiliatePartnerStatusSchema,
  applicationNotes: z.string().nullable(),
  defaultCommissionBps: z.number().int().min(0).max(10000),
  commissionDurationMonths: z.number().int().min(1).max(60),
  appliedAt: z.string().datetime(),
  approvedAt: z.string().datetime().nullable(),
  rejectedAt: z.string().datetime().nullable(),
  disabledAt: z.string().datetime().nullable(),
  referralCount: z.number().int().nonnegative(),
  commissionCount: z.number().int().nonnegative(),
  linkCount: z.number().int().nonnegative(),
});
export type AffiliateAdminPartnerListItem = z.infer<typeof AffiliateAdminPartnerListItemSchema>;

export const AffiliateAdminPartnerListSchema = z.object({
  items: z.array(AffiliateAdminPartnerListItemSchema).default([]),
  total: z.number().int().nonnegative(),
  page: z.number().int().positive(),
  limit: z.number().int().positive(),
});
export type AffiliateAdminPartnerList = z.infer<typeof AffiliateAdminPartnerListSchema>;

export const AffiliateAdminPartnerMetricsSchema = z.object({
  clicks: z.number().int().nonnegative(),
  referrals: z.number().int().nonnegative(),
  commissions: z.number().int().nonnegative(),
  pendingCommissionCents: z.number().int().nonnegative(),
  paidCommissionCents: z.number().int().nonnegative(),
});
export type AffiliateAdminPartnerMetrics = z.infer<typeof AffiliateAdminPartnerMetricsSchema>;

export const AffiliateAdminLinkDetailSchema = z.object({
  id: z.string(),
  code: z.string(),
  status: AffiliateLinkStatusSchema,
  destinationPath: z.string(),
  campaign: z.string().nullable(),
  url: z.string().url(),
  clickCount: z.number().int().nonnegative(),
  createdAt: z.string().datetime(),
});
export type AffiliateAdminLinkDetail = z.infer<typeof AffiliateAdminLinkDetailSchema>;

export const AffiliateAdminReferralDetailSchema = z.object({
  id: z.string(),
  status: z.string(),
  referredAgencyName: z.string(),
  attributionSource: z.string(),
  commissionBps: z.number().int().min(0).max(10000),
  commissionDurationMonths: z.number().int().min(1).max(60),
  createdAt: z.string().datetime(),
  qualifiedAt: z.string().datetime().nullable(),
  disqualifiedAt: z.string().datetime().nullable(),
  disqualificationReason: z.string().nullable(),
  riskReasons: z.array(z.string()).default([]),
});
export type AffiliateAdminReferralDetail = z.infer<typeof AffiliateAdminReferralDetailSchema>;

export const AffiliateAdminCommissionDetailSchema = z.object({
  id: z.string(),
  customerName: z.string(),
  status: AffiliateCommissionStatusSchema,
  amountCents: z.number().int(),
  revenueAmountCents: z.number().int(),
  commissionBps: z.number().int().min(0).max(10000),
  holdUntil: z.string().datetime(),
  approvedAt: z.string().datetime().nullable(),
  paidAt: z.string().datetime().nullable(),
  voidedAt: z.string().datetime().nullable(),
  invoiceDate: z.string().datetime().nullable(),
  notes: z.string().nullable(),
  createdAt: z.string().datetime(),
});
export type AffiliateAdminCommissionDetail = z.infer<typeof AffiliateAdminCommissionDetailSchema>;

export const AffiliateAdminPartnerDetailSchema = z.object({
  partner: AffiliateAdminPartnerListItemSchema,
  metrics: AffiliateAdminPartnerMetricsSchema,
  links: z.array(AffiliateAdminLinkDetailSchema).default([]),
  referrals: z.array(AffiliateAdminReferralDetailSchema).default([]),
  commissions: z.array(AffiliateAdminCommissionDetailSchema).default([]),
});
export type AffiliateAdminPartnerDetail = z.infer<typeof AffiliateAdminPartnerDetailSchema>;

export const AffiliateAdminPartnerMutationSchema = z.object({
  status: AffiliatePartnerStatusSchema.optional(),
  defaultCommissionBps: z.number().int().min(0).max(10000).optional(),
  commissionDurationMonths: z.number().int().min(1).max(60).optional(),
  internalNotes: z.string().max(5000).optional(),
}).refine((value) => Object.keys(value).length > 0, {
  message: 'At least one affiliate partner field is required',
});
export type AffiliateAdminPartnerMutation = z.infer<typeof AffiliateAdminPartnerMutationSchema>;

export const AffiliateAdminReferralDisqualificationSchema = z.object({
  reason: z.string().min(2).max(120),
  internalNotes: z.string().min(2).max(5000),
});
export type AffiliateAdminReferralDisqualificationInput = z.infer<typeof AffiliateAdminReferralDisqualificationSchema>;

export const AffiliateAdminReferralReviewResolutionSchema = z.object({
  resolution: z.enum(['clear', 'keep_review_required', 'disqualify']),
  reason: z.string().min(2).max(120),
  internalNotes: z.string().min(2).max(5000),
});
export type AffiliateAdminReferralReviewResolutionInput = z.infer<typeof AffiliateAdminReferralReviewResolutionSchema>;

export const AffiliateAdminCommissionAdjustmentSchema = z.object({
  amountCents: z.number().int().nonnegative().optional(),
  status: AffiliateCommissionStatusSchema.optional(),
  internalNotes: z.string().min(2).max(5000),
}).refine((value) => value.amountCents !== undefined || value.status !== undefined, {
  message: 'At least one commission adjustment field is required',
});
export type AffiliateAdminCommissionAdjustment = z.infer<typeof AffiliateAdminCommissionAdjustmentSchema>;

// ============================================================
// SUBSCRIPTION TIERS & QUOTA MANAGEMENT
// ============================================================

// Subscription tiers - updated for Creem integration
export const SubscriptionTierSchema = z.enum(['STARTER', 'GROWTH', 'AGENCY']);
export type SubscriptionTier = z.infer<typeof SubscriptionTierSchema>;

export const BillingIntervalSchema = z.enum(['monthly', 'yearly']);
export type BillingInterval = z.infer<typeof BillingIntervalSchema>;

export const SUBSCRIPTION_TIER_NAMES: Record<SubscriptionTier, string> = {
  STARTER: 'Starter',
  GROWTH: 'Growth',
  AGENCY: 'Agency',
};

// Pricing display tiers shown in billing UIs and Clerk metadata
export const PricingDisplayTierSchema = z.enum(['STARTER', 'GROWTH', 'AGENCY']);
export type PricingDisplayTier = z.infer<typeof PricingDisplayTierSchema>;

export const PRICING_DISPLAY_TIER_ORDER: PricingDisplayTier[] = ['STARTER', 'GROWTH', 'AGENCY'];

export const PRICING_DISPLAY_TIER_NAMES: Record<PricingDisplayTier, string> = {
  STARTER: 'Starter',
  GROWTH: 'Growth',
  AGENCY: 'Agency',
};

export const PRICING_DISPLAY_TIER_DETAILS: Record<PricingDisplayTier, {
  name: string;
  persona: string;
  description: string;
  monthlyPrice: number;
  yearlyPrice: number;
}> = {
  STARTER: {
    name: 'Starter',
    persona: 'For small agencies',
    description: 'Agencies getting started with access automation',
    monthlyPrice: 29,
    yearlyPrice: 290,
  },
  GROWTH: {
    name: 'Growth',
    persona: 'For growing agencies',
    description: 'Agencies scaling their client operations',
    monthlyPrice: 79,
    yearlyPrice: 790,
  },
  AGENCY: {
    name: 'Agency',
    persona: 'For established agencies',
    description: 'High-volume agencies with advanced needs',
    monthlyPrice: 149,
    yearlyPrice: 1490,
  },
};

export const SUBSCRIPTION_TIER_TO_PRICING_DISPLAY_TIER: Record<SubscriptionTier, PricingDisplayTier> = {
  STARTER: 'STARTER',
  GROWTH: 'GROWTH',
  AGENCY: 'AGENCY',
};

export const PRICING_DISPLAY_TIER_TO_SUBSCRIPTION_TIER: Record<PricingDisplayTier, SubscriptionTier | null> = {
  STARTER: 'STARTER',
  GROWTH: 'GROWTH',
  AGENCY: 'AGENCY',
};

export function getPricingDisplayTierFromSubscriptionTier(
  tier: SubscriptionTier | null | undefined
): PricingDisplayTier {
  if (!tier) return 'STARTER';
  return SUBSCRIPTION_TIER_TO_PRICING_DISPLAY_TIER[tier];
}

export function getPricingTierNameFromSubscriptionTier(tier: SubscriptionTier): string {
  const displayTier = getPricingDisplayTierFromSubscriptionTier(tier);
  return PRICING_DISPLAY_TIER_NAMES[displayTier];
}

// Subscription status types
export const SubscriptionStatusSchema = z.enum([
  'active',
  'canceled',
  'past_due',
  'incomplete',
  'incomplete_expired',
  'trialing',
]);
export type SubscriptionStatus = z.infer<typeof SubscriptionStatusSchema>;

// ============================================================
// CREEM-SPECIFIC SUBSCRIPTION TYPES
// ============================================================

// Creem subscription details from API
export interface CreemSubscription {
  id: string;
  customerId: string;
  productId: string;
  status: SubscriptionStatus;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  cancelAtPeriodEnd: boolean;
  trialStart?: string;
  trialEnd?: string;
  createdAt: string;
  updatedAt: string;
}

// Creem invoice details
export interface CreemInvoice {
  id: string;
  subscriptionId: string;
  amount: number; // in cents
  currency: string;
  status: 'draft' | 'open' | 'paid' | 'void' | 'uncollectible';
  invoiceDate?: string;
  dueDate?: string;
  paidAt?: string;
  invoiceUrl?: string;
  invoicePdfUrl?: string;
}

// ============================================================
// TIER LIMITS CONFIGURATION
// ============================================================

// Tier limits for different resources
export interface TierLimits {
  accessRequests: {
    limit: number | 'unlimited';
    used: number;
    remaining: number;
  };
  clients: {
    limit: number | 'unlimited';
    used: number;
    remaining: number;
  };
  members: {
    limit: number | 'unlimited';
    used: number;
    remaining: number;
  };
  templates: {
    limit: number | 'unlimited';
    used: number;
    remaining: number;
  };
}

export type TierLimitsDetails = TierLimits;

// Tier limits configuration (source of truth)
export const TIER_LIMITS: Record<SubscriptionTier, {
  accessRequests: number;
  clients: number;
  members: number;
  templates: number;
  clientOnboards: number;
  platformAudits: number;
  teamSeats: number;
  features: string[];
  priceMonthly: number;
  priceYearly: number;
  description: string;
}> = {
  STARTER: {
    accessRequests: 5,
    clients: 5,
    members: -1,
    templates: 3,
    clientOnboards: 36,
    platformAudits: 120,
    teamSeats: -1,
    features: ['all_platforms', 'email_support'],
    priceMonthly: 29,
    priceYearly: 290,
    description: 'Perfect for small agencies getting started',
  },
  GROWTH: {
    accessRequests: 20,
    clients: 20,
    members: -1,
    templates: 10,
    clientOnboards: 120,
    platformAudits: 600,
    teamSeats: -1,
    features: ['all_platforms', 'priority_support', 'custom_branding', 'api_access', 'white_label'],
    priceMonthly: 79,
    priceYearly: 790,
    description: 'For established agencies scaling fast',
  },
  AGENCY: {
    accessRequests: 50,
    clients: 50,
    members: -1,
    templates: 20,
    clientOnboards: 600,
    platformAudits: 3000,
    teamSeats: -1,
    features: ['all_platforms', 'priority_support', 'custom_branding', 'api_access', 'multi_brand'],
    priceMonthly: 149,
    priceYearly: 1490,
    description: 'For growing agencies with more clients',
  },
};

// Free tier limits for users without a subscription
// Aligns with marketing site: 1 active client, core platforms only
export const FREE_TIER_LIMITS: {
  accessRequests: number;
  clients: number;
  members: number;
  templates: number;
  clientOnboards: number;
  platformAudits: number;
  teamSeats: number;
  features: string[];
  priceMonthly: number;
  priceYearly: number;
  description: string;
} = {
  accessRequests: 3,
  clients: 1,
  members: 1,
  templates: 1,
  clientOnboards: 3,
  platformAudits: 10,
  teamSeats: 1,
  features: ['core_platforms', 'email_support'],
  priceMonthly: 0,
  priceYearly: 0,
  description: 'Solo freelancers testing OAuth automation',
};

/**
 * Get tier limits config for a given subscription tier.
 * Returns FREE_TIER_LIMITS when tier is null/undefined (no subscription).
 * Handles legacy 'FREE' tier by mapping to STARTER (pre-launch defensive coding).
 */
export function getTierLimitsConfig(tier: SubscriptionTier | null | undefined | string) {
  // Handle null/undefined (no subscription)
  if (!tier) return FREE_TIER_LIMITS;

  // Handle legacy FREE tier (pre-launch defensive coding)
  // Maps legacy FREE tier to STARTER limits
  if (tier === 'FREE') {
    console.warn('[LEGACY_TIER] Encountered deprecated FREE tier. Mapping to STARTER tier limits.');
    return TIER_LIMITS.STARTER;
  }

  // Handle unknown tiers gracefully
  if (!(tier in TIER_LIMITS)) {
    console.error(`[UNKNOWN_TIER] Encountered unknown tier: ${tier}. Defaulting to STARTER tier limits.`);
    return TIER_LIMITS.STARTER;
  }

  return TIER_LIMITS[tier as SubscriptionTier];
}

// Detailed tier information for UI display
// Aligns with marketing site pricing at https://www.authhub.co/pricing
export const SUBSCRIPTION_TIER_DESCRIPTIONS: Record<SubscriptionTier, {
  title: string;
  description: string;
  price: { monthly: number; yearly: number };
  features: string[];
}> = {
  STARTER: {
    title: 'Starter',
    description: 'For growing agencies getting started',
    price: { monthly: 29, yearly: 288 },
    features: [
      '60 client onboards/year',
      '300 platform audits',
      'All platform integrations',
      'Email support',
      'Team access',
      'Webhooks & API',
    ],
  },
  GROWTH: {
    title: 'Growth',
    description: 'For established agencies scaling fast',
    price: { monthly: 79, yearly: 768 },
    features: [
      '120 client onboards/year',
      '600 platform audits',
      'White-label branding',
      'Custom domain/subdomain',
      'Unlimited team seats',
      'Webhooks & API',
      'Priority support',
      'Multi-brand accounts',
      'Custom integrations',
    ],
  },
  AGENCY: {
    title: 'Agency',
    description: 'For large agencies with multi-brand needs',
    price: { monthly: 149, yearly: 1440 },
    features: [
      '600 client onboards/year',
      '3,000 platform audits',
      'White-label branding',
      'Custom domain/subdomain',
      'Unlimited team seats',
      'Webhooks & API',
      'Multi-brand accounts (3)',
      'API access',
      'Custom integrations',
      'Priority support (dedicated)',
      'SLA guarantee',
    ],
  },
};

/** Tier order for upgrade sequencing (lowest to highest). */
const SUBSCRIPTION_TIER_ORDER: SubscriptionTier[] = ['STARTER', 'GROWTH', 'AGENCY'];

/** Tiers that have Creem checkout configured (STARTER, GROWTH, AGENCY). */
const CREEM_CHECKOUT_TIERS: SubscriptionTier[] = ['STARTER', 'GROWTH', 'AGENCY'];

/**
 * Returns the next tier up from the current tier that has Creem checkout.
 * Use for Upgrade buttons that should redirect to Creem checkout.
 * Returns null when no next tier exists or next tier lacks Creem checkout (→ use Contact Sales).
 */
export function getNextTierForCheckout(
  currentTier: SubscriptionTier | null | undefined
): SubscriptionTier | null {
  if (!currentTier) return 'STARTER';
  const idx = SUBSCRIPTION_TIER_ORDER.indexOf(currentTier);
  if (idx < 0 || idx >= SUBSCRIPTION_TIER_ORDER.length - 1) return null;
  const next = SUBSCRIPTION_TIER_ORDER[idx + 1];
  return CREEM_CHECKOUT_TIERS.includes(next) ? next : null;
}

// ============================================================
// USAGE QUOTA TYPES
// ============================================================

// Usage metric types for quota tracking (legacy, for backward compatibility)
export const MetricTypeSchema = z.enum([
  'client_onboards',
  'platform_audits',
  'team_seats',
  'access_requests',
  'clients',
  'members',
  'templates',
]);
export type MetricType = z.infer<typeof MetricTypeSchema>;

// Usage snapshot for dashboard display
export interface UsageSnapshot {
  agencyId: string;
  tier: SubscriptionTier;
  tierName: string;
  metrics: {
    clientOnboards: MetricUsage;
    platformAudits: MetricUsage;
    teamSeats: MetricUsage;
  };
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
}

// ============================================================
// DASHBOARD SUMMARY TYPES
// ============================================================

export const DashboardSummarySliceMetaSchema = z.object({
  limit: z.number().int().nonnegative(),
  returned: z.number().int().nonnegative(),
  total: z.number().int().nonnegative(),
  hasMore: z.boolean(),
});
export type DashboardSummarySliceMeta = z.infer<typeof DashboardSummarySliceMetaSchema>;

export const DashboardRequestSummarySchema = z.object({
  id: z.string(),
  clientId: z.string().nullable().optional(),
  clientName: z.string(),
  clientEmail: z.string(),
  status: z.string(),
  createdAt: z.string(),
  uniqueToken: z.string(),
  platforms: z.array(z.string()),
});
export type DashboardRequestSummary = z.infer<typeof DashboardRequestSummarySchema>;

export const DashboardConnectionSummarySchema = z.object({
  id: z.string(),
  clientId: z.string().nullable().optional(),
  clientEmail: z.string(),
  status: z.string(),
  createdAt: z.string(),
  platforms: z.array(z.string()),
});
export type DashboardConnectionSummary = z.infer<typeof DashboardConnectionSummarySchema>;

export const DashboardSummaryMetaSchema = z.object({
  requests: DashboardSummarySliceMetaSchema,
  connections: DashboardSummarySliceMetaSchema,
});
export type DashboardSummaryMeta = z.infer<typeof DashboardSummaryMetaSchema>;

export const DashboardOnboardingStatusSchema = z.object({
  completed: z.boolean(),
  status: UnifiedOnboardingStatusSchema,
  lifecycle: UnifiedOnboardingProgressFieldsSchema.optional(),
  step: z.object({
    profile: z.boolean(),
    members: z.boolean(),
    firstRequest: z.boolean(),
  }),
});
export type DashboardOnboardingStatus = z.infer<typeof DashboardOnboardingStatusSchema>;

export const DashboardTrialBannerSchema = z.object({
  tier: SubscriptionTierSchema,
  trialEnd: z.string(),
});
export type DashboardTrialBanner = z.infer<typeof DashboardTrialBannerSchema>;

export const DashboardPayloadSchema = z.object({
  agency: z.object({
    id: z.string(),
    name: z.string(),
    email: z.string(),
  }),
  stats: z.object({
    totalRequests: z.number().int().nonnegative(),
    pendingRequests: z.number().int().nonnegative(),
    activeConnections: z.number().int().nonnegative(),
    totalPlatforms: z.number().int().nonnegative(),
  }),
  requests: z.array(DashboardRequestSummarySchema),
  connections: z.array(DashboardConnectionSummarySchema),
  meta: DashboardSummaryMetaSchema,
  onboardingStatus: DashboardOnboardingStatusSchema.nullable().optional(),
  trialBanner: DashboardTrialBannerSchema.nullable().optional(),
});
export type DashboardPayload = z.infer<typeof DashboardPayloadSchema>;

export interface MetricUsage {
  used: number;
  limit: number;
  remaining: number;
  percentage: number;
  resetsAt?: Date;
  isUnlimited: boolean;
}

// Usage quota check result
export interface QuotaCheckResult {
  allowed: boolean;
  metric: MetricType;
  limit: number;
  used: number;
  remaining: number;
  resetsAt?: Date;
}

// Quota exceeded error response
export interface QuotaExceededError {
  code: 'QUOTA_EXCEEDED';
  message: string;
  metric: MetricType;
  limit: number;
  used: number;
  resetsAt?: Date;
  upgradeUrl: string;
  currentTier: SubscriptionTier;
  suggestedTier: SubscriptionTier;
}

// Clerk metadata schemas
export interface ClerkPublicMetadata extends Record<string, unknown> {
  subscriptionTier: SubscriptionTier;
  tierName: string;
  features: string[];
}

export interface ClerkPrivateMetadata extends Record<string, unknown> {
  quotaLimits: {
    clientOnboards: { limit: number; used: number; resetsAt: string };
    platformAudits: { limit: number; used: number; resetsAt: string };
    teamSeats: { limit: number; used: number };
  };
  subscriptionStatus: 'active' | 'past_due' | 'canceled' | 'trialing';
  subscriptionId?: string;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  trialEndsAt?: string;
}

// Client statistics for the detail page
export interface ClientStats {
  totalRequests: number;
  activeConnections: number;
  pendingConnections: number;
  expiredConnections: number;
}

// Activity timeline item for the client's activity tab
export interface ClientActivityItem {
  id: string;
  type: 'request_created' | 'request_completed' | 'connection_created' | 'connection_revoked' | 'client_updated';
  description: string;
  timestamp: Date;
  metadata?: {
    requestName?: string;
    platforms?: Platform[];
    status?: string;
  };
}

// Access request with connection status for client detail page
export interface ClientAccessRequest {
  id: string;
  name: string;
  platforms: Platform[];
  status: 'pending' | 'partial' | 'completed' | 'expired' | 'revoked';
  createdAt: Date;
  authorizedAt?: Date;
  connectionId?: string;
  connectionStatus?: 'active' | 'revoked' | 'expired';
}

export const ClientDetailPlatformGroupStatusSchema = z.enum([
  'connected',
  'partial',
  'pending',
  'expired',
  'revoked',
  'needs_follow_up',
]);
export type ClientDetailPlatformGroupStatus = z.infer<typeof ClientDetailPlatformGroupStatusSchema>;

export const ClientDetailProductStatusSchema = z.enum([
  'connected',
  'pending',
  'selection_required',
  'no_assets',
  'expired',
  'revoked',
]);
export type ClientDetailProductStatus = z.infer<typeof ClientDetailProductStatusSchema>;

export interface ClientDetailPlatformProduct {
  product: string;
  status: ClientDetailProductStatus;
  note?: string;
  latestRequestId?: string;
  googleGrantLifecycle?: GoogleProductGrantLifecycle;
}

export interface ClientDetailPlatformGroup {
  platformGroup: Platform;
  status: ClientDetailPlatformGroupStatus;
  fulfilledCount: number;
  requestedCount: number;
  latestRequestId?: string;
  latestRequestName?: string;
  latestRequestedAt?: Date;
  products: ClientDetailPlatformProduct[];
}

// Client detail page API response
export interface ClientDetailResponse {
  client: {
    id: string;
    name: string;
    company: string;
    email: string;
    website: string | null;
    language: ClientLanguage;
    createdAt: Date;
    updatedAt: Date;
  };
  stats: ClientStats;
  platformGroups: ClientDetailPlatformGroup[];
  accessRequests: ClientAccessRequest[];
  activity: ClientActivityItem[];
}
