/**
 * Meta Partner Access Service
 *
 * Assigns agency people and system users to supported client Meta assets.
 *
 * Documentation:
 * - Ad Account Access: https://developers.facebook.com/docs/marketing-api/reference/ad-account/assigned_users
 * - Page Access: https://developers.facebook.com/docs/graph-api/reference/page/assigned_users
 *
 */

import { META_GRAPH_VERSION } from '@/lib/meta-constants';
import { metaGraphFetch } from '@/lib/meta-graph-instrumentation.js';
import {
  metaPagePartnerPermittedTasksSatisfyRequired,
  type MetaGraphTokenClass,
} from '@agency-platform/shared';

export interface MetaAssignedUserVerificationResult {
  verified: boolean;
  assignedTasks: string[];
}

export type MetaAgencyPartnerAssetKind = 'page' | 'ad_account' | 'catalog' | 'generic';

export type MetaPageAccessTokenSource = 'page_fields' | 'me_accounts';

export interface MetaPageAccessTokenPhaseResult {
  obtained: boolean;
  source?: MetaPageAccessTokenSource;
}

export const META_PAGE_ACCESS_TOKEN_USER_MESSAGE =
  "Couldn't get a Page token for this Page — reconnect Meta with Page access or assign people in Business Manager";

export class MetaPageAccessTokenUnavailableError extends Error {
  readonly code = 'META_PAGE_ACCESS_TOKEN_UNAVAILABLE';

  constructor(message: string = META_PAGE_ACCESS_TOKEN_USER_MESSAGE) {
    super(message);
    this.name = 'MetaPageAccessTokenUnavailableError';
  }
}

const DEFAULT_PAGE_TASKS = ['MANAGE', 'CREATE_CONTENT', 'MODERATE', 'ADVERTISE'];
const DEFAULT_AD_ACCOUNT_TASKS = ['MANAGE', 'ADVERTISE', 'ANALYZE'];

class MetaPartnerService {
  private readonly META_GRAPH_URL = `https://graph.facebook.com/${META_GRAPH_VERSION}`;
  private readonly REQUEST_TIMEOUT_MS = 15_000;

  private async graphRequest(
    url: string,
    accessToken: string,
    init: RequestInit,
    tokenClass: MetaGraphTokenClass = 'client_user',
  ): Promise<Response> {
    return metaGraphFetch(url, {
      ...init,
      accessToken,
      tokenClass,
      signal: AbortSignal.timeout(this.REQUEST_TIMEOUT_MS),
    });
  }

  private normalizeTasks(tasks: unknown): string[] {
    if (!Array.isArray(tasks)) {
      return [];
    }

    return tasks.map((task) => String(task)).filter(Boolean);
  }

  private async postAssignedUserAccess(input: {
    assetId: string;
    accessToken: string;
    systemUserId: string;
    tasks: string[];
    businessId?: string;
    tokenClass?: MetaGraphTokenClass;
  }): Promise<void> {
    const url = `${this.META_GRAPH_URL}/${input.assetId}/assigned_users`;
    const formData = new URLSearchParams();
    formData.append('user', input.systemUserId);
    formData.append('tasks', JSON.stringify(input.tasks));
    if (input.businessId) {
      formData.append('business', input.businessId);
    }
    const response = await this.graphRequest(url, input.accessToken, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: formData.toString(),
    }, input.tokenClass ?? 'client_user');

    if (!response.ok) {
      let errorMessage = 'Unknown error';
      let errorCode: string | undefined;

      try {
        const errorData: any = await response.json();
        if (errorData.error) {
          errorMessage = errorData.error.message || errorMessage;
          errorCode = errorData.error.code?.toString() || errorData.error.type;
        }
      } catch {
        const errorText = await response.text();
        errorMessage = errorText || errorMessage;
      }

      const fullError = errorCode
        ? `Assigned user mutation failed (${errorCode}): ${errorMessage}`
        : `Assigned user mutation failed: ${errorMessage}`;

      throw new Error(fullError);
    }
  }

  private async getAssignedUserAccess(
    accessToken: string,
    assetId: string,
    systemUserId: string,
    expectedTasks: string[],
    businessId?: string,
    options?: {
      pagePartnerTaskComparison?: boolean;
      tokenClass?: MetaGraphTokenClass;
    }
  ): Promise<MetaAssignedUserVerificationResult> {
    const tokenClass = options?.tokenClass ?? 'client_user';
    const assignedUsers = await this.getAssignedUsers(accessToken, assetId, businessId, tokenClass);

    const assignedUser = assignedUsers.find((item) => item.id === systemUserId);
    const assignedTasks = this.normalizeTasks(assignedUser?.tasks);
    const verified = options?.pagePartnerTaskComparison
      ? metaPagePartnerPermittedTasksSatisfyRequired(assignedTasks, expectedTasks)
      : assignedTasks.length === expectedTasks.length &&
        expectedTasks.every((task) => assignedTasks.includes(task));

    return {
      verified,
      assignedTasks,
    };
  }

  private async getAssignedUsers(
    accessToken: string,
    assetId: string,
    businessId?: string,
    tokenClass: MetaGraphTokenClass = 'client_user'
  ): Promise<Array<{ id?: string; tasks?: unknown }>> {
    const query = businessId ? `?${new URLSearchParams({ business: businessId })}` : '';
    const url = `${this.META_GRAPH_URL}/${assetId}/assigned_users${query}`;
    const assignedUsers: Array<{ id?: string; tasks?: unknown }> = [];
    let nextUrl: string | null = url;
    const visitedUrls = new Set<string>();
    while (nextUrl) {
      if (visitedUrls.has(nextUrl)) throw new Error('Meta returned a repeated pagination URL');
      visitedUrls.add(nextUrl);
      const response = await this.graphRequest(nextUrl, accessToken, { method: 'GET' }, tokenClass);
      if (!response.ok) {
        throw new Error(`Failed to verify assigned user access: ${await response.text()}`);
      }
      const payload = await response.json() as {
        data?: Array<{ id?: string; tasks?: unknown }>;
        paging?: { next?: string };
      };
      assignedUsers.push(...(payload.data || []));
      const next = payload.paging?.next;
      if (next && new URL(next).origin !== new URL(this.META_GRAPH_URL).origin) {
        throw new Error('Meta returned an invalid pagination URL');
      }
      nextUrl = next || null;
    }
    return assignedUsers;
  }

  private async getAgencyPages<T>(
    accessToken: string,
    url: string,
    failure: string,
    tokenClass: MetaGraphTokenClass = 'client_user'
  ): Promise<T[]> {
    const agencies: T[] = [];
    let nextUrl: string | null = url;
    const visitedUrls = new Set<string>();
    while (nextUrl) {
      if (visitedUrls.has(nextUrl)) throw new Error('Meta returned a repeated pagination URL');
      visitedUrls.add(nextUrl);
      const response = await this.graphRequest(nextUrl, accessToken, { method: 'GET' }, tokenClass);
      if (!response.ok) throw new Error(`${failure}: ${await response.text()}`);
      const payload = await response.json() as { data?: T[]; paging?: { next?: string } };
      agencies.push(...(payload.data || []));
      const next = payload.paging?.next;
      if (next && new URL(next).origin !== new URL(this.META_GRAPH_URL).origin) {
        throw new Error('Meta returned an invalid pagination URL');
      }
      nextUrl = next || null;
    }
    return agencies;
  }

  private getAgencies(
    accessToken: string,
    assetId: string,
    tokenClass: MetaGraphTokenClass = 'client_user'
  ): Promise<Array<{ id?: string }>> {
    return this.getAgencyPages(
      accessToken,
      `${this.META_GRAPH_URL}/${assetId}/agencies`,
      'Failed to read Meta asset agencies',
      tokenClass
    );
  }

  private async getAgenciesWithTasks(
    accessToken: string,
    assetId: string,
    tokenClass: MetaGraphTokenClass = 'client_user'
  ): Promise<Array<{ id?: string; permitted_tasks?: unknown }>> {
    return this.getAgencyPages(
      accessToken,
      `${this.META_GRAPH_URL}/${assetId}/agencies?fields=id,permitted_tasks`,
      'Failed to verify Meta agency permissions',
      tokenClass
    );
  }

  private async getAgencyAccess(
    accessToken: string,
    assetId: string,
    agencyBusinessId: string,
    requiredTasks: string[],
    tokenClass: MetaGraphTokenClass = 'client_user',
    options?: { pagePartnerTaskComparison?: boolean }
  ): Promise<MetaAssignedUserVerificationResult> {
    const agencies = await this.getAgenciesWithTasks(accessToken, assetId, tokenClass);
    const agency = agencies.find((item) => item.id === agencyBusinessId);
    const assignedTasks = this.normalizeTasks(agency?.permitted_tasks);
    const tasksSatisfied = options?.pagePartnerTaskComparison
      ? metaPagePartnerPermittedTasksSatisfyRequired(assignedTasks, requiredTasks)
      : requiredTasks.every((task) => assignedTasks.includes(task));
    return {
      verified: Boolean(agency) && tasksSatisfied,
      assignedTasks,
    };
  }

  /**
   * Page /{page-id}/agencies requires a Page access token. Resolve one from the user token without logging it.
   */
  async obtainPageAccessTokenForAgencies(
    userToken: string,
    pageId: string
  ): Promise<{ accessToken: string; source: MetaPageAccessTokenSource }> {
    const pageFieldsUrl = `${this.META_GRAPH_URL}/${pageId}?fields=access_token`;
    const pageFieldsResponse = await this.graphRequest(pageFieldsUrl, userToken, { method: 'GET' }, 'client_user');
    if (pageFieldsResponse.ok) {
      const body = (await pageFieldsResponse.json()) as { access_token?: string };
      const token = body.access_token?.trim();
      if (token) {
        return { accessToken: token, source: 'page_fields' };
      }
    }

    const accountsUrl = `${this.META_GRAPH_URL}/me/accounts?fields=id,access_token`;
    const accountsResponse = await this.graphRequest(accountsUrl, userToken, { method: 'GET' }, 'client_user');
    if (accountsResponse.ok) {
      const body = (await accountsResponse.json()) as {
        data?: Array<{ id?: string; access_token?: string }>;
      };
      const match = (body.data ?? []).find((row) => row.id === pageId);
      const token = match?.access_token?.trim();
      if (token) {
        return { accessToken: token, source: 'me_accounts' };
      }
    }

    throw new MetaPageAccessTokenUnavailableError();
  }

  async resolvePageAccessTokenPhase(
    userToken: string,
    pageId: string
  ): Promise<MetaPageAccessTokenPhaseResult> {
    try {
      const resolved = await this.obtainPageAccessTokenForAgencies(userToken, pageId);
      return { obtained: true, source: resolved.source };
    } catch (error) {
      if (error instanceof MetaPageAccessTokenUnavailableError) {
        return { obtained: false };
      }
      throw error;
    }
  }

  private async resolveAgenciesCallContext(
    clientToken: string,
    assetId: string,
    assetKind: MetaAgencyPartnerAssetKind = 'generic'
  ): Promise<{ accessToken: string; tokenClass: MetaGraphTokenClass }> {
    if (assetKind === 'page') {
      const pageToken = await this.obtainPageAccessTokenForAgencies(clientToken, assetId);
      return { accessToken: pageToken.accessToken, tokenClass: 'selected_page' };
    }
    return { accessToken: clientToken, tokenClass: 'client_user' };
  }

  async grantAgencyPartnerAccess(
    clientToken: string,
    assetId: string,
    agencyBusinessId: string,
    tasks: string[],
    options?: { assetKind?: MetaAgencyPartnerAssetKind }
  ): Promise<void> {
    const assetKind = options?.assetKind ?? 'generic';
    const { accessToken, tokenClass } = await this.resolveAgenciesCallContext(
      clientToken,
      assetId,
      assetKind
    );
    const formData = new URLSearchParams({
      business: agencyBusinessId,
      permitted_tasks: JSON.stringify(tasks),
    });
    const response = await this.graphRequest(
      `${this.META_GRAPH_URL}/${assetId}/agencies`,
      accessToken,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: formData.toString(),
      },
      tokenClass
    );
    if (!response.ok) {
      throw new Error(`Failed to share Meta asset with agency partner: ${await response.text()}`);
    }
  }

  async verifyAgencyPartnerAccess(
    clientToken: string,
    assetId: string,
    agencyBusinessId: string,
    requiredTasks: string[] = [],
    options?: { assetKind?: MetaAgencyPartnerAssetKind }
  ): Promise<MetaAssignedUserVerificationResult> {
    const assetKind = options?.assetKind ?? 'generic';
    const { accessToken, tokenClass } = await this.resolveAgenciesCallContext(
      clientToken,
      assetId,
      assetKind
    );
    return this.getAgencyAccess(accessToken, assetId, agencyBusinessId, requiredTasks, tokenClass, {
      pagePartnerTaskComparison: assetKind === 'page',
    });
  }

  async grantCatalogAgencyAccess(
    clientToken: string,
    catalogId: string,
    agencyBusinessId: string,
    tasks: string[]
  ): Promise<void> {
    await this.grantAgencyPartnerAccess(clientToken, catalogId, agencyBusinessId, tasks, {
      assetKind: 'catalog',
    });
  }

  async verifyCatalogAgencyAccess(
    clientToken: string,
    catalogId: string,
    agencyBusinessId: string,
    requiredTasks: string[] = []
  ): Promise<boolean> {
    const result = await this.verifyAgencyPartnerAccess(
      clientToken,
      catalogId,
      agencyBusinessId,
      requiredTasks,
      { assetKind: 'catalog' }
    );
    return result.verified;
  }

  async verifyAdAccountAgencyAccess(
    clientToken: string,
    adAccountId: string,
    agencyBusinessId: string,
    requiredTasks: string[]
  ): Promise<MetaAssignedUserVerificationResult> {
    return this.getAgencyAccess(clientToken, adAccountId, agencyBusinessId, requiredTasks);
  }

  /**
   * Grant agency access to a specific ad account
   *
   * @param clientToken - Client's OAuth access token
   * @param adAccountId - Ad account ID (e.g., 'act_123456')
   * @param businessId - Agency's Business Manager ID
   * @param role - Access level (ADMIN or ADVERTISER)
   */
  async grantAdAccountAccess(
    clientToken: string,
    adAccountId: string,
    systemUserId: string,
    tasks: string[] = DEFAULT_AD_ACCOUNT_TASKS
  ): Promise<void> {
    await this.postAssignedUserAccess({
      assetId: adAccountId,
      accessToken: clientToken,
      systemUserId,
      tasks,
    });
  }

  async grantCatalogAccess(
    clientToken: string,
    catalogId: string,
    recipientId: string,
    tasks: string[]
  ): Promise<void> {
    await this.postAssignedUserAccess({
      assetId: catalogId,
      accessToken: clientToken,
      systemUserId: recipientId,
      tasks,
    });
  }

  async verifyCatalogAccess(
    clientToken: string,
    catalogId: string,
    recipientId: string,
    requiredTasks: string[]
  ): Promise<MetaAssignedUserVerificationResult> {
    return this.getAssignedUserAccess(clientToken, catalogId, recipientId, requiredTasks);
  }

  async verifyDatasetAccess(
    clientToken: string,
    datasetId: string,
    recipientId: string,
    requiredTasks: string[],
    businessId: string
  ): Promise<MetaAssignedUserVerificationResult> {
    return this.getAssignedUserAccess(clientToken, datasetId, recipientId, requiredTasks, businessId);
  }

  async verifyDatasetAgencyAccess(
    clientToken: string,
    datasetId: string,
    agencyBusinessId: string,
    requiredTasks: string[]
  ): Promise<MetaAssignedUserVerificationResult> {
    return this.getAgencyAccess(clientToken, datasetId, agencyBusinessId, requiredTasks);
  }

  /**
   * Grant agency access to a specific page
   *
   * @param clientToken - Client's OAuth access token
   * @param pageId - Page ID
   * @param agencySystemUserId - Agency's System User ID
   * @param clientBusinessId - Optional: client's Business Manager ID (owns the page)
   */
  async grantPageAccess(
    clientToken: string,
    pageId: string,
    agencySystemUserId: string,
    tasks: string[] = DEFAULT_PAGE_TASKS
  ): Promise<void> {
    const { accessToken, tokenClass } = await this.resolvePageAssignedUsersContext(clientToken, pageId);
    await this.postAssignedUserAccess({
      assetId: pageId,
      accessToken,
      systemUserId: agencySystemUserId,
      tasks,
      tokenClass,
    });
  }

  /**
   * Assign an agency person or system user to a partner-shared asset using the agency token.
   * Post-Partner Auto-Assign (ticket 08) — never substitutes for Partner share.
   */
  async assignAgencyRecipientToAsset(input: {
    agencyAccessToken: string;
    tokenClass?: MetaGraphTokenClass;
    agencyBusinessId: string;
    assetId: string;
    recipientId: string;
    tasks: string[];
  }): Promise<void> {
    await this.postAssignedUserAccess({
      assetId: input.assetId,
      accessToken: input.agencyAccessToken,
      systemUserId: input.recipientId,
      tasks: input.tasks,
      businessId: input.agencyBusinessId,
      tokenClass: input.tokenClass ?? 'client_user',
    });
  }

  async verifyAgencyRecipientOnAsset(input: {
    agencyAccessToken: string;
    tokenClass?: MetaGraphTokenClass;
    agencyBusinessId: string;
    assetId: string;
    recipientId: string;
    expectedTasks: string[];
  }): Promise<MetaAssignedUserVerificationResult> {
    const assignedUsers = await this.getAssignedUsers(
      input.agencyAccessToken,
      input.assetId,
      input.agencyBusinessId,
    );
    const assignedUser = assignedUsers.find((item) => item.id === input.recipientId);
    const assignedTasks = this.normalizeTasks(assignedUser?.tasks);
    const verified = assignedTasks.length >= input.expectedTasks.length &&
      input.expectedTasks.every((task) => assignedTasks.includes(task));
    return { verified, assignedTasks };
  }

  async verifyPageAccess(
    clientToken: string,
    pageId: string,
    systemUserId: string,
    expectedTasks: string[] = DEFAULT_PAGE_TASKS
  ): Promise<MetaAssignedUserVerificationResult> {
    const { accessToken, tokenClass } = await this.resolvePageAssignedUsersContext(clientToken, pageId);
    return this.getAssignedUserAccess(accessToken, pageId, systemUserId, expectedTasks, undefined, {
      pagePartnerTaskComparison: true,
      tokenClass,
    });
  }

  /** Page /{page-id}/assigned_users requires a Page access token, same as /agencies. */
  private async resolvePageAssignedUsersContext(
    clientToken: string,
    pageId: string
  ): Promise<{ accessToken: string; tokenClass: MetaGraphTokenClass }> {
    const pageToken = await this.obtainPageAccessTokenForAgencies(clientToken, pageId);
    return { accessToken: pageToken.accessToken, tokenClass: 'selected_page' };
  }

  async verifyAdAccountAccess(
    clientToken: string,
    adAccountId: string,
    systemUserId: string,
    expectedTasks: string[] = DEFAULT_AD_ACCOUNT_TASKS
  ): Promise<MetaAssignedUserVerificationResult> {
    return this.getAssignedUserAccess(clientToken, adAccountId, systemUserId, expectedTasks);
  }

  /** Revoke a user's assignment to a Meta asset. */
  async revokeAssignedUserAccess(
    clientToken: string,
    assetId: string,
    userId: string
  ): Promise<void> {
    if (!/^\d+$/.test(userId)) throw new Error('Meta assignee ID must be numeric');

    const existing = await this.getAssignedUsers(clientToken, assetId);
    if (!existing.some((user) => user.id === userId)) return;

    const formData = new URLSearchParams({ user: userId });
    const response = await this.graphRequest(`${this.META_GRAPH_URL}/${assetId}/assigned_users`, clientToken, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: formData.toString(),
    });

    if (!response.ok) {
      throw new Error(`Failed to revoke Meta assigned user: ${await response.text()}`);
    }

    const remaining = await this.getAssignedUsers(clientToken, assetId);
    if (remaining.some((user) => user.id === userId)) {
      throw new Error(`Meta still reports user ${userId} assigned to asset ${assetId}`);
    }
  }

  private async revokeAgencyFromAsset(
    clientToken: string,
    assetId: string,
    agencyBusinessId: string,
    readAgencies: (token: string, id: string) => Promise<Array<{ id?: string }>>,
    assetType: 'asset' | 'catalog',
  ): Promise<void> {
    const existing = await readAgencies(clientToken, assetId);
    if (!existing.some((agency) => agency.id === agencyBusinessId)) return;

    const formData = new URLSearchParams({ business: agencyBusinessId });
    const response = await this.graphRequest(`${this.META_GRAPH_URL}/${assetId}/agencies`, clientToken, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: formData.toString(),
    });
    const accessType = assetType === 'catalog' ? 'catalog agency' : 'agency';
    if (!response.ok) throw new Error(`Failed to revoke Meta ${accessType} access: ${await response.text()}`);

    const remaining = await readAgencies(clientToken, assetId);
    if (remaining.some((agency) => agency.id === agencyBusinessId)) {
      throw new Error(`Meta still reports agency ${agencyBusinessId} assigned to ${assetType} ${assetId}`);
    }
  }

  async revokeAgencyAccess(
    clientToken: string,
    assetId: string,
    agencyBusinessId: string,
    options?: { assetKind?: MetaAgencyPartnerAssetKind }
  ): Promise<void> {
    const assetKind = options?.assetKind ?? 'generic';
    const readAgencies = async (token: string, id: string) =>
      this.getAgencies(token, id, assetKind === 'page' ? 'selected_page' : 'client_user');
    if (assetKind === 'page') {
      const { accessToken, tokenClass } = await this.resolveAgenciesCallContext(
        clientToken,
        assetId,
        'page'
      );
      await this.revokeAgencyFromAssetWithToken(
        accessToken,
        assetId,
        agencyBusinessId,
        readAgencies,
        'asset',
        tokenClass
      );
      return;
    }
    await this.revokeAgencyFromAsset(clientToken, assetId, agencyBusinessId, readAgencies, 'asset');
  }

  private async revokeAgencyFromAssetWithToken(
    accessToken: string,
    assetId: string,
    agencyBusinessId: string,
    readAgencies: (token: string, id: string) => Promise<Array<{ id?: string }>>,
    assetType: 'asset' | 'catalog',
    tokenClass: MetaGraphTokenClass
  ): Promise<void> {
    const existing = await readAgencies(accessToken, assetId);
    if (!existing.some((agency) => agency.id === agencyBusinessId)) return;

    const formData = new URLSearchParams({ business: agencyBusinessId });
    const response = await this.graphRequest(
      `${this.META_GRAPH_URL}/${assetId}/agencies`,
      accessToken,
      {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: formData.toString(),
      },
      tokenClass
    );
    const accessType = assetType === 'catalog' ? 'catalog agency' : 'agency';
    if (!response.ok) {
      throw new Error(`Failed to revoke Meta ${accessType} access: ${await response.text()}`);
    }

    const remaining = await readAgencies(accessToken, assetId);
    if (remaining.some((agency) => agency.id === agencyBusinessId)) {
      throw new Error(`Meta still reports agency ${agencyBusinessId} assigned to ${assetType} ${assetId}`);
    }
  }

  async revokeCatalogAgencyAccess(clientToken: string, catalogId: string, agencyBusinessId: string): Promise<void> {
    await this.revokeAgencyFromAsset(clientToken, catalogId, agencyBusinessId, this.getAgenciesWithTasks.bind(this), 'catalog');
  }
}

export const metaPartnerService = new MetaPartnerService();
