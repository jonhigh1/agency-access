/**
 * Client Service Tests
 *
 * Test-Driven Development for Phase 5 Client Management
 * Following Red-Green-Refactor cycle
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { prisma } from '@/lib/prisma';
import * as clientService from '@/services/client.service';
import { connectionService } from '@/services/connection.service';

// Mock Prisma
vi.mock('@/lib/prisma', () => ({
  prisma: {
    client: {
      create: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      count: vi.fn(),
    },
    agency: {
      findUnique: vi.fn(),
    },
    agencyPlatformConnection: {
      findMany: vi.fn(),
    },
  },
}));

vi.mock('@/services/connection.service', () => ({
  connectionService: { revokeConnection: vi.fn() },
}));

const mockPrisma = vi.mocked(prisma);

describe('Phase 5: Client Service - TDD Tests', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(connectionService.revokeConnection).mockResolvedValue({ data: null, error: null } as any);
    vi.mocked(mockPrisma.agencyPlatformConnection.findMany).mockResolvedValue([]);
  });

  describe('createClient', () => {
    it('should create a client with valid data', async () => {
      const mockClient = {
        id: 'client-1',
        agencyId: 'agency-1',
        name: 'John Smith',
        company: 'Acme Corporation',
        email: 'john@acme.com',
        website: 'https://acme.com',
        language: 'en',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.mocked(mockPrisma.client.findFirst).mockResolvedValue(null);
      vi.mocked(mockPrisma.client.create).mockResolvedValue(mockClient);

      const result = await clientService.createClient({
        agencyId: 'agency-1',
        name: 'John Smith',
        company: 'Acme Corporation',
        email: 'john@acme.com',
        website: 'https://acme.com',
        language: 'en',
      });

      expect(result).toEqual(mockClient);
      expect(mockPrisma.client.create).toHaveBeenCalledWith({
        data: {
          agencyId: 'agency-1',
          name: 'John Smith',
          company: 'Acme Corporation',
          email: 'john@acme.com',
          website: 'https://acme.com',
          language: 'en',
        },
      });
    });

    it('should create a client with default language en', async () => {
      const mockClient = {
        id: 'client-2',
        agencyId: 'agency-1',
        name: 'Jane Doe',
        company: 'TechCo',
        email: 'jane@techco.com',
        language: 'en',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.mocked(mockPrisma.client.findFirst).mockResolvedValue(null);
      vi.mocked(mockPrisma.client.create).mockResolvedValue(mockClient);

      const result = await clientService.createClient({
        agencyId: 'agency-1',
        name: 'Jane Doe',
        company: 'TechCo',
        email: 'jane@techco.com',
      });

      expect(result.language).toBe('en');
      expect(mockPrisma.client.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ language: 'en' }),
      });
    });

    it('should prevent duplicate email per agency', async () => {
      vi.mocked(mockPrisma.client.findFirst).mockResolvedValue({
        id: 'existing-client',
        email: 'john@acme.com',
      });

      await expect(
        clientService.createClient({
          agencyId: 'agency-1',
          name: 'John Smith',
          company: 'Acme Corp',
          email: 'john@acme.com',
        })
      ).rejects.toThrow('CLIENT_EMAIL_EXISTS');

      expect(mockPrisma.client.create).not.toHaveBeenCalled();
    });

    it('should validate email format', async () => {
      vi.mocked(mockPrisma.client.findFirst).mockResolvedValue(null);

      await expect(
        clientService.createClient({
          agencyId: 'agency-1',
          name: 'Test',
          company: 'Test',
          email: 'invalid-email',
        })
      ).rejects.toThrow();
    });
  });

  describe('getClients', () => {
    it('should return all clients for an agency', async () => {
      const mockClients = [
        {
          id: 'client-1',
          name: 'Alice Anderson',
          company: 'AAA Inc',
          email: 'alice@aaa.com',
          language: 'en',
        },
        {
          id: 'client-2',
          name: 'Bob Brown',
          company: 'BBB LLC',
          email: 'bob@bbb.com',
          language: 'es',
        },
      ];

      vi.mocked(mockPrisma.client.findMany).mockResolvedValue(mockClients);
      vi.mocked(mockPrisma.client.count).mockResolvedValue(2);

      const result = await clientService.getClients({
        agencyId: 'agency-1',
      });

      expect(result.data).toEqual(mockClients);
      expect(result.pagination.total).toBe(2);
    });

    it('should support pagination with limit and offset', async () => {
      const mockClients = [
        { id: 'client-2', name: 'Bob Brown' },
      ];

      vi.mocked(mockPrisma.client.findMany).mockResolvedValue(mockClients);
      vi.mocked(mockPrisma.client.count).mockResolvedValue(3);

      const result = await clientService.getClients({
        agencyId: 'agency-1',
        limit: 2,
        offset: 1,
      });

      expect(mockPrisma.client.findMany).toHaveBeenCalledWith({
        where: { agencyId: 'agency-1' },
        take: 2,
        skip: 1,
        orderBy: { createdAt: 'desc' },
      });
      expect(result.data).toHaveLength(1);
    });

    it('should search clients by name, company, or email', async () => {
      const mockClients = [
        { id: 'client-1', name: 'Alice Anderson' },
      ];

      vi.mocked(mockPrisma.client.findMany).mockResolvedValue(mockClients);
      vi.mocked(mockPrisma.client.count).mockResolvedValue(1);

      const result = await clientService.getClients({
        agencyId: 'agency-1',
        search: 'Alice',
      });

      expect(mockPrisma.client.findMany).toHaveBeenCalledWith({
        where: {
          agencyId: 'agency-1',
          OR: [
            { name: { contains: 'Alice', mode: 'insensitive' } },
            { company: { contains: 'Alice', mode: 'insensitive' } },
            { email: { contains: 'Alice', mode: 'insensitive' } },
          ],
        },
        take: 50,
        skip: 0,
        orderBy: { createdAt: 'desc' },
      });
    });
  });

  describe('getClientsWithConnections', () => {
    it('counts access requests independently from connections', async () => {
      vi.mocked(mockPrisma.client.findMany).mockResolvedValue([
        {
          id: 'client-1', name: 'Alice', email: 'alice@example.com', company: 'Acme',
          createdAt: new Date('2026-01-01'), accessRequests: [], _count: { accessRequests: 12 },
        },
      ] as any);
      vi.mocked(mockPrisma.client.count).mockResolvedValue(1);

      const result = await clientService.getClientsWithConnections({ agencyId: 'agency-1' });

      expect(result.data[0]).toMatchObject({ requestCount: 12 });
      expect(mockPrisma.client.findMany).toHaveBeenCalledWith(expect.objectContaining({
        include: expect.objectContaining({ _count: { select: { accessRequests: true } } }),
      }));
    });
  });

  describe('getClientById', () => {
    it('should return client by id', async () => {
      const mockClient = {
        id: 'client-1',
        agencyId: 'agency-1',
        name: 'Find Me',
        company: 'Findable Inc',
        email: 'findme@test.com',
      };

      vi.mocked(mockPrisma.client.findFirst).mockResolvedValue(mockClient);

      const result = await clientService.getClientById('client-1', 'agency-1');

      expect(result).toEqual(mockClient);
      expect(mockPrisma.client.findFirst).toHaveBeenCalledWith({
        where: { id: 'client-1', agencyId: 'agency-1' },
      });
    });

    it('should return null for non-existent client', async () => {
      vi.mocked(mockPrisma.client.findFirst).mockResolvedValue(null);

      const result = await clientService.getClientById('non-existent', 'agency-1');

      expect(result).toBeNull();
    });
  });

  describe('updateClient', () => {
    it('should update client fields', async () => {
      const mockUpdatedClient = {
        id: 'client-1',
        name: 'Updated Name',
        company: 'Original Company',
        email: 'original@test.com',
        website: 'https://updated.com',
        language: 'es',
      };

      vi.mocked(mockPrisma.client.findFirst)
        .mockResolvedValueOnce({
          id: 'client-1',
          agencyId: 'agency-1',
          email: 'original@test.com',
        } as any)
        .mockResolvedValueOnce(null);
      vi.mocked(mockPrisma.client.update).mockResolvedValue(mockUpdatedClient);

      const result = await clientService.updateClient('client-1', 'agency-1', {
        name: 'Updated Name',
        website: 'https://updated.com',
        language: 'es',
      });

      expect(result.name).toBe('Updated Name');
      expect(result.website).toBe('https://updated.com');
      expect(result.language).toBe('es');
    });

    it('should not allow updating email to duplicate', async () => {
      vi.mocked(mockPrisma.client.findFirst)
        .mockResolvedValueOnce({
          id: 'client-1',
          agencyId: 'agency-1',
        } as any)
        .mockResolvedValueOnce({
          id: 'different-client',
          email: 'existing@test.com',
        } as any);

      await expect(
        clientService.updateClient('client-1', 'agency-1', {
          email: 'existing@test.com',
        })
      ).rejects.toThrow('CLIENT_EMAIL_EXISTS');
    });
  });

  describe('findClientByEmail', () => {
    it('should find client by email', async () => {
      const mockClient = {
        id: 'client-1',
        email: 'searchable@test.com',
      };

      vi.mocked(mockPrisma.client.findFirst).mockResolvedValue(mockClient);

      const result = await clientService.findClientByEmail('agency-1', 'searchable@test.com');

      expect(result).toEqual(mockClient);
    });

    it('should return null for non-existent email', async () => {
      vi.mocked(mockPrisma.client.findFirst).mockResolvedValue(null);

      const result = await clientService.findClientByEmail('agency-1', 'nonexistent@test.com');

      expect(result).toBeNull();
    });
  });

  describe('deleteClient', () => {
    it('should delete a client', async () => {
      vi.mocked(mockPrisma.client.findUnique).mockResolvedValue({
        id: 'client-1',
        agencyId: 'agency-1',
        accessRequests: [], // No connections to clean up
      } as any);
      vi.mocked(mockPrisma.client.delete).mockResolvedValue({ id: 'client-1' } as any);

      const result = await clientService.deleteClient('client-1', 'agency-1');

      expect(result).toBe(true);
      expect(mockPrisma.client.delete).toHaveBeenCalledWith({
        where: { id: 'client-1' },
      });
    });

    it('should return false for non-existent client', async () => {
      vi.mocked(mockPrisma.client.findUnique).mockResolvedValue(null);

      const result = await clientService.deleteClient('non-existent', 'agency-1');

      expect(result).toBe(false);
    });

    it('should return false when client belongs to different agency', async () => {
      vi.mocked(mockPrisma.client.findUnique).mockResolvedValue({
        id: 'client-1',
        agencyId: 'other-agency',
        accessRequests: [],
      } as any);

      const result = await clientService.deleteClient('client-1', 'agency-1');

      expect(result).toBe(false);
      expect(mockPrisma.client.delete).not.toHaveBeenCalled();
    });

    it('should fail closed when provider access revocation fails', async () => {
      vi.mocked(mockPrisma.client.findUnique).mockResolvedValue({
        id: 'client-1',
        agencyId: 'agency-1',
        accessRequests: [{
          connection: { id: 'connection-1', authorizations: [{ secretId: 'secret-1' }] },
        }],
      } as any);
      vi.mocked(connectionService.revokeConnection).mockResolvedValue({
        data: null,
        error: { code: 'META_ACCESS_REVOCATION_FAILED', message: 'Meta access revocation failed' },
      } as any);

      await expect(clientService.deleteClient('client-1', 'agency-1')).rejects.toThrow('Meta access revocation failed');
      expect(mockPrisma.client.delete).not.toHaveBeenCalled();
    });
  });

  describe('getClientDetail', () => {
    it('filters by agency before loading nested client history', async () => {
      vi.mocked(mockPrisma.client.findUnique).mockResolvedValue(null);

      expect(await clientService.getClientDetail({ clientId: 'client-1', agencyId: 'agency-2' })).toBeNull();
      expect(mockPrisma.client.findUnique).toHaveBeenCalledWith(expect.objectContaining({
        where: { id: 'client-1', agencyId: 'agency-2' },
      }));
    });

    it('uses verified Meta grants for catalog-only and Instagram client status', async () => {
      const now = new Date('2026-09-24T12:00:00.000Z');
      const grants = [
        { assetKind: 'catalog', assetId: 'catalog-1' },
        { assetKind: 'instagram_account', assetId: 'instagram-1' },
      ].flatMap(({ assetKind, assetId }) => ['business', 'human'].map((recipientType) => ({
        assetKind,
        assetId,
        status: 'verified',
        recipientType,
        recipientId: recipientType === 'business' ? 'business-1' : 'person-1',
        requestedTasks: ['MANAGE'],
        verifiedTasks: ['MANAGE'],
        verifiedAuthorizationEpoch: 2,
        authorization: { authorizationEpoch: 2, status: 'active', expiresAt: null },
        destination: { businessId: 'agency-business-1', agencyConnection: { status: 'active', businessId: 'agency-business-1' } },
      })));
      const clientData = {
        id: 'client-1', agencyId: 'agency-1', name: 'Taylor Client', company: 'Acme', email: 'taylor@acme.com',
        website: null, language: 'en', createdAt: now, updatedAt: now,
        accessRequests: [{
          id: 'request-meta', clientName: 'Meta access', status: 'completed', createdAt: now, authorizedAt: now,
          platforms: { meta: ['meta_ads', 'instagram'] },
          metaAccessConfig: { recipients: [{ type: 'human', id: 'person-1', name: 'Operator' }], pageTasks: [], adAccountTasks: [], datasetTasks: [] },
          connection: {
            id: 'connection-meta', status: 'active', createdAt: now,
            // Instagram selections are stored under meta_ads (U4 / invite truth).
            grantedAssets: {
              meta_ads: { catalogs: ['catalog-1'], instagramAccounts: ['instagram-1'] },
            },
            authorizations: [{ platform: 'meta', status: 'active', authorizationEpoch: 2, expiresAt: null }],
            metaAssetGrants: grants,
          },
        }],
      } as any;
      vi.mocked(mockPrisma.client.findUnique).mockResolvedValue(clientData);

      const result = await clientService.getClientDetail({ clientId: 'client-1', agencyId: 'agency-1' });

      expect(result?.platformGroups).toEqual(expect.arrayContaining([
        expect.objectContaining({ platformGroup: 'meta', products: expect.arrayContaining([
          expect.objectContaining({ product: 'meta_ads', status: 'connected' }),
          expect.objectContaining({ product: 'instagram', status: 'connected' }),
        ]) }),
      ]));

      clientData.accessRequests[0].connection.metaAssetGrants = grants.map((grant) => ({ ...grant, status: 'stale' }));
      const staleResult = await clientService.getClientDetail({ clientId: 'client-1', agencyId: 'agency-1' });
      expect(staleResult?.platformGroups[0].products).toEqual(expect.arrayContaining([
        expect.objectContaining({ product: 'meta_ads', status: 'needs_reconnect', note: 'Reconnect Meta to verify access again' }),
        expect.objectContaining({ product: 'instagram', status: 'needs_reconnect', note: 'Reconnect Meta to verify access again' }),
      ]));

      clientData.accessRequests[0].connection.metaAssetGrants = grants.map((grant) => ({ ...grant, status: 'sharing_attempted' }));
      const sharingResult = await clientService.getClientDetail({ clientId: 'client-1', agencyId: 'agency-1' });
      expect(sharingResult?.platformGroups[0].products).toEqual(expect.arrayContaining([
        expect.objectContaining({ product: 'meta_ads', status: 'selection_required', note: 'Finish sharing and verify Meta access' }),
        expect.objectContaining({ product: 'instagram', status: 'selection_required', note: 'Finish sharing and verify Meta access' }),
      ]));
    });

    it('keeps Google products pending until a native grant lifecycle is verified', async () => {
      vi.mocked(mockPrisma.client.findUnique).mockResolvedValue({
        id: 'client-1',
        agencyId: 'agency-1',
        name: 'Taylor Client',
        company: 'Acme',
        email: 'taylor@acme.com',
        website: null,
        language: 'en',
        createdAt: new Date('2026-03-01T00:00:00.000Z'),
        updatedAt: new Date('2026-03-05T00:00:00.000Z'),
        accessRequests: [
          {
            id: 'request-google-oauth-only',
            clientName: 'Google Ads access',
            status: 'partial',
            createdAt: new Date('2026-03-08T00:00:00.000Z'),
            authorizedAt: new Date('2026-03-08T01:00:00.000Z'),
            platforms: { google: ['google_ads'] },
            connection: {
              id: 'connection-1',
              status: 'active',
              createdAt: new Date('2026-03-08T01:00:00.000Z'),
              grantedAssets: {
                google_ads: {
                  adAccounts: [{ id: 'acc-1', name: 'Main Account' }],
                },
              },
              authorizations: [
                {
                  platform: 'google',
                  status: 'active',
                  metadata: {},
                },
              ],
            },
          },
        ],
      } as any);

      const result = await clientService.getClientDetail({
        clientId: 'client-1',
        agencyId: 'agency-1',
      });

      expect(result?.platformGroups).toEqual([
        expect.objectContaining({
          platformGroup: 'google',
          status: 'pending',
          fulfilledCount: 0,
          requestedCount: 1,
          products: [
            expect.objectContaining({
              product: 'google_ads',
              status: 'pending',
              googleGrantLifecycle: expect.objectContaining({
                state: 'oauth_only_insufficient',
                isFulfilled: false,
              }),
            }),
          ],
        }),
      ]);
    });

    it('surfaces agency MCC manager_link as the Google Ads fulfillment mode on client detail', async () => {
      vi.mocked(mockPrisma.agencyPlatformConnection.findMany).mockResolvedValue([
        {
          platform: 'google',
          metadata: {
            googleAssetSettings: {
              googleAdsManagement: {
                preferredGrantMode: 'manager_link',
                managerCustomerId: '999-888-7777',
              },
            },
          },
        },
      ] as any);
      vi.mocked(mockPrisma.client.findUnique).mockResolvedValue({
        id: 'client-1',
        agencyId: 'agency-1',
        name: 'Taylor Client',
        company: 'Acme',
        email: 'taylor@acme.com',
        website: null,
        language: 'en',
        createdAt: new Date('2026-03-01T00:00:00.000Z'),
        updatedAt: new Date('2026-03-05T00:00:00.000Z'),
        accessRequests: [
          {
            id: 'request-google-mcc',
            clientName: 'Google Ads MCC',
            status: 'partial',
            createdAt: new Date('2026-03-08T00:00:00.000Z'),
            authorizedAt: new Date('2026-03-08T01:00:00.000Z'),
            platforms: { google: ['google_ads'] },
            connection: {
              id: 'connection-mcc',
              status: 'active',
              createdAt: new Date('2026-03-08T01:00:00.000Z'),
              grantedAssets: {
                google_ads: {
                  adAccounts: [{ id: 'acc-1', name: 'Main Account' }],
                },
              },
              authorizations: [
                {
                  platform: 'google',
                  status: 'active',
                  metadata: {},
                },
              ],
            },
          },
        ],
      } as any);

      const result = await clientService.getClientDetail({
        clientId: 'client-1',
        agencyId: 'agency-1',
      });

      expect(result?.platformGroups).toEqual([
        expect.objectContaining({
          platformGroup: 'google',
          products: [
            expect.objectContaining({
              product: 'google_ads',
              status: 'pending',
              googleGrantLifecycle: expect.objectContaining({
                fulfillmentMode: 'manager_link',
                state: 'oauth_only_insufficient',
                isFulfilled: false,
              }),
            }),
          ],
        }),
      ]);
    });

    it('aggregates platform-group progress and product-level statuses', async () => {
      vi.mocked(mockPrisma.client.findUnique).mockResolvedValue({
        id: 'client-1',
        agencyId: 'agency-1',
        name: 'Taylor Client',
        company: 'Acme',
        email: 'taylor@acme.com',
        website: null,
        language: 'en',
        createdAt: new Date('2026-03-01T00:00:00.000Z'),
        updatedAt: new Date('2026-03-05T00:00:00.000Z'),
        accessRequests: [
          {
            id: 'request-1',
            clientName: 'Q1 access refresh',
            status: 'partial',
            createdAt: new Date('2026-03-08T00:00:00.000Z'),
            authorizedAt: new Date('2026-03-08T01:00:00.000Z'),
            platforms: { google: ['google_ads', 'ga4'] },
            connection: {
              id: 'connection-1',
              status: 'active',
              createdAt: new Date('2026-03-08T01:00:00.000Z'),
              grantedAssets: {
                google_ads: {
                  adAccounts: [{ id: 'acc-1', name: 'Main Account' }],
                  googleGrantLifecycle: {
                    fulfillmentMode: 'manager_link',
                    grantStatus: 'verified',
                  },
                },
              },
              authorizations: [
                {
                  platform: 'google',
                  status: 'active',
                  metadata: {},
                },
              ],
            },
          },
        ],
      } as any);

      const result = await clientService.getClientDetail({
        clientId: 'client-1',
        agencyId: 'agency-1',
      });

      expect(result?.platformGroups).toEqual([
        expect.objectContaining({
          platformGroup: 'google',
          status: 'needs_follow_up',
          fulfilledCount: 1,
          requestedCount: 2,
          latestRequestId: 'request-1',
          latestRequestName: 'Q1 access refresh',
          products: expect.arrayContaining([
            expect.objectContaining({
              product: 'google_ads',
              status: 'connected',
              googleGrantLifecycle: expect.objectContaining({
                state: 'fulfilled',
                isFulfilled: true,
              }),
            }),
            expect.objectContaining({
              product: 'ga4',
              status: 'selection_required',
              googleGrantLifecycle: expect.objectContaining({
                state: 'oauth_only_insufficient',
                isFulfilled: false,
              }),
            }),
          ]),
        }),
      ]);
    });

    it('marks revoked platform groups when the latest connection is revoked', async () => {
      vi.mocked(mockPrisma.client.findUnique).mockResolvedValue({
        id: 'client-1',
        agencyId: 'agency-1',
        name: 'Taylor Client',
        company: 'Acme',
        email: 'taylor@acme.com',
        website: null,
        language: 'en',
        createdAt: new Date('2026-03-01T00:00:00.000Z'),
        updatedAt: new Date('2026-03-05T00:00:00.000Z'),
        accessRequests: [
          {
            id: 'request-2',
            clientName: 'Meta reconnect',
            status: 'revoked',
            createdAt: new Date('2026-03-09T00:00:00.000Z'),
            authorizedAt: new Date('2026-03-09T01:00:00.000Z'),
            platforms: { meta: ['meta_ads'] },
            connection: {
              id: 'connection-2',
              status: 'revoked',
              createdAt: new Date('2026-03-09T01:00:00.000Z'),
              revokedAt: new Date('2026-03-10T00:00:00.000Z'),
              grantedAssets: null,
              authorizations: [
                {
                  platform: 'meta',
                  status: 'revoked',
                  metadata: {},
                },
              ],
            },
          },
        ],
      } as any);

      const result = await clientService.getClientDetail({
        clientId: 'client-1',
        agencyId: 'agency-1',
      });

      expect(result?.platformGroups).toEqual([
        expect.objectContaining({
          platformGroup: 'meta',
          status: 'revoked',
          fulfilledCount: 0,
          requestedCount: 1,
          products: [expect.objectContaining({ product: 'meta_ads', status: 'revoked' })],
        }),
      ]);
      // revokedAt (set by connectionService.revokeConnection) drives the "Access revoked" timeline entry.
      expect(result?.activity).toEqual(expect.arrayContaining([
        expect.objectContaining({
          type: 'connection_revoked',
          description: 'Access revoked for "Meta reconnect"',
          timestamp: new Date('2026-03-10T00:00:00.000Z'),
        }),
      ]));
    });

    it('uses the newest request for each product when records are not ordered', async () => {
      vi.mocked(mockPrisma.client.findUnique).mockResolvedValue({
        id: 'client-1',
        agencyId: 'agency-1',
        name: 'Taylor Client',
        company: 'Acme',
        email: 'taylor@acme.com',
        website: null,
        language: 'en',
        createdAt: new Date('2026-03-01T00:00:00.000Z'),
        updatedAt: new Date('2026-03-12T00:00:00.000Z'),
        accessRequests: [
          {
            id: 'request-revoked',
            clientName: 'Old Snapchat access',
            status: 'revoked',
            createdAt: new Date('2026-03-09T00:00:00.000Z'),
            authorizedAt: new Date('2026-03-09T01:00:00.000Z'),
            platforms: { snapchat: ['snapchat_ads'] },
            connection: {
              id: 'connection-revoked',
              status: 'revoked',
              createdAt: new Date('2026-03-09T01:00:00.000Z'),
              grantedAssets: null,
              authorizations: [{ platform: 'snapchat', status: 'revoked', metadata: {} }],
            },
          },
          {
            id: 'request-active',
            clientName: 'Current Snapchat access',
            status: 'partial',
            createdAt: new Date('2026-03-12T00:00:00.000Z'),
            authorizedAt: new Date('2026-03-12T01:00:00.000Z'),
            platforms: { snapchat: ['snapchat_ads'] },
            connection: {
              id: 'connection-active',
              status: 'active',
              createdAt: new Date('2026-03-12T01:00:00.000Z'),
              grantedAssets: {},
              authorizations: [{ platform: 'snapchat', status: 'active', metadata: {} }],
            },
          },
        ],
      } as any);

      const result = await clientService.getClientDetail({
        clientId: 'client-1',
        agencyId: 'agency-1',
      });

      expect(result?.platformGroups).toEqual([
        expect.objectContaining({
          platformGroup: 'snapchat',
          status: 'connected',
          latestRequestId: 'request-active',
          latestRequestName: 'Current Snapchat access',
          latestRequestedAt: new Date('2026-03-12T00:00:00.000Z'),
          products: [
            expect.objectContaining({
              product: 'snapchat_ads',
              status: 'connected',
              latestRequestId: 'request-active',
            }),
          ],
        }),
      ]);
    });

    it('marks LinkedIn Pages as no_assets when discovery completed without administered pages', async () => {
      vi.mocked(mockPrisma.client.findUnique).mockResolvedValue({
        id: 'client-1',
        agencyId: 'agency-1',
        name: 'Taylor Client',
        company: 'Acme',
        email: 'taylor@acme.com',
        website: null,
        language: 'en',
        createdAt: new Date('2026-03-01T00:00:00.000Z'),
        updatedAt: new Date('2026-03-05T00:00:00.000Z'),
        accessRequests: [
          {
            id: 'request-3',
            clientName: 'LinkedIn pages access',
            status: 'partial',
            createdAt: new Date('2026-03-10T00:00:00.000Z'),
            authorizedAt: new Date('2026-03-10T01:00:00.000Z'),
            platforms: { linkedin: ['linkedin_pages'] },
            connection: {
              id: 'connection-3',
              status: 'active',
              createdAt: new Date('2026-03-10T01:00:00.000Z'),
              grantedAssets: {
                linkedin_pages: {
                  pages: [],
                  availableAssetCount: 0,
                },
              },
              authorizations: [
                {
                  platform: 'linkedin',
                  status: 'active',
                  metadata: {},
                },
              ],
            },
          },
        ],
      } as any);

      const result = await clientService.getClientDetail({
        clientId: 'client-1',
        agencyId: 'agency-1',
      });

      expect(result?.platformGroups).toEqual([
        expect.objectContaining({
          platformGroup: 'linkedin',
          status: 'needs_follow_up',
          fulfilledCount: 0,
          requestedCount: 1,
          products: [expect.objectContaining({ product: 'linkedin_pages', status: 'no_assets' })],
        }),
      ]);
    });

    it('keeps a never-authorized non-selecting product pending', async () => {
      vi.mocked(mockPrisma.client.findUnique).mockResolvedValue({
        id: 'client-1',
        agencyId: 'agency-1',
        name: 'Taylor Client',
        company: 'Acme',
        email: 'taylor@acme.com',
        website: null,
        language: 'en',
        createdAt: new Date('2026-03-01T00:00:00.000Z'),
        updatedAt: new Date('2026-03-05T00:00:00.000Z'),
        accessRequests: [
          {
            id: 'request-4',
            clientName: 'Snapchat access',
            status: 'partial',
            createdAt: new Date('2026-03-11T00:00:00.000Z'),
            authorizedAt: null,
            platforms: { snapchat: ['snapchat_ads'] },
            connection: {
              id: 'connection-4',
              status: 'active',
              createdAt: new Date('2026-03-11T00:00:00.000Z'),
              grantedAssets: {},
              authorizations: [],
            },
          },
        ],
      } as any);

      const result = await clientService.getClientDetail({
        clientId: 'client-1',
        agencyId: 'agency-1',
      });

      expect(result?.platformGroups).toEqual([
        expect.objectContaining({
          platformGroup: 'snapchat',
          status: 'pending',
          products: [expect.objectContaining({ product: 'snapchat_ads', status: 'pending' })],
        }),
      ]);
    });

    it('does not treat pending manual evidence as connected', async () => {
      const clientData = {
        id: 'client-1',
        agencyId: 'agency-1',
        name: 'Taylor Client',
        company: 'Acme',
        email: 'taylor@acme.com',
        website: null,
        language: 'en',
        createdAt: new Date('2026-03-01T00:00:00.000Z'),
        updatedAt: new Date('2026-03-05T00:00:00.000Z'),
        accessRequests: [{
          id: 'request-manual',
          clientName: 'Beehiiv access',
          status: 'partial',
          createdAt: new Date('2026-03-11T00:00:00.000Z'),
          authorizedAt: null,
          platforms: { beehiiv: ['beehiiv'] },
          connection: {
            id: 'connection-shared',
            status: 'active',
            createdAt: new Date('2026-03-11T00:00:00.000Z'),
            grantedAssets: { beehiiv: { platform: 'beehiiv', verificationStatus: 'pending' } },
            authorizations: [{ platform: 'google', status: 'active', metadata: {} }],
          },
        }],
      };
      vi.mocked(mockPrisma.client.findUnique).mockResolvedValue(clientData as any);

      const pending = await clientService.getClientDetail({ clientId: 'client-1', agencyId: 'agency-1' });

      expect(pending?.platformGroups[0].products).toEqual([
        expect.objectContaining({ product: 'beehiiv', status: 'pending' }),
      ]);

      clientData.accessRequests[0].connection.grantedAssets.beehiiv.verificationStatus = 'verified';
      const verified = await clientService.getClientDetail({ clientId: 'client-1', agencyId: 'agency-1' });

      expect(verified?.platformGroups[0].products).toEqual([
        expect.objectContaining({ product: 'beehiiv', status: 'connected' }),
      ]);
    });

    it('marks a dead authorization as needs_reconnect instead of pending', async () => {
      vi.mocked(mockPrisma.client.findUnique).mockResolvedValue({
        id: 'client-1',
        agencyId: 'agency-1',
        name: 'Taylor Client',
        company: 'Acme',
        email: 'taylor@acme.com',
        website: null,
        language: 'en',
        createdAt: new Date('2026-03-01T00:00:00.000Z'),
        updatedAt: new Date('2026-03-05T00:00:00.000Z'),
        accessRequests: [
          {
            id: 'request-5',
            clientName: 'Snapchat access',
            status: 'partial',
            createdAt: new Date('2026-03-11T00:00:00.000Z'),
            authorizedAt: new Date('2026-03-11T01:00:00.000Z'),
            platforms: { snapchat: ['snapchat_ads'] },
            connection: {
              id: 'connection-5',
              status: 'active',
              createdAt: new Date('2026-03-11T01:00:00.000Z'),
              grantedAssets: {},
              authorizations: [
                {
                  platform: 'snapchat',
                  status: 'invalid',
                  metadata: {},
                },
              ],
            },
          },
        ],
      } as any);

      const result = await clientService.getClientDetail({
        clientId: 'client-1',
        agencyId: 'agency-1',
      });

      // The client authorized; Snap killed the grant. The surface must say so,
      // not "pending", and the group must read as agency action needed.
      expect(result?.platformGroups).toEqual([
        expect.objectContaining({
          platformGroup: 'snapchat',
          status: 'needs_follow_up',
          products: [expect.objectContaining({ product: 'snapchat_ads', status: 'needs_reconnect' })],
        }),
      ]);
    });

    it('should query a slim nested payload and omit secretId from the response', async () => {
      vi.mocked(mockPrisma.client.findUnique).mockResolvedValue({
        id: 'client-1',
        agencyId: 'agency-1',
        name: 'Taylor Client',
        company: 'Acme',
        email: 'taylor@acme.com',
        website: null,
        language: 'en',
        createdAt: new Date('2026-03-01T00:00:00.000Z'),
        updatedAt: new Date('2026-03-05T00:00:00.000Z'),
        accessRequests: [
          {
            id: 'request-slim',
            clientName: 'Meta access',
            status: 'completed',
            createdAt: new Date('2026-03-08T00:00:00.000Z'),
            authorizedAt: new Date('2026-03-08T01:00:00.000Z'),
            platforms: { meta: ['meta_ads'] },
            connection: {
              id: 'connection-slim',
              status: 'active',
              createdAt: new Date('2026-03-08T01:00:00.000Z'),
              grantedAssets: {},
              authorizations: [
                {
                  platform: 'meta_ads',
                  status: 'active',
                  metadata: {},
                },
              ],
            },
          },
        ],
      } as any);

      const result = await clientService.getClientDetail({
        clientId: 'client-1',
        agencyId: 'agency-1',
      });

      expect(mockPrisma.client.findUnique).toHaveBeenCalledWith({
        where: { id: 'client-1', agencyId: 'agency-1' },
        select: {
          id: true,
          agencyId: true,
          name: true,
          company: true,
          email: true,
          website: true,
          language: true,
          createdAt: true,
          updatedAt: true,
          accessRequests: {
            select: {
              id: true,
              clientName: true,
              status: true,
              createdAt: true,
              authorizedAt: true,
              platforms: true,
              metaAccessConfig: true,
              connection: {
                select: {
                  id: true,
                  status: true,
                  createdAt: true,
                  revokedAt: true,
                  grantedAssets: true,
                  metaAssetGrants: {
                    select: {
                      assetKind: true,
                      assetId: true,
                      status: true,
                      recipientType: true,
                      recipientId: true,
                      requestedTasks: true,
                      verifiedTasks: true,
                      verifiedAuthorizationEpoch: true,
                      authorization: { select: { authorizationEpoch: true, status: true, expiresAt: true } },
                      destination: {
                        select: {
                          businessId: true,
                          agencyConnection: { select: { status: true, businessId: true } },
                        },
                      },
                    },
                  },
                  authorizations: {
                    select: {
                      platform: true,
                      status: true,
                      metadata: true,
                      authorizationEpoch: true,
                      expiresAt: true,
                    },
                  },
                },
              },
            },
            orderBy: { createdAt: 'desc' },
          },
        },
      });
      expect(result?.client).toEqual({
        id: 'client-1',
        name: 'Taylor Client',
        company: 'Acme',
        email: 'taylor@acme.com',
        website: null,
        language: 'en',
        createdAt: new Date('2026-03-01T00:00:00.000Z'),
        updatedAt: new Date('2026-03-05T00:00:00.000Z'),
      });
      expect(result?.client).not.toHaveProperty('accessRequests');
      expect(JSON.stringify(result)).not.toMatch(/secretId|oauth_/);
    });
  });
});
