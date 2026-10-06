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

export interface MetaAssignedUserVerificationResult {
  verified: boolean;
  assignedTasks: string[];
}

const DEFAULT_PAGE_TASKS = ['MANAGE', 'CREATE_CONTENT', 'MODERATE', 'ADVERTISE'];
const DEFAULT_AD_ACCOUNT_TASKS = ['MANAGE', 'ADVERTISE', 'ANALYZE'];

class MetaPartnerService {
  private readonly META_GRAPH_URL = `https://graph.facebook.com/${META_GRAPH_VERSION}`;
  private readonly REQUEST_TIMEOUT_MS = 15_000;

  private async graphRequest(
    url: string,
    accessToken: string,
    init: RequestInit
  ): Promise<Response> {
    return metaGraphFetch(url, {
      ...init,
      accessToken,
      tokenClass: 'client_user',
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
  }): Promise<void> {
    const url = `${this.META_GRAPH_URL}/${input.assetId}/assigned_users`;
    const formData = new URLSearchParams();
    formData.append('user', input.systemUserId);
    formData.append('tasks', JSON.stringify(input.tasks));
    const response = await this.graphRequest(url, input.accessToken, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: formData.toString(),
    });

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
    businessId?: string
  ): Promise<MetaAssignedUserVerificationResult> {
    const assignedUsers = await this.getAssignedUsers(accessToken, assetId, businessId);

    const assignedUser = assignedUsers.find((item) => item.id === systemUserId);
    const assignedTasks = this.normalizeTasks(assignedUser?.tasks);
    const verified = assignedTasks.length === expectedTasks.length &&
      expectedTasks.every((task) => assignedTasks.includes(task));

    return {
      verified,
      assignedTasks,
    };
  }

  private async getAssignedUsers(
    accessToken: string,
    assetId: string,
    businessId?: string
  ): Promise<Array<{ id?: string; tasks?: unknown }>> {
    const query = businessId ? `?${new URLSearchParams({ business: businessId })}` : '';
    const url = `${this.META_GRAPH_URL}/${assetId}/assigned_users${query}`;
    const assignedUsers: Array<{ id?: string; tasks?: unknown }> = [];
    let nextUrl: string | null = url;
    const visitedUrls = new Set<string>();
    while (nextUrl) {
      if (visitedUrls.has(nextUrl)) throw new Error('Meta returned a repeated pagination URL');
      visitedUrls.add(nextUrl);
      const response = await this.graphRequest(nextUrl, accessToken, { method: 'GET' });
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

  private async getAgencyPages<T>(accessToken: string, url: string, failure: string): Promise<T[]> {
    const agencies: T[] = [];
    let nextUrl: string | null = url;
    const visitedUrls = new Set<string>();
    while (nextUrl) {
      if (visitedUrls.has(nextUrl)) throw new Error('Meta returned a repeated pagination URL');
      visitedUrls.add(nextUrl);
      const response = await this.graphRequest(nextUrl, accessToken, { method: 'GET' });
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

  private getAgencies(accessToken: string, assetId: string): Promise<Array<{ id?: string }>> {
    return this.getAgencyPages(accessToken, `${this.META_GRAPH_URL}/${assetId}/agencies`, 'Failed to read Meta asset agencies');
  }

  private async getAgenciesWithTasks(
    accessToken: string,
    assetId: string
  ): Promise<Array<{ id?: string; permitted_tasks?: unknown }>> {
    return this.getAgencyPages(
      accessToken,
      `${this.META_GRAPH_URL}/${assetId}/agencies?fields=id,permitted_tasks`,
      'Failed to verify Meta agency permissions',
    );
  }

  private async getAgencyAccess(
    accessToken: string,
    assetId: string,
    agencyBusinessId: string,
    requiredTasks: string[]
  ): Promise<MetaAssignedUserVerificationResult> {
    const agencies = await this.getAgenciesWithTasks(accessToken, assetId);
    const agency = agencies.find((item) => item.id === agencyBusinessId);
    const assignedTasks = this.normalizeTasks(agency?.permitted_tasks);
    return {
      verified: Boolean(agency) && requiredTasks.every((task) => assignedTasks.includes(task)),
      assignedTasks,
    };
  }

  async grantAgencyPartnerAccess(
    clientToken: string,
    assetId: string,
    agencyBusinessId: string,
    tasks: string[]
  ): Promise<void> {
    const formData = new URLSearchParams({
      business: agencyBusinessId,
      permitted_tasks: JSON.stringify(tasks),
    });
    const response = await this.graphRequest(`${this.META_GRAPH_URL}/${assetId}/agencies`, clientToken, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: formData.toString(),
    });
    if (!response.ok) {
      throw new Error(`Failed to share Meta asset with agency partner: ${await response.text()}`);
    }
  }

  async verifyAgencyPartnerAccess(
    clientToken: string,
    assetId: string,
    agencyBusinessId: string,
    requiredTasks: string[] = []
  ): Promise<MetaAssignedUserVerificationResult> {
    return this.getAgencyAccess(clientToken, assetId, agencyBusinessId, requiredTasks);
  }

  async grantCatalogAgencyAccess(
    clientToken: string,
    catalogId: string,
    agencyBusinessId: string,
    tasks: string[]
  ): Promise<void> {
    await this.grantAgencyPartnerAccess(clientToken, catalogId, agencyBusinessId, tasks);
  }

  async verifyCatalogAgencyAccess(
    clientToken: string,
    catalogId: string,
    agencyBusinessId: string,
    requiredTasks: string[] = []
  ): Promise<boolean> {
    const result = await this.verifyAgencyPartnerAccess(clientToken, catalogId, agencyBusinessId, requiredTasks);
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
    await this.postAssignedUserAccess({
      assetId: pageId,
      accessToken: clientToken,
      systemUserId: agencySystemUserId,
      tasks,
    });
  }

  async verifyPageAccess(
    clientToken: string,
    pageId: string,
    systemUserId: string,
    expectedTasks: string[] = DEFAULT_PAGE_TASKS
  ): Promise<MetaAssignedUserVerificationResult> {
    return this.getAssignedUserAccess(clientToken, pageId, systemUserId, expectedTasks);
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

  async revokeAgencyAccess(clientToken: string, assetId: string, agencyBusinessId: string): Promise<void> {
    await this.revokeAgencyFromAsset(clientToken, assetId, agencyBusinessId, this.getAgencies.bind(this), 'asset');
  }

  async revokeCatalogAgencyAccess(clientToken: string, catalogId: string, agencyBusinessId: string): Promise<void> {
    await this.revokeAgencyFromAsset(clientToken, catalogId, agencyBusinessId, this.getAgenciesWithTasks.bind(this), 'catalog');
  }
}

export const metaPartnerService = new MetaPartnerService();
