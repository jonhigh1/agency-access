import {
  META_CORE_PERMISSIONS,
  META_GRAPH_VERSION,
  REVIEW_DEMO_AD_ACCOUNT_PARTNER_TASKS,
  REVIEW_DEMO_STEP_ORDER,
  type ReviewDemoIdentity,
  type ReviewDemoSession,
  type ReviewDemoStepId,
  type ReviewDemoStepPayload,
} from '@agency-platform/shared';
import { env } from '@/lib/env.js';
import { infisical } from '@/lib/infisical.js';
import { formatMetaGraphOpCaption } from '@agency-platform/shared';
import { getRecordedMetaGraphOps, metaGraphFetch } from '@/lib/meta-graph-instrumentation.js';
import { MetaConnector } from '@/services/connectors/meta.js';
import { auditService } from '@/services/audit.service.js';
import { oauthStateService } from '@/services/oauth-state.service.js';
import { resolveClientInviteCallbackUrl } from '@/routes/client-auth/redirect-uri.js';
import { clientAssetsService } from '@/services/client-assets.service.js';
import { metaPartnerService } from '@/services/meta-partner.service.js';
import {
  formatMetaGraphApiError,
  readMetaGraphApiError,
} from '@/services/review-demo-graph-errors.js';

const GRAPH_BASE = `https://graph.facebook.com/${META_GRAPH_VERSION}`;

interface ReviewDemoStoredToken {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: string;
  scope?: string;
  identity?: ReviewDemoIdentity;
}

function reviewDemoSecretName(clerkUserId: string): string {
  return `review_demo_meta_${clerkUserId}`;
}

function defaultSandboxIds() {
  return {
    businessManagerId: env.META_REVIEW_BM_ID ?? '695982475048959',
    adAccountId: normalizeAdAccountId(env.META_REVIEW_AD_ACCOUNT_ID ?? '557538895783894'),
    pageId: env.META_REVIEW_PAGE_ID ?? '1373353139192376',
    agencyBusinessId: env.META_REVIEW_AGENCY_BM_ID ?? '3808519629379919',
  };
}

function requireAgencyBusinessIdForLiveGraph(): string {
  const configured = env.META_REVIEW_AGENCY_BM_ID?.trim();
  if (!configured) {
    throw new Error(
      'META_REVIEW_AGENCY_BM_ID must be set to the agency sandbox Business Portfolio id for review-demo partner assignment'
    );
  }
  return configured;
}

function normalizeAdAccountId(value: string): string {
  const trimmed = value.trim();
  if (trimmed.startsWith('act_')) return trimmed;
  return `act_${trimmed.replace(/^act_/, '')}`;
}

async function readStoredToken(clerkUserId: string): Promise<ReviewDemoStoredToken | null> {
  try {
    const raw = await infisical.getPlainSecret(reviewDemoSecretName(clerkUserId));
    return JSON.parse(raw) as ReviewDemoStoredToken;
  } catch {
    return null;
  }
}

async function writeStoredToken(clerkUserId: string, value: ReviewDemoStoredToken): Promise<void> {
  await infisical.storePlainSecret(reviewDemoSecretName(clerkUserId), JSON.stringify(value));
}

function graphCaptionsSince(start: number): string[] {
  return getRecordedMetaGraphOps()
    .slice(start)
    .map((op) => formatMetaGraphOpCaption(op));
}

export class ReviewDemoService {
  getSandboxConfig() {
    return defaultSandboxIds();
  }

  async getSession(clerkUserId: string, activeStep: ReviewDemoStepId): Promise<ReviewDemoSession> {
    const stored = await readStoredToken(clerkUserId);
    const stepIndex = REVIEW_DEMO_STEP_ORDER.indexOf(activeStep);
    const sandbox = defaultSandboxIds();

    const mockIdentity: ReviewDemoIdentity = {
      id: '61595281164997',
      name: 'AuthHub Review User (mock)',
    };

    if (env.META_REVIEW_DEMO_MOCK_GRAPH) {
      return {
        connected: true,
        identity: stored?.identity ?? mockIdentity,
        grantedPermissions: [...META_CORE_PERMISSIONS],
        activeStep,
        stepIndex: stepIndex >= 0 ? stepIndex : 0,
        stepCount: REVIEW_DEMO_STEP_ORDER.length,
        sandbox,
      };
    }

    return {
      connected: Boolean(stored?.accessToken),
      identity: stored?.identity ?? null,
      grantedPermissions: [...META_CORE_PERMISSIONS],
      activeStep,
      stepIndex: stepIndex >= 0 ? stepIndex : 0,
      stepCount: REVIEW_DEMO_STEP_ORDER.length,
      sandbox,
    };
  }

  async createMetaAuthUrl(input: {
    clerkUserId: string;
    userEmail: string;
    headers: { origin?: string | string[]; referer?: string | string[] };
  }): Promise<{ authUrl: string; state: string }> {
    const redirectUri = resolveClientInviteCallbackUrl(input.headers);

    const agencyId = env.META_REVIEW_LAB_AGENCY_ID ?? 'review-lab-agency';
    const stateResult = await oauthStateService.createState({
      agencyId,
      platform: 'meta',
      userEmail: input.userEmail,
      redirectUrl: redirectUri,
      timestamp: Date.now(),
      reviewDemo: true,
      clerkUserId: input.clerkUserId,
    });

    if (stateResult.error || !stateResult.data) {
      throw new Error(stateResult.error?.message ?? 'Failed to create OAuth state');
    }

    const connector = new MetaConnector();
    const authUrl = connector.getAuthUrl(stateResult.data, [...META_CORE_PERMISSIONS], redirectUri);

    return { authUrl, state: stateResult.data };
  }

  async isReviewDemoOAuthState(stateToken: string): Promise<boolean> {
    const peek = await oauthStateService.peekState(stateToken);
    if (peek.error || !peek.data) {
      return false;
    }
    return peek.data.reviewDemo === true;
  }

  async completeMetaOAuth(input: {
    clerkUserId: string;
    userEmail: string;
    code: string;
    state: string;
    ipAddress?: string;
    userAgent?: string;
  }): Promise<ReviewDemoIdentity> {
    const stateResult = await oauthStateService.validateState(input.state);
    if (stateResult.error || !stateResult.data) {
      throw new Error('Invalid or expired OAuth state');
    }

    const stateData = stateResult.data;
    if (!stateData.reviewDemo || stateData.clerkUserId !== input.clerkUserId) {
      throw new Error('OAuth state is not authorized for this review demo session');
    }

    const redirectUri = stateData.redirectUrl;
    if (!redirectUri) {
      throw new Error('Missing OAuth redirect URL in state');
    }

    const connector = new MetaConnector();
    let tokens = await connector.exchangeCode(input.code, redirectUri);
    if (connector.getLongLivedToken) {
      tokens = await connector.getLongLivedToken(tokens.accessToken);
    }

    const profileResponse = await metaGraphFetch(
      `${GRAPH_BASE}/me?fields=id,name,picture`,
      { method: 'GET', accessToken: tokens.accessToken, tokenClass: 'client_user' }
    );
    if (!profileResponse.ok) {
      throw new Error(await profileResponse.text());
    }
    const profile = (await profileResponse.json()) as {
      id?: string;
      name?: string;
      picture?: { data?: { url?: string } };
    };
    if (!profile.id || !profile.name) {
      throw new Error('Meta did not return a user profile for review demo');
    }
    const identity: ReviewDemoIdentity = {
      id: profile.id,
      name: profile.name,
      ...(profile.picture?.data?.url ? { pictureUrl: profile.picture.data.url } : {}),
    };

    await writeStoredToken(input.clerkUserId, {
      accessToken: tokens.accessToken,
      expiresAt: tokens.expiresAt?.toISOString(),
      identity,
    });

    await auditService.createAuditLog({
      userEmail: input.userEmail,
      action: 'access_granted',
      resourceType: 'review_demo',
      resourceId: input.clerkUserId,
      ipAddress: input.ipAddress ?? '0.0.0.0',
      userAgent: input.userAgent,
      metadata: {
        surface: 'review_demo_meta_oauth',
        metaUserId: identity.id,
      },
    });

    return identity;
  }

  private async getAccessToken(clerkUserId: string, userEmail: string, ipAddress?: string, userAgent?: string): Promise<string> {
    if (env.META_REVIEW_DEMO_MOCK_GRAPH) {
      return 'mock-review-demo-token';
    }

    const stored = await readStoredToken(clerkUserId);
    if (!stored?.accessToken) {
      throw new Error('Connect Meta before loading review demo proof');
    }

    await auditService.createAuditLog({
      userEmail,
      action: 'token_viewed',
      resourceType: 'review_demo',
      resourceId: clerkUserId,
      ipAddress: ipAddress ?? '0.0.0.0',
      userAgent,
      metadata: { surface: 'review_demo', clerkUserId },
    });

    return stored.accessToken;
  }

  async loadStepPayload(input: {
    clerkUserId: string;
    userEmail: string;
    stepId: ReviewDemoStepId;
    ipAddress?: string;
    userAgent?: string;
  }): Promise<ReviewDemoStepPayload> {
    if (env.META_REVIEW_DEMO_MOCK_GRAPH) {
      return this.loadMockStepPayload(input.stepId);
    }

    const accessToken = await this.getAccessToken(
      input.clerkUserId,
      input.userEmail,
      input.ipAddress,
      input.userAgent
    );
    const opsStart = getRecordedMetaGraphOps().length;
    const sandbox = defaultSandboxIds();
    const agencyBusinessId = requireAgencyBusinessIdForLiveGraph();

    switch (input.stepId) {
      case 'pages_show_list':
        return this.loadPagesShowList(accessToken, opsStart);
      case 'pages_read_engagement':
        return this.loadPagesReadEngagement(accessToken, sandbox.pageId, opsStart);
      case 'ads_management':
        return this.loadAdsManagement(accessToken, sandbox.adAccountId, agencyBusinessId, opsStart, {
          includePartnerReadback: false,
        });
      case 'business_management':
        return this.loadBusinessManagement(accessToken, sandbox, opsStart);
      default: {
        const _exhaustive: never = input.stepId;
        throw new Error(`Unsupported review demo step: ${String(_exhaustive)}`);
      }
    }
  }

  async checkAdAccountAgencyPartner(input: {
    clerkUserId: string;
    userEmail: string;
    ipAddress?: string;
    userAgent?: string;
  }): Promise<ReviewDemoStepPayload> {
    if (env.META_REVIEW_DEMO_MOCK_GRAPH) {
      const base = this.loadMockStepPayload('ads_management');
      if (base.stepId !== 'ads_management') {
        return base;
      }
      return {
        ...base,
        agencyPartner: {
          ...base.agencyPartner,
          verified: true,
          permittedTasks: ['ADVERTISE', 'ANALYZE'],
          pendingMessage: undefined,
        },
      };
    }

    const accessToken = await this.getAccessToken(
      input.clerkUserId,
      input.userEmail,
      input.ipAddress,
      input.userAgent
    );
    const opsStart = getRecordedMetaGraphOps().length;
    const sandbox = defaultSandboxIds();
    const agencyBusinessId = requireAgencyBusinessIdForLiveGraph();

    const payload = await this.loadAdsManagement(accessToken, sandbox.adAccountId, agencyBusinessId, opsStart, {
      includePartnerReadback: true,
    });

    await auditService.createAuditLog({
      userEmail: input.userEmail,
      action: 'token_viewed',
      resourceType: 'review_demo',
      resourceId: input.clerkUserId,
      ipAddress: input.ipAddress ?? '0.0.0.0',
      userAgent: input.userAgent,
      metadata: {
        surface: 'review_demo_check_ad_account_partner',
        adAccountId: sandbox.adAccountId,
        agencyBusinessId,
        verified: payload.stepId === 'ads_management' ? payload.agencyPartner.verified : false,
        graphCaptions: graphCaptionsSince(opsStart),
      },
    });

    return payload;
  }

  private async fetchAgencyBusinessName(
    accessToken: string,
    agencyBusinessId: string
  ): Promise<string | undefined> {
    const response = await metaGraphFetch(`${GRAPH_BASE}/${agencyBusinessId}?fields=id,name`, {
      method: 'GET',
      accessToken,
      tokenClass: 'client_user',
    });
    if (!response.ok) {
      return undefined;
    }
    const body = (await response.json()) as { name?: string };
    return body.name;
  }

  private async loadPagesShowList(accessToken: string, opsStart: number): Promise<ReviewDemoStepPayload> {
    const response = await metaGraphFetch(
      `${GRAPH_BASE}/me/accounts?fields=id,name,picture`,
      { method: 'GET', accessToken, tokenClass: 'client_user' }
    );
    if (!response.ok) {
      throw new Error(await response.text());
    }
    const data = (await response.json()) as {
      data?: Array<{ id?: string; name?: string; picture?: { data?: { url?: string } } }>;
    };

    return {
      stepId: 'pages_show_list',
      pages: (data.data ?? [])
        .filter((page): page is { id: string; name: string; picture?: { data?: { url?: string } } } =>
          Boolean(page.id && page.name)
        )
        .map((page) => ({
          id: page.id,
          name: page.name,
          ...(page.picture?.data?.url ? { pictureUrl: page.picture.data.url } : {}),
        })),
      graphCaptions: graphCaptionsSince(opsStart),
    };
  }

  private async loadPagesReadEngagement(
    accessToken: string,
    pageId: string,
    _opsStart: number
  ): Promise<ReviewDemoStepPayload> {
    const proof = await clientAssetsService.fetchPageEngagementProof(accessToken, pageId);
    return {
      stepId: 'pages_read_engagement',
      page: {
        id: proof.page.id,
        name: proof.page.name,
        managedTasks: proof.page.managedTasks,
        ...(proof.page.category ? { category: proof.page.category } : {}),
        ...(typeof proof.page.fanCount === 'number' ? { fanCount: proof.page.fanCount } : {}),
        ...(typeof proof.page.followerCount === 'number'
          ? { followerCount: proof.page.followerCount }
          : {}),
      },
      posts: proof.posts,
      ...(proof.connectedInstagram ? { connectedInstagram: proof.connectedInstagram } : {}),
      graphCaptions: proof.graphOperationCaptions ?? [],
    };
  }

  private async loadAdsManagement(
    accessToken: string,
    adAccountId: string,
    agencyBusinessId: string,
    opsStart: number,
    options: { includePartnerReadback: boolean }
  ): Promise<ReviewDemoStepPayload> {
    const accountResponse = await metaGraphFetch(
      `${GRAPH_BASE}/${adAccountId}?fields=id,name,account_status`,
      { method: 'GET', accessToken, tokenClass: 'client_user' }
    );
    if (!accountResponse.ok) {
      const graphError = await readMetaGraphApiError(accountResponse);
      throw new Error(graphError.displayMessage);
    }
    const account = (await accountResponse.json()) as { id?: string; name?: string };

    const partnerTasks = [...REVIEW_DEMO_AD_ACCOUNT_PARTNER_TASKS];
    const agencyName = await this.fetchAgencyBusinessName(accessToken, agencyBusinessId);

    let permittedTasks: string[] = [];
    let verified = false;
    let metaErrorCode: number | undefined;
    let metaErrorMessage: string | undefined;
    let pendingMessage: string | undefined;

    if (options.includePartnerReadback) {
      try {
        const partnerAccess = await metaPartnerService.verifyAdAccountAgencyAccess(
          accessToken,
          adAccountId,
          agencyBusinessId,
          partnerTasks
        );
        permittedTasks = partnerAccess.assignedTasks;
        verified = partnerAccess.verified;
        if (!partnerAccess.verified) {
          pendingMessage =
            'Ad account has not been shared to the agency business portfolio yet. Complete the manual steps in Meta Business Settings, then run Check access again.';
        }
      } catch (error) {
        const graphError = formatMetaGraphApiError(
          error instanceof Error ? error.message : String(error)
        );
        metaErrorCode = graphError.code;
        metaErrorMessage = graphError.message;
        throw new Error(graphError.displayMessage);
      }
    }

    return {
      stepId: 'ads_management',
      adAccountId,
      ...(account.name ? { adAccountName: account.name } : {}),
      agencyPartner: {
        businessId: agencyBusinessId,
        ...(agencyName ? { name: agencyName } : {}),
        permittedTasks,
        verified,
        ...(metaErrorCode !== undefined ? { metaErrorCode } : {}),
        ...(metaErrorMessage ? { metaErrorMessage } : {}),
        ...(pendingMessage ? { pendingMessage } : {}),
      },
      graphCaptions: graphCaptionsSince(opsStart),
    };
  }

  private async loadBusinessManagement(
    accessToken: string,
    sandbox: ReturnType<typeof defaultSandboxIds>,
    opsStart: number
  ): Promise<ReviewDemoStepPayload> {
    const agencyBusinessId = requireAgencyBusinessIdForLiveGraph();
    const partnerTasks = [...REVIEW_DEMO_AD_ACCOUNT_PARTNER_TASKS];

    const scopedAssets = await clientAssetsService.fetchMetaAssets(accessToken, sandbox.businessManagerId, [
      'ad_account',
      'page',
    ]);

    const businessName =
      scopedAssets.selectedBusinessName ??
      scopedAssets.businesses?.find((item) => item.id === sandbox.businessManagerId)?.name ??
      'AuthHub Review Business Manager';

    const assets = [
      {
        id: sandbox.businessManagerId,
        name: businessName,
        kind: 'business' as const,
      },
      ...scopedAssets.pages.map((page) => ({
        id: page.id,
        name: page.name,
        kind: 'page' as const,
      })),
      ...scopedAssets.adAccounts.map((account) => ({
        id: account.id,
        name: account.name,
        kind: 'ad_account' as const,
      })),
    ];

    const partnerAccess = await metaPartnerService.verifyAdAccountAgencyAccess(
      accessToken,
      sandbox.adAccountId,
      agencyBusinessId,
      partnerTasks
    );
    const agencyName = await this.fetchAgencyBusinessName(accessToken, agencyBusinessId);

    return {
      stepId: 'business_management',
      business: {
        id: sandbox.businessManagerId,
        name: businessName,
        kind: 'business',
      },
      assets,
      agencyPartner: {
        businessId: agencyBusinessId,
        ...(agencyName ? { name: agencyName } : {}),
        permittedTasks: partnerAccess.assignedTasks,
        verified: partnerAccess.verified,
        assetId: sandbox.adAccountId,
        assetKind: 'ad_account',
      },
      graphCaptions: graphCaptionsSince(opsStart),
    };
  }

  private loadMockStepPayload(stepId: ReviewDemoStepId): ReviewDemoStepPayload {
    const sandbox = defaultSandboxIds();
    switch (stepId) {
      case 'pages_show_list':
        return {
          stepId,
          pages: [{ id: sandbox.pageId, name: 'Ah-Review-Page' }],
          graphCaptions: ['GET /me/accounts (mock)'],
        };
      case 'pages_read_engagement':
        return {
          stepId,
          page: {
            id: sandbox.pageId,
            name: 'Ah-Review-Page',
            managedTasks: ['ADVERTISE', 'ANALYZE'],
            category: 'Software',
          },
          posts: [{ id: 'post_1', createdTime: '2026-10-01T12:00:00+0000' }],
          graphCaptions: ['GET /{page-id}?fields=…', 'GET /{page-id}/feed?fields=id,created_time (mock)'],
        };
      case 'ads_management':
        return {
          stepId,
          adAccountId: sandbox.adAccountId,
          adAccountName: 'AuthHub Review Ad Account',
          agencyPartner: {
            businessId: sandbox.agencyBusinessId,
            name: 'AuthHub Agency BM (mock)',
            permittedTasks: [],
            verified: false,
          },
          graphCaptions: [
            'GET /act_{id}?fields=id,name',
            'GET /act_{id}/agencies?fields=id,permitted_tasks (mock)',
          ],
        };
      case 'business_management':
        return {
          stepId,
          business: { id: sandbox.businessManagerId, name: 'AuthHub Review BM', kind: 'business' },
          assets: [
            { id: sandbox.businessManagerId, name: 'AuthHub Review BM', kind: 'business' },
            { id: sandbox.pageId, name: 'Ah-Review-Page', kind: 'page' },
            { id: sandbox.adAccountId, name: 'AuthHub Review Ad Account', kind: 'ad_account' },
          ],
          agencyPartner: {
            businessId: sandbox.agencyBusinessId,
            name: 'AuthHub Agency BM (mock)',
            permittedTasks: ['ADVERTISE', 'ANALYZE'],
            verified: true,
            assetId: sandbox.adAccountId,
            assetKind: 'ad_account',
          },
          graphCaptions: ['GET /{business-id}/owned_pages (mock)', 'GET /act_{id}/agencies (mock)'],
        };
      default: {
        const _exhaustive: never = stepId;
        throw new Error(`Unsupported review demo step: ${String(_exhaustive)}`);
      }
    }
  }
}

export const reviewDemoService = new ReviewDemoService();
