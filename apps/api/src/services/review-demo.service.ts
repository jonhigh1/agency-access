import {
  META_CORE_PERMISSIONS,
  META_GRAPH_VERSION,
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

const GRAPH_BASE = `https://graph.facebook.com/${META_GRAPH_VERSION}`;

interface ReviewDemoStoredToken {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: string;
  scope?: string;
  pausedAdId?: string;
  identity?: ReviewDemoIdentity;
}

function reviewDemoSecretName(clerkUserId: string): string {
  return `review_demo_meta_${clerkUserId}`;
}

function defaultSandboxIds() {
  return {
    businessManagerId: env.META_REVIEW_BM_ID ?? '695982475048959',
    adAccountId: normalizeAdAccountId(env.META_REVIEW_AD_ACCOUNT_ID ?? '557538895783894'),
    pageId: env.META_REVIEW_PAGE_ID ?? '61595193599205',
    catalogId: env.META_REVIEW_CATALOG_ID ?? '1858948598873838',
  };
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
    const callbackBase = resolveClientInviteCallbackUrl(input.headers);
    const redirectUrl = new URL(callbackBase);
    redirectUrl.searchParams.set('flow', 'review-demo');

    const agencyId = env.META_REVIEW_LAB_AGENCY_ID ?? 'review-lab-agency';
    const stateResult = await oauthStateService.createState({
      agencyId,
      platform: 'meta',
      userEmail: input.userEmail,
      redirectUrl: redirectUrl.toString(),
      timestamp: Date.now(),
      reviewDemo: true,
      clerkUserId: input.clerkUserId,
    });

    if (stateResult.error || !stateResult.data) {
      throw new Error(stateResult.error?.message ?? 'Failed to create OAuth state');
    }

    const connector = new MetaConnector();
    const authUrl = connector.getAuthUrl(stateResult.data, [...META_CORE_PERMISSIONS], redirectUrl.toString());

    return { authUrl, state: stateResult.data };
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

    switch (input.stepId) {
      case 'pages_show_list':
        return this.loadPagesShowList(accessToken, opsStart);
      case 'pages_read_engagement':
        return this.loadPagesReadEngagement(accessToken, sandbox.pageId, opsStart);
      case 'ads_management':
        return this.loadAdsManagement(accessToken, sandbox.adAccountId, input.clerkUserId, opsStart);
      case 'business_management':
        return this.loadBusinessManagement(accessToken, sandbox, opsStart);
      default: {
        const _exhaustive: never = input.stepId;
        throw new Error(`Unsupported review demo step: ${String(_exhaustive)}`);
      }
    }
  }

  async pauseTestAd(input: {
    clerkUserId: string;
    userEmail: string;
    adId?: string;
    ipAddress?: string;
    userAgent?: string;
  }): Promise<{ adId: string; effectiveStatus: string }> {
    if (env.META_REVIEW_DEMO_MOCK_GRAPH) {
      const adId = input.adId ?? 'mock-ad-1';
      return { adId, effectiveStatus: 'PAUSED' };
    }

    const stored = await readStoredToken(input.clerkUserId);
    if (!stored?.accessToken) {
      throw new Error('Connect Meta before pausing a test ad');
    }

    const targetAdId = input.adId ?? env.META_REVIEW_TEST_AD_ID ?? stored.pausedAdId;
    if (!targetAdId) {
      throw new Error('No test ad available to pause');
    }

    const opsStart = getRecordedMetaGraphOps().length;
    const response = await metaGraphFetch(`${GRAPH_BASE}/${targetAdId}`, {
      method: 'POST',
      body: new URLSearchParams({ status: 'PAUSED' }),
      accessToken: stored.accessToken,
      tokenClass: 'client_user',
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Meta ad pause failed: ${errorText}`);
    }

    const body = (await response.json()) as { effective_status?: string; id?: string };
    await writeStoredToken(input.clerkUserId, { ...stored, pausedAdId: targetAdId });

    await auditService.createAuditLog({
      userEmail: input.userEmail,
      action: 'token_viewed',
      resourceType: 'review_demo',
      resourceId: input.clerkUserId,
      ipAddress: input.ipAddress ?? '0.0.0.0',
      userAgent: input.userAgent,
      metadata: {
        surface: 'review_demo_pause_ad',
        adId: targetAdId,
        graphCaptions: graphCaptionsSince(opsStart),
      },
    });

    return {
      adId: targetAdId,
      effectiveStatus: body.effective_status ?? 'PAUSED',
    };
  }

  async resumeTestAd(input: {
    clerkUserId: string;
    userEmail: string;
    adId?: string;
    ipAddress?: string;
    userAgent?: string;
  }): Promise<{ adId: string; effectiveStatus: string }> {
    if (env.META_REVIEW_DEMO_MOCK_GRAPH) {
      const adId = input.adId ?? 'mock-ad-1';
      return { adId, effectiveStatus: 'ACTIVE' };
    }

    const stored = await readStoredToken(input.clerkUserId);
    if (!stored?.accessToken) {
      throw new Error('Connect Meta before resuming a test ad');
    }

    const targetAdId = input.adId ?? stored.pausedAdId ?? env.META_REVIEW_TEST_AD_ID;
    if (!targetAdId) {
      throw new Error('No paused test ad to resume');
    }

    const response = await metaGraphFetch(`${GRAPH_BASE}/${targetAdId}`, {
      method: 'POST',
      body: new URLSearchParams({ status: 'ACTIVE' }),
      accessToken: stored.accessToken,
      tokenClass: 'client_user',
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Meta ad resume failed: ${errorText}`);
    }

    const body = (await response.json()) as { effective_status?: string };
    const { pausedAdId: _removed, ...rest } = stored;
    await writeStoredToken(input.clerkUserId, rest);

    await auditService.createAuditLog({
      userEmail: input.userEmail,
      action: 'token_viewed',
      resourceType: 'review_demo',
      resourceId: input.clerkUserId,
      ipAddress: input.ipAddress ?? '0.0.0.0',
      userAgent: input.userAgent,
      metadata: { surface: 'review_demo_resume_ad', adId: targetAdId },
    });

    return {
      adId: targetAdId,
      effectiveStatus: body.effective_status ?? 'ACTIVE',
    };
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
    opsStart: number
  ): Promise<ReviewDemoStepPayload> {
    const pageResponse = await metaGraphFetch(
      `${GRAPH_BASE}/${pageId}?fields=id,name,picture,access_token`,
      { method: 'GET', accessToken, tokenClass: 'client_user' }
    );
    if (!pageResponse.ok) {
      throw new Error(await pageResponse.text());
    }
    const page = (await pageResponse.json()) as {
      id?: string;
      name?: string;
      picture?: { data?: { url?: string } };
      access_token?: string;
    };
    if (!page.id || !page.name || !page.access_token) {
      throw new Error('Meta did not return Page access for engagement proof');
    }

    const feedResponse = await metaGraphFetch(
      `${GRAPH_BASE}/${pageId}/feed?fields=id,created_time,message&limit=5`,
      { method: 'GET', accessToken: page.access_token, tokenClass: 'selected_page' }
    );
    if (!feedResponse.ok) {
      throw new Error(await feedResponse.text());
    }
    const feed = (await feedResponse.json()) as {
      data?: Array<{ id?: string; created_time?: string; message?: string }>;
    };

    return {
      stepId: 'pages_read_engagement',
      page: {
        id: page.id,
        name: page.name,
        ...(page.picture?.data?.url ? { pictureUrl: page.picture.data.url } : {}),
      },
      posts: (feed.data ?? [])
        .filter((post): post is { id: string; created_time?: string; message?: string } => Boolean(post.id))
        .map((post) => ({
          id: post.id,
          ...(post.created_time ? { createdTime: post.created_time } : {}),
          ...(post.message ? { messagePreview: post.message.slice(0, 120) } : {}),
        })),
      graphCaptions: graphCaptionsSince(opsStart),
    };
  }

  private async loadAdsManagement(
    accessToken: string,
    adAccountId: string,
    clerkUserId: string,
    opsStart: number
  ): Promise<ReviewDemoStepPayload> {
    const stored = await readStoredToken(clerkUserId);
    const accountResponse = await metaGraphFetch(
      `${GRAPH_BASE}/${adAccountId}?fields=id,name,account_status`,
      { method: 'GET', accessToken, tokenClass: 'client_user' }
    );
    if (!accountResponse.ok) {
      throw new Error(await accountResponse.text());
    }
    const account = (await accountResponse.json()) as { id?: string; name?: string };

    const campaignsResponse = await metaGraphFetch(
      `${GRAPH_BASE}/${adAccountId}/campaigns?fields=id,name,status,effective_status&limit=25`,
      { method: 'GET', accessToken, tokenClass: 'client_user' }
    );
    if (!campaignsResponse.ok) {
      throw new Error(await campaignsResponse.text());
    }
    const campaignsData = (await campaignsResponse.json()) as {
      data?: Array<{ id?: string; name?: string; status?: string; effective_status?: string }>;
    };

    const adsResponse = await metaGraphFetch(
      `${GRAPH_BASE}/${adAccountId}/ads?fields=id,name,status,effective_status&limit=25`,
      { method: 'GET', accessToken, tokenClass: 'client_user' }
    );
    if (!adsResponse.ok) {
      throw new Error(await adsResponse.text());
    }
    const adsData = (await adsResponse.json()) as {
      data?: Array<{ id?: string; name?: string; status?: string; effective_status?: string }>;
    };

    const ads = (adsData.data ?? [])
      .filter((ad): ad is { id: string; name: string; status?: string; effective_status?: string } =>
        Boolean(ad.id && ad.name)
      )
      .map((ad) => ({
        id: ad.id,
        name: ad.name,
        ...(ad.status ? { status: ad.status } : {}),
        ...(ad.effective_status ? { effectiveStatus: ad.effective_status } : {}),
      }));

    const pauseTarget =
      ads.find((ad) => ad.effectiveStatus === 'ACTIVE') ??
      ads.find((ad) => ad.id === env.META_REVIEW_TEST_AD_ID) ??
      ads[0];

    const pausedAd = stored?.pausedAdId
      ? ads.find((ad) => ad.id === stored.pausedAdId)
      : undefined;

    return {
      stepId: 'ads_management',
      adAccountId,
      ...(account.name ? { adAccountName: account.name } : {}),
      campaigns: (campaignsData.data ?? [])
        .filter((campaign): campaign is { id: string; name: string; status?: string; effective_status?: string } =>
          Boolean(campaign.id && campaign.name)
        )
        .map((campaign) => ({
          id: campaign.id,
          name: campaign.name,
          ...(campaign.status ? { status: campaign.status } : {}),
          ...(campaign.effective_status ? { effectiveStatus: campaign.effective_status } : {}),
        })),
      ads,
      ...(pauseTarget ? { pauseTargetAd: pauseTarget } : {}),
      ...(pausedAd ? { pausedAd } : {}),
      graphCaptions: graphCaptionsSince(opsStart),
    };
  }

  private async loadBusinessManagement(
    accessToken: string,
    sandbox: ReturnType<typeof defaultSandboxIds>,
    opsStart: number
  ): Promise<ReviewDemoStepPayload> {
    const businessResponse = await metaGraphFetch(
      `${GRAPH_BASE}/${sandbox.businessManagerId}?fields=id,name`,
      { method: 'GET', accessToken, tokenClass: 'client_user' }
    );
    if (!businessResponse.ok) {
      throw new Error(await businessResponse.text());
    }
    const business = (await businessResponse.json()) as { id?: string; name?: string };

    const catalogsResponse = await metaGraphFetch(
      `${GRAPH_BASE}/${sandbox.businessManagerId}/owned_product_catalogs?fields=id,name&limit=25`,
      { method: 'GET', accessToken, tokenClass: 'client_user' }
    );
    if (!catalogsResponse.ok) {
      throw new Error(await catalogsResponse.text());
    }
    const catalogsData = (await catalogsResponse.json()) as {
      data?: Array<{ id?: string; name?: string }>;
    };

    const pagesResponse = await metaGraphFetch(
      `${GRAPH_BASE}/${sandbox.businessManagerId}/owned_pages?fields=id,name&limit=25`,
      { method: 'GET', accessToken, tokenClass: 'client_user' }
    );
    const pagesData = pagesResponse.ok
      ? ((await pagesResponse.json()) as { data?: Array<{ id?: string; name?: string }> })
      : { data: [] };

    const adAccountsResponse = await metaGraphFetch(
      `${GRAPH_BASE}/${sandbox.businessManagerId}/owned_ad_accounts?fields=id,name&limit=25`,
      { method: 'GET', accessToken, tokenClass: 'client_user' }
    );
    const adAccountsData = adAccountsResponse.ok
      ? ((await adAccountsResponse.json()) as { data?: Array<{ id?: string; name?: string }> })
      : { data: [] };

    const assets = [
      ...(business.id && business.name
        ? [{ id: business.id, name: business.name, kind: 'business' as const }]
        : []),
      ...(pagesData.data ?? [])
        .filter((page): page is { id: string; name: string } => Boolean(page.id && page.name))
        .map((page) => ({ id: page.id, name: page.name, kind: 'page' as const })),
      ...(adAccountsData.data ?? [])
        .filter((account): account is { id: string; name: string } => Boolean(account.id && account.name))
        .map((account) => ({
          id: account.id,
          name: account.name,
          kind: 'ad_account' as const,
        })),
    ];

    const catalogs = (catalogsData.data ?? [])
      .filter((catalog): catalog is { id: string; name: string } => Boolean(catalog.id && catalog.name))
      .map((catalog) => ({ id: catalog.id, name: catalog.name }));

    if (!catalogs.some((catalog) => catalog.id === sandbox.catalogId)) {
      catalogs.unshift({ id: sandbox.catalogId, name: 'AuthHub Review Catalog' });
    }

    return {
      stepId: 'business_management',
      business: {
        id: business.id ?? sandbox.businessManagerId,
        name: business.name ?? 'AuthHub Review Business Manager',
        kind: 'business',
      },
      catalogs,
      assets,
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
          page: { id: sandbox.pageId, name: 'Ah-Review-Page' },
          posts: [
            { id: 'post_1', createdTime: '2026-10-01T12:00:00+0000', messagePreview: 'Review sandbox post' },
          ],
          graphCaptions: ['GET /{page-id}/feed (mock)'],
        };
      case 'ads_management':
        return {
          stepId,
          adAccountId: sandbox.adAccountId,
          adAccountName: 'AuthHub Review Ad Account',
          campaigns: [{ id: 'camp_1', name: 'Review Test Campaign', effectiveStatus: 'ACTIVE' }],
          ads: [{ id: 'ad_1', name: 'Review Test Ad', effectiveStatus: 'ACTIVE' }],
          pauseTargetAd: { id: 'ad_1', name: 'Review Test Ad', effectiveStatus: 'ACTIVE' },
          graphCaptions: ['GET /act_{id}/campaigns (mock)'],
        };
      case 'business_management':
        return {
          stepId,
          business: { id: sandbox.businessManagerId, name: 'AuthHub Review BM', kind: 'business' },
          catalogs: [{ id: sandbox.catalogId, name: 'AuthHub Review Catalog' }],
          assets: [
            { id: sandbox.businessManagerId, name: 'AuthHub Review BM', kind: 'business' },
            { id: sandbox.pageId, name: 'Ah-Review-Page', kind: 'page' },
            { id: sandbox.adAccountId, name: 'AuthHub Review Ad Account', kind: 'ad_account' },
          ],
          graphCaptions: ['GET /{business-id}/owned_product_catalogs (mock)'],
        };
      default: {
        const _exhaustive: never = stepId;
        throw new Error(`Unsupported review demo step: ${String(_exhaustive)}`);
      }
    }
  }
}

export const reviewDemoService = new ReviewDemoService();
