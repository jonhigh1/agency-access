import { infisical } from '../../lib/infisical.js';

/**
 * Beehiiv Publication Response
 *
 * Beehiiv API returns publication data in this format.
 */
interface BeehiivPublication {
  id: string;
  name: string;
  [key: string]: any;
}

/**
 * Beehiiv Connector (NON-OAUTH)
 *
 * Uses team invitation workflow instead of OAuth:
 * 1. Client adds agency as team member in Beehiiv UI
 * 2. Agency provides their Beehiiv API key
 * 3. Platform verifies agency can access client's publication
 * 4. Agency's API key stored in Infisical
 *
 * @see https://www.beehiiv.com/docs/api
 */
export class BeehiivConnector {
  readonly authMode = 'api_key' as const;

  private readonly API_BASE = 'https://api.beehiiv.com/v2';

  /**
   * Verify API key is valid
   *
   * Tests validity by fetching publications list.
   */
  async verifyToken(apiKey: string): Promise<boolean> {
    try {
      const response = await fetch(`${this.API_BASE}/publications`, {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
        },
      });

      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * Get publication details
   *
   * Fetches specific publication by ID using agency's API key.
   */
  async getPublication(apiKey: string, publicationId: string): Promise<BeehiivPublication> {
    const response = await fetch(
      `${this.API_BASE}/publications/${publicationId}`,
      {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
        },
      }
    );

    if (!response.ok) {
      if (response.status === 404) {
        throw new Error('Publication not found');
      }
      const error = await response.text();
      throw new Error(`Failed to fetch publication: ${error}`);
    }

    const publication = await response.json() as BeehiivPublication;
    return publication;
  }

  /**
   * Verify agency has access to client's publication
   *
   * This is the core of Beehiiv's team invitation workflow.
   * If the agency can fetch the publication, they have team access.
   */
  async verifyTeamAccess(
    agencyApiKey: string,
    clientPublicationId: string
  ): Promise<{
    hasAccess: boolean;
    publication?: BeehiivPublication;
    error?: string;
  }> {
    try {
      const publication = await this.getPublication(agencyApiKey, clientPublicationId);
      return {
        hasAccess: true,
        publication,
      };
    } catch (error) {
      return {
        hasAccess: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Store agency's API key in Infisical
   *
   * Agency's API key is stored securely and can be reused
   * for verifying access to multiple client publications.
   */
  async storeAgencyApiKey(agencyId: string, apiKey: string): Promise<string> {
    const secretName = `beehiiv_agency_key_${agencyId}`;
    return await infisical.storeOAuthTokens(secretName, {
      accessToken: apiKey,
    });
  }

  /**
   * Retrieve agency's API key from Infisical
   */
  async getAgencyApiKey(agencyId: string): Promise<string> {
    const secretName = `beehiiv_agency_key_${agencyId}`;
    const tokens = await infisical.getOAuthTokens(secretName);
    return tokens.accessToken;
  }
}

/**
 * Singleton instance for use throughout the application
 */
export const beehiivConnector = new BeehiivConnector();
