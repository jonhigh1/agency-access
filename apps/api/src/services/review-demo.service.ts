import {
  META_CORE_PERMISSIONS,
  META_GRAPH_VERSION,
  META_REVIEW_DEFAULT_SANDBOX_META_USER_ID,
  REVIEW_DEMO_AD_ACCOUNT_PARTNER_TASKS,
  REVIEW_DEMO_PAGE_PARTNER_TASKS,
  REVIEW_DEMO_STEP_ORDER,
  parseMetaGraphApiErrorText,
  type ReviewDemoIdentity,
  type ReviewDemoMetaGraphError,
  type ReviewDemoPagePartnerResult,
  type ReviewDemoSession,
  type ReviewDemoStepId,
  type ReviewDemoStepPayload,
} from '@agency-platform/shared';
import { env } from '@/lib/env.js';
import { infisical } from '@/lib/infisical.js';
import { reviewDemoMetaSecretName } from '@/lib/review-demo-secrets.js';
import { formatMetaGraphOpCaption } from '@agency-platform/shared';
import { getRecordedMetaGraphOps, metaGraphFetch } from '@/lib/meta-graph-instrumentation.js';
import { MetaConnector } from '@/services/connectors/meta.js';
import { auditService } from '@/services/audit.service.js';
import { oauthStateService } from '@/services/oauth-state.service.js';
import { resolveClientInviteCallbackUrl } from '@/routes/client-auth/redirect-uri.js';
import { clientAssetsService } from '@/services/client-assets.service.js';
import {
  MetaPageAccessTokenUnavailableError,
  metaPartnerService,
} from '@/services/meta-partner.service.js';
import {
  isReviewDemoSandboxMetaUser,
  reviewDemoContextService,
  type ReviewDemoResolvedAssets,
} from '@/services/review-demo-context.service.js';
import {
  formatMetaGraphApiError,
  readMetaGraphApiError,
} from '@/services/review-demo-graph-errors.js';
import { buildBusinessManagementStepCaption } from '@/services/review-demo-business-caption.js';

const GRAPH_BASE = `https://graph.facebook.com/${META_GRAPH_VERSION}`;

interface ReviewDemoStoredToken {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: string;
  scope?: string;
  identity?: ReviewDemoIdentity;
}

function defaultSandboxIds() {
  return {
    businessManagerId: env.META_REVIEW_BM_ID ?? '695982475048959',
    adAccountId: normalizeAdAccountId(env.META_REVIEW_AD_ACCOUNT_ID ?? '557538895783894'),
    pageId: env.META_REVIEW_PAGE_ID ?? '1373353139192376',
    agencyBusinessId: env.META_REVIEW_AGENCY_BM_ID ?? '3808519629379919',
  };
}

type ReviewDemoSandboxConfig =
  | {
      configured: true;
      businessManagerId: string;
      adAccountId: string;
      pageId: string;
      agencyBusinessId: string;
    }
  | { configured: false };

function resolveReviewDemoSandbox(useMockDefaults: boolean): ReviewDemoSandboxConfig {
  if (useMockDefaults) {
    const defaults = defaultSandboxIds();
    return { configured: true, ...defaults };
  }
  const pageId = env.META_REVIEW_PAGE_ID?.trim();
  const adAccountRaw = env.META_REVIEW_AD_ACCOUNT_ID?.trim();
  const businessManagerId = env.META_REVIEW_BM_ID?.trim();
  if (!pageId || !adAccountRaw || !businessManagerId) {
    return { configured: false };
  }
  return {
    configured: true,
    pageId,
    adAccountId: normalizeAdAccountId(adAccountRaw),
    businessManagerId,
    agencyBusinessId: requireAgencyBusinessIdForLiveGraph(),
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
    const raw = await infisical.getPlainSecret(reviewDemoMetaSecretName(clerkUserId));
    return JSON.parse(raw) as ReviewDemoStoredToken;
  } catch {
    return null;
  }
}

async function writeStoredToken(clerkUserId: string, value: ReviewDemoStoredToken): Promise<void> {
  await infisical.storePlainSecret(reviewDemoMetaSecretName(clerkUserId), JSON.stringify(value));
}

function toMetaGraphError(raw: string): ReviewDemoMetaGraphError {
  const parsed = parseMetaGraphApiErrorText(raw);
  return {
    ...(parsed.code !== undefined ? { code: parsed.code } : {}),
    ...(parsed.errorSubcode !== undefined ? { errorSubcode: parsed.errorSubcode } : {}),
    message: parsed.message,
    ...(parsed.type ? { type: parsed.type } : {}),
    ...(parsed.fbtraceId ? { fbtraceId: parsed.fbtraceId } : {}),
    rawBody: raw,
  };
}

const PAGE_PARTNER_NOT_CHECKED_MESSAGE = 'Not checked yet — use Add agency to Page to run partner POST and readback.';

async function buildPagePartnerSnapshotOnLoad(input: {
  accessToken: string;
  pageId: string;
  agencyBusinessId: string;
  agencyName?: string;
}): Promise<ReviewDemoPagePartnerResult> {
  const base = {
    businessId: input.agencyBusinessId,
    ...(input.agencyName ? { name: input.agencyName } : {}),
    assetId: input.pageId,
    assetKind: 'page' as const,
  };

  const tokenPhase = await metaPartnerService.resolvePageAccessTokenPhase(
    input.accessToken,
    input.pageId
  );
  if (!tokenPhase.obtained) {
    return {
      ...base,
      permittedTasks: [],
      verified: false,
      pendingMessage: PAGE_PARTNER_NOT_CHECKED_MESSAGE,
    };
  }

  try {
    const pageAccess = await metaPartnerService.verifyAgencyPartnerAccess(
      input.accessToken,
      input.pageId,
      input.agencyBusinessId,
      [...REVIEW_DEMO_PAGE_PARTNER_TASKS],
      { assetKind: 'page' }
    );
    return {
      ...base,
      permittedTasks: pageAccess.assignedTasks,
      verified: pageAccess.verified,
    };
  } catch (error) {
    if (error instanceof MetaPageAccessTokenUnavailableError) {
      return {
        ...base,
        permittedTasks: [],
        verified: false,
        pendingMessage: PAGE_PARTNER_NOT_CHECKED_MESSAGE,
      };
    }
    const raw = error instanceof Error ? error.message : String(error);
    return {
      ...base,
      permittedTasks: [],
      verified: false,
      graphError: toMetaGraphError(raw),
      rawGraphResponse: raw,
    };
  }
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
      id: META_REVIEW_DEFAULT_SANDBOX_META_USER_ID,
      name: 'AuthHub Review User (mock)',
    };

    const identity = stored?.identity ?? (env.META_REVIEW_DEMO_MOCK_GRAPH ? mockIdentity : null);
    const usesSandboxAssets =
      env.META_REVIEW_DEMO_MOCK_GRAPH || isReviewDemoSandboxMetaUser(identity?.id);

    if (env.META_REVIEW_DEMO_MOCK_GRAPH) {
      return {
        connected: true,
        identity,
        grantedPermissions: [...META_CORE_PERMISSIONS],
        activeStep,
        stepIndex: stepIndex >= 0 ? stepIndex : 0,
        stepCount: REVIEW_DEMO_STEP_ORDER.length,
        sandbox,
        usesSandboxAssets: true,
      };
    }

    return {
      connected: Boolean(stored?.accessToken),
      identity,
      grantedPermissions: [...META_CORE_PERMISSIONS],
      activeStep,
      stepIndex: stepIndex >= 0 ? stepIndex : 0,
      stepCount: REVIEW_DEMO_STEP_ORDER.length,
      sandbox,
      usesSandboxAssets,
    };
  }

  async disconnectMeta(input: {
    clerkUserId: string;
    userEmail: string;
    ipAddress?: string;
    userAgent?: string;
  }): Promise<void> {
    await infisical.deleteSecret(reviewDemoMetaSecretName(input.clerkUserId));
    await auditService.createAuditLog({
      userEmail: input.userEmail,
      action: 'access_revoked',
      resourceType: 'review_demo',
      resourceId: input.clerkUserId,
      ipAddress: input.ipAddress ?? '0.0.0.0',
      userAgent: input.userAgent,
      metadata: { surface: 'review_demo_disconnect_meta' },
    });
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
    const stored = await readStoredToken(input.clerkUserId);
    const assetContext = await reviewDemoContextService.resolveAssets({
      accessToken,
      identity: stored?.identity ?? null,
    });

    switch (input.stepId) {
      case 'pages_show_list':
        return this.loadPagesShowList(accessToken);
      case 'pages_read_engagement':
        return this.loadPagesReadEngagement(accessToken, assetContext);
      case 'ads_management':
        return this.loadAdsManagement(accessToken, assetContext, {
          includePartnerReadback: false,
        });
      case 'business_management':
        return this.loadBusinessManagement(accessToken, assetContext);
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
    const stored = await readStoredToken(input.clerkUserId);
    const assetContext = await reviewDemoContextService.resolveAssets({
      accessToken,
      identity: stored?.identity ?? null,
    });

    const payload = await this.loadAdsManagement(accessToken, assetContext, {
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
        adAccountId: assetContext.adAccountId,
        agencyBusinessId: assetContext.agencyBusinessId,
        verified: payload.stepId === 'ads_management' ? payload.agencyPartner.verified : false,
        graphCaptions: graphCaptionsSince(opsStart),
      },
    });

    return payload;
  }

  async addAgencyToPagePartner(input: {
    clerkUserId: string;
    userEmail: string;
    ipAddress?: string;
    userAgent?: string;
  }): Promise<ReviewDemoStepPayload> {
    if (env.META_REVIEW_DEMO_MOCK_GRAPH) {
      const base = this.loadMockStepPayload('business_management');
      if (base.stepId !== 'business_management') {
        return base;
      }
      return {
        ...base,
        pagePartner: {
          businessId: defaultSandboxIds().agencyBusinessId,
          permittedTasks: [...REVIEW_DEMO_PAGE_PARTNER_TASKS],
          verified: true,
          assetId: defaultSandboxIds().pageId,
          assetKind: 'page',
          granted: true,
        },
        stepCaption: buildBusinessManagementStepCaption({
          pagePartner: {
            businessId: defaultSandboxIds().agencyBusinessId,
            permittedTasks: [...REVIEW_DEMO_PAGE_PARTNER_TASKS],
            verified: true,
            assetId: defaultSandboxIds().pageId,
            assetKind: 'page',
          },
          adAccountPartnerVerified: base.agencyPartner.verified,
        }),
      };
    }

    const accessToken = await this.getAccessToken(
      input.clerkUserId,
      input.userEmail,
      input.ipAddress,
      input.userAgent
    );
    const stored = await readStoredToken(input.clerkUserId);
    const assetContext = await reviewDemoContextService.resolveAssets({
      accessToken,
      identity: stored?.identity ?? null,
    });

    const basePayload = await this.loadBusinessManagement(accessToken, assetContext);
    if (basePayload.stepId !== 'business_management') {
      return basePayload;
    }

    const pageId = assetContext.pageId;
    if (!pageId) {
      return {
        ...basePayload,
        emptyState: {
          code: 'no_pages',
          message: 'Connect a Meta account that granted at least one Page to run the Page partner add.',
        },
      };
    }

    const pagePartner = await this.runPagePartnerGrantAndReadback(
      accessToken,
      pageId,
      assetContext.agencyBusinessId
    );

    return {
      ...basePayload,
      pagePartner,
      stepCaption: buildBusinessManagementStepCaption({
        pagePartner,
        adAccountPartnerVerified: basePayload.agencyPartner.verified,
      }),
    };
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

  private async loadPagesShowList(accessToken: string): Promise<ReviewDemoStepPayload> {
    const opsStart = getRecordedMetaGraphOps().length;
    const response = await metaGraphFetch(
      `${GRAPH_BASE}/me/accounts?fields=id,name,picture`,
      { method: 'GET', accessToken, tokenClass: 'client_user' }
    );
    if (!response.ok) {
      const raw = await response.text();
      return {
        stepId: 'pages_show_list',
        pages: [],
        emptyState: {
          code: 'graph_error',
          message: formatMetaGraphApiError(raw).displayMessage,
        },
        graphCaptions: graphCaptionsSince(opsStart),
      };
    }
    const data = (await response.json()) as {
      data?: Array<{ id?: string; name?: string; picture?: { data?: { url?: string } } }>;
    };

    const pages = (data.data ?? [])
      .filter((page): page is { id: string; name: string; picture?: { data?: { url?: string } } } =>
        Boolean(page.id && page.name)
      )
      .map((page) => ({
        id: page.id,
        name: page.name,
        ...(page.picture?.data?.url ? { pictureUrl: page.picture.data.url } : {}),
      }));

    return {
      stepId: 'pages_show_list',
      pages,
      ...(pages.length === 0
        ? {
            emptyState: {
              code: 'no_pages' as const,
              message: 'No Facebook Pages were returned for this token. Grant pages_show_list on at least one Page.',
            },
          }
        : {}),
      graphCaptions: graphCaptionsSince(opsStart),
    };
  }

  private async loadPagesReadEngagement(
    accessToken: string,
    assetContext: ReviewDemoResolvedAssets
  ): Promise<ReviewDemoStepPayload> {
    const pageId = assetContext.pageId;
    if (!pageId) {
      return {
        stepId: 'pages_read_engagement',
        posts: [],
        emptyState: {
          code: 'no_pages',
          message:
            'No Page is available for this session. Grant pages_show_list on a Page during consent, or use the lab sandbox account.',
        },
        graphCaptions: [],
      };
    }

    try {
      const proof = await clientAssetsService.fetchPageEngagementProof(accessToken, pageId, {
        exposeDetailedGraphErrors: true,
        includeFeed: false,
      });
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
        posts: [],
        graphCaptions: proof.graphOperationCaptions ?? [],
      };
    } catch (error) {
      const raw = error instanceof Error ? error.message : String(error);
      return {
        stepId: 'pages_read_engagement',
        posts: [],
        emptyState: {
          code: 'graph_error',
          message: formatMetaGraphApiError(raw).displayMessage,
        },
        graphCaptions: graphCaptionsSince(getRecordedMetaGraphOps().length),
      };
    }
  }

  private async loadAdsManagement(
    accessToken: string,
    assetContext: ReviewDemoResolvedAssets,
    options: { includePartnerReadback: boolean }
  ): Promise<ReviewDemoStepPayload> {
    const opsStart = getRecordedMetaGraphOps().length;
    const agencyBusinessId = assetContext.agencyBusinessId;
    const partnerTasks = [...REVIEW_DEMO_AD_ACCOUNT_PARTNER_TASKS];
    const agencyName = await this.fetchAgencyBusinessName(accessToken, agencyBusinessId);

    const emptyPartner = {
      businessId: agencyBusinessId,
      ...(agencyName ? { name: agencyName } : {}),
      permittedTasks: [] as string[],
      verified: false,
    };

    const adAccountId = assetContext.adAccountId;
    if (!adAccountId) {
      return {
        stepId: 'ads_management',
        agencyPartner: emptyPartner,
        emptyState: {
          code: 'no_ad_accounts',
          message:
            'No ad account is available for this session. Grant ads_management on an ad account during consent, or use the lab sandbox account.',
        },
        graphCaptions: graphCaptionsSince(opsStart),
      };
    }

    const accountResponse = await metaGraphFetch(
      `${GRAPH_BASE}/${adAccountId}?fields=id,name,account_status`,
      { method: 'GET', accessToken, tokenClass: 'client_user' }
    );
    if (!accountResponse.ok) {
      const graphError = await readMetaGraphApiError(accountResponse);
      return {
        stepId: 'ads_management',
        adAccountId,
        agencyPartner: {
          ...emptyPartner,
          metaErrorCode: graphError.code,
          metaErrorMessage: graphError.message,
        },
        emptyState: {
          code: 'graph_error',
          message: graphError.displayMessage,
        },
        graphCaptions: graphCaptionsSince(opsStart),
      };
    }
    const account = (await accountResponse.json()) as { id?: string; name?: string };

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
        return {
          stepId: 'ads_management',
          adAccountId,
          ...(account.name ? { adAccountName: account.name } : {}),
          agencyPartner: {
            ...emptyPartner,
            permittedTasks,
            verified,
            metaErrorCode,
            metaErrorMessage,
          },
          emptyState: {
            code: 'graph_error',
            message: graphError.displayMessage,
          },
          graphCaptions: graphCaptionsSince(opsStart),
        };
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

  private async runPagePartnerGrantAndReadback(
    accessToken: string,
    pageId: string,
    agencyBusinessId: string
  ): Promise<ReviewDemoPagePartnerResult> {
    const partnerTasks = [...REVIEW_DEMO_PAGE_PARTNER_TASKS];
    const agencyName = await this.fetchAgencyBusinessName(accessToken, agencyBusinessId);

    try {
      const prior = await metaPartnerService.verifyAgencyPartnerAccess(
        accessToken,
        pageId,
        agencyBusinessId,
        partnerTasks,
        { assetKind: 'page' }
      );
      if (prior.verified) {
        return {
          businessId: agencyBusinessId,
          ...(agencyName ? { name: agencyName } : {}),
          permittedTasks: prior.assignedTasks,
          verified: true,
          assetId: pageId,
          assetKind: 'page',
          granted: false,
        };
      }

      let rawGraphResponse: string | undefined;
      try {
        await metaPartnerService.grantAgencyPartnerAccess(
          accessToken,
          pageId,
          agencyBusinessId,
          partnerTasks,
          { assetKind: 'page' }
        );
        rawGraphResponse = JSON.stringify({ success: true });
      } catch (error) {
        const raw = error instanceof Error ? error.message : String(error);
        const graphError = toMetaGraphError(raw);
        return {
          businessId: agencyBusinessId,
          ...(agencyName ? { name: agencyName } : {}),
          permittedTasks: [],
          verified: false,
          assetId: pageId,
          assetKind: 'page',
          granted: false,
          graphError,
          rawGraphResponse: raw,
        };
      }

      const readBack = await metaPartnerService.verifyAgencyPartnerAccess(
        accessToken,
        pageId,
        agencyBusinessId,
        partnerTasks,
        { assetKind: 'page' }
      );

      return {
        businessId: agencyBusinessId,
        ...(agencyName ? { name: agencyName } : {}),
        permittedTasks: readBack.assignedTasks,
        verified: readBack.verified,
        assetId: pageId,
        assetKind: 'page',
        granted: true,
        rawGraphResponse,
      };
    } catch (error) {
      if (error instanceof MetaPageAccessTokenUnavailableError) {
        return {
          businessId: agencyBusinessId,
          ...(agencyName ? { name: agencyName } : {}),
          permittedTasks: [],
          verified: false,
          assetId: pageId,
          assetKind: 'page',
          pendingMessage: error.message,
        };
      }
      const raw = error instanceof Error ? error.message : String(error);
      return {
        businessId: agencyBusinessId,
        ...(agencyName ? { name: agencyName } : {}),
        permittedTasks: [],
        verified: false,
        assetId: pageId,
        assetKind: 'page',
        graphError: toMetaGraphError(raw),
        rawGraphResponse: raw,
      };
    }
  }

  private async fetchGraphAssetName(
    accessToken: string,
    assetId: string
  ): Promise<string | undefined> {
    const response = await metaGraphFetch(`${GRAPH_BASE}/${assetId}?fields=id,name`, {
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

  private async loadBusinessManagement(
    accessToken: string,
    assetContext: ReviewDemoResolvedAssets
  ): Promise<ReviewDemoStepPayload> {
    const opsStart = getRecordedMetaGraphOps().length;
    const agencyBusinessId = assetContext.agencyBusinessId;
    const partnerTasks = [...REVIEW_DEMO_AD_ACCOUNT_PARTNER_TASKS];

    if (assetContext.mode === 'sandbox') {
      const sandboxConfig = resolveReviewDemoSandbox(false);
      if (!sandboxConfig.configured) {
        return {
          stepId: 'business_management',
          assets: [],
          sandboxMisconfigured: true,
          sandboxMisconfiguredMessage:
            'Set META_REVIEW_BM_ID, META_REVIEW_PAGE_ID, and META_REVIEW_AD_ACCOUNT_ID on the API service.',
          agencyPartner: {
            businessId: env.META_REVIEW_AGENCY_BM_ID?.trim() ?? 'unconfigured',
            permittedTasks: [],
            verified: false,
            assetId: 'unconfigured',
            assetKind: 'ad_account',
          },
          graphCaptions: graphCaptionsSince(opsStart),
        };
      }

      const { businessManagerId, pageId, adAccountId } = sandboxConfig;

      const [businessName, pageName, adAccountName] = await Promise.all([
        this.fetchGraphAssetName(accessToken, businessManagerId),
        this.fetchGraphAssetName(accessToken, pageId),
        this.fetchGraphAssetName(accessToken, adAccountId),
      ]);

      const assets = [
        {
          id: businessManagerId,
          name: businessName ?? 'AuthHub Review Business Manager',
          kind: 'business' as const,
        },
        {
          id: pageId,
          name: pageName ?? 'AuthHub Review Page',
          kind: 'page' as const,
        },
        {
          id: adAccountId,
          name: adAccountName ?? 'AuthHub Review Ad Account',
          kind: 'ad_account' as const,
        },
      ];

      let partnerAccess = { assignedTasks: [] as string[], verified: false };
      try {
        partnerAccess = await metaPartnerService.verifyAdAccountAgencyAccess(
          accessToken,
          adAccountId,
          agencyBusinessId,
          partnerTasks
        );
      } catch {
        partnerAccess = { assignedTasks: [], verified: false };
      }

      const agencyName = await this.fetchAgencyBusinessName(accessToken, agencyBusinessId);
      const pagePartner = await buildPagePartnerSnapshotOnLoad({
        accessToken,
        pageId,
        agencyBusinessId,
        ...(agencyName ? { agencyName } : {}),
      });

      const agencyPartner = {
        businessId: agencyBusinessId,
        ...(agencyName ? { name: agencyName } : {}),
        permittedTasks: partnerAccess.assignedTasks,
        verified: partnerAccess.verified,
        assetId: adAccountId,
        assetKind: 'ad_account' as const,
      };

      return {
        stepId: 'business_management',
        business: {
          id: businessManagerId,
          name: businessName ?? 'AuthHub Review Business Manager',
          kind: 'business',
        },
        assets,
        agencyPartner,
        pagePartner,
        stepCaption: buildBusinessManagementStepCaption({
          pagePartner,
          adAccountPartnerVerified: agencyPartner.verified,
        }),
        graphCaptions: graphCaptionsSince(opsStart),
      };
    }

    const businessManagerId = assetContext.businessManagerId;
    if (!businessManagerId) {
      return {
        stepId: 'business_management',
        assets: [],
        emptyState: {
          code: 'no_business',
          message:
            'No Business Portfolio is available for this token. Grant business_management during consent or connect a business-enabled account.',
        },
        agencyPartner: {
          businessId: agencyBusinessId,
          permittedTasks: [],
          verified: false,
          assetId: assetContext.adAccountId ?? 'unknown',
          assetKind: 'ad_account',
        },
        graphCaptions: graphCaptionsSince(opsStart),
      };
    }

    const businessName = await this.fetchGraphAssetName(accessToken, businessManagerId);
    const assets: Array<{ id: string; name: string; kind: 'business' | 'page' | 'ad_account' }> = [
      {
        id: businessManagerId,
        name: businessName ?? 'Business Portfolio',
        kind: 'business',
      },
    ];

    if (assetContext.pageId) {
      const pageName = await this.fetchGraphAssetName(accessToken, assetContext.pageId);
      assets.push({
        id: assetContext.pageId,
        name: pageName ?? 'Facebook Page',
        kind: 'page',
      });
    }

    if (assetContext.adAccountId) {
      const adAccountName = await this.fetchGraphAssetName(accessToken, assetContext.adAccountId);
      assets.push({
        id: assetContext.adAccountId,
        name: adAccountName ?? 'Ad account',
        kind: 'ad_account',
      });
    }

    const agencyName = await this.fetchAgencyBusinessName(accessToken, agencyBusinessId);
    let partnerAccess = { assignedTasks: [] as string[], verified: false };
    if (assetContext.adAccountId) {
      try {
        partnerAccess = await metaPartnerService.verifyAdAccountAgencyAccess(
          accessToken,
          assetContext.adAccountId,
          agencyBusinessId,
          partnerTasks
        );
      } catch {
        partnerAccess = { assignedTasks: [], verified: false };
      }
    }

    const pagePartner = assetContext.pageId
      ? await buildPagePartnerSnapshotOnLoad({
          accessToken,
          pageId: assetContext.pageId,
          agencyBusinessId,
          ...(agencyName ? { agencyName } : {}),
        })
      : undefined;

    const agencyPartner = {
      businessId: agencyBusinessId,
      ...(agencyName ? { name: agencyName } : {}),
      permittedTasks: partnerAccess.assignedTasks,
      verified: partnerAccess.verified,
      assetId: assetContext.adAccountId ?? 'unknown',
      assetKind: 'ad_account' as const,
    };

    return {
      stepId: 'business_management',
      business: {
        id: businessManagerId,
        name: businessName ?? 'Business Portfolio',
        kind: 'business',
      },
      assets,
      agencyPartner,
      ...(pagePartner ? { pagePartner } : {}),
      stepCaption: buildBusinessManagementStepCaption({
        pagePartner,
        adAccountPartnerVerified: agencyPartner.verified,
      }),
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
            managedTasks: [],
            category: 'Software',
            fanCount: 42,
            followerCount: 48,
          },
          posts: [],
          graphCaptions: [
            'GET /{page-id}?fields=id,name,category,fan_count,followers_count (mock)',
          ],
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
          pagePartner: {
            businessId: sandbox.agencyBusinessId,
            name: 'AuthHub Agency BM (mock)',
            permittedTasks: [...REVIEW_DEMO_PAGE_PARTNER_TASKS],
            verified: false,
            assetId: sandbox.pageId,
            assetKind: 'page',
          },
          stepCaption:
            'Page partner add (production POST) plus manual ad-account partner share verification — scoped to this session’s assets.',
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
