/**
 * Client Service Tests
 *
 * Test-Driven Development for Phase 5 Client Management
 * Following Red-Green-Refactor cycle
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { prisma } from '@/lib/prisma';
import * as clientService from '@/services/client.service';
import { infisical } from '@/lib/infisical';

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
  },
}));

vi.mock('@/lib/infisical', () => ({
  infisical: { deleteSecret: vi.fn() },
}));

const mockPrisma = vi.mocked(prisma);

describe('Phase 5: Client Service - TDD Tests', () => {
  beforeEach(() => {
    vi.resetAllMocks();
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

    it('should fail closed when secret deletion fails', async () => {
      vi.mocked(mockPrisma.client.findUnique).mockResolvedValue({
        id: 'client-1',
        agencyId: 'agency-1',
        accessRequests: [{
          connection: { authorizations: [{ secretId: 'secret-1' }] },
        }],
      } as any);
      vi.mocked(infisical.deleteSecret).mockRejectedValue(new Error('Infisical unavailable'));

      await expect(clientService.deleteClient('client-1', 'agency-1')).rejects.toThrow('Infisical unavailable');
      expect(mockPrisma.client.delete).not.toHaveBeenCalled();
    });
  });

  describe('getClientDetail', () => {
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
  });
});
