/**
 * Audit Service Unit Tests
 *
 * Tests for security audit logging functionality.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { prisma } from '@/lib/prisma';
import * as auditService from '@/services/audit.service';

// Mock Prisma
vi.mock('@/lib/prisma', () => ({
  prisma: {
    auditLog: {
      create: vi.fn(),
      findMany: vi.fn(),
      findFirst: vi.fn(),
    },
    clientConnection: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
    },
  },
}));

describe('AuditService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('logTokenAccess', () => {
    it('should log token access event', async () => {
      const mockLog = {
        id: 'log-1',
        connectionId: 'connection-1',
        platform: 'meta_ads',
        action: 'ACCESSED',
        userEmail: 'user@test.com',
        ipAddress: '192.168.1.1',
        details: {},
        createdAt: new Date(),
      };

      vi.mocked(prisma.auditLog.create).mockResolvedValue(mockLog as any);

      const result = await auditService.logTokenAccess({
        connectionId: 'connection-1',
        platform: 'meta_ads',
        userEmail: 'user@test.com',
        ipAddress: '192.168.1.1',
      });

      expect(result.error).toBeNull();
      expect(result.data).toEqual(mockLog);
      expect(prisma.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          resourceId: 'connection-1',
          resourceType: 'connection',
          action: 'ACCESSED',
          userEmail: 'user@test.com',
          ipAddress: '192.168.1.1',
          metadata: { platform: 'meta_ads' },
        }),
      });
    });

    it('should include optional details in log', async () => {
      vi.mocked(prisma.auditLog.create).mockResolvedValue({} as any);

      await auditService.logTokenAccess({
        connectionId: 'connection-1',
        platform: 'meta_ads',
        userEmail: 'user@test.com',
        ipAddress: '192.168.1.1',
        details: { reason: 'API call', endpoint: '/api/campaigns' },
      });

      expect(prisma.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          metadata: { platform: 'meta_ads', reason: 'API call', endpoint: '/api/campaigns' },
        }),
      });
    });
  });

  describe('logTokenGrant', () => {
    it('should log token grant event', async () => {
      vi.mocked(prisma.auditLog.create).mockResolvedValue({} as any);

      const result = await auditService.logTokenGrant({
        connectionId: 'connection-1',
        platform: 'google_ads',
        userEmail: 'client@test.com',
        ipAddress: '10.0.0.1',
      });

      expect(result.error).toBeNull();
      expect(prisma.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          action: 'GRANTED',
          metadata: { platform: 'google_ads' },
        }),
      });
    });
  });

  describe('logTokenRevoke', () => {
    it('should log token revoke event', async () => {
      vi.mocked(prisma.auditLog.create).mockResolvedValue({} as any);

      const result = await auditService.logTokenRevoke({
        connectionId: 'connection-1',
        platform: 'tiktok',
        userEmail: 'admin@test.com',
        ipAddress: '172.16.0.1',
        details: { reason: 'Client requested removal' },
      });

      expect(result.error).toBeNull();
      expect(prisma.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          action: 'REVOKED',
          metadata: { platform: 'tiktok', reason: 'Client requested removal' },
        }),
      });
    });

    it('scopes the revoke row to the agency when agencyId is given', async () => {
      vi.mocked(prisma.auditLog.create).mockResolvedValue({} as any);

      await auditService.logTokenRevoke({
        connectionId: 'connection-1',
        platform: 'meta',
        userEmail: 'admin@test.com',
        ipAddress: '172.16.0.1',
        agencyId: 'agency-1',
      });

      expect(prisma.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ agencyId: 'agency-1', action: 'REVOKED', resourceId: 'connection-1' }),
      });
    });
  });

  describe('logTokenRefresh', () => {
    it('should log token refresh event', async () => {
      vi.mocked(prisma.auditLog.create).mockResolvedValue({} as any);

      const result = await auditService.logTokenRefresh({
        connectionId: 'connection-1',
        platform: 'linkedin',
        userEmail: 'system@background.com',
        ipAddress: 'localhost',
        details: { method: 'automatic', expiresIn: '7 days' },
      });

      expect(result.error).toBeNull();
      expect(prisma.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          action: 'REFRESHED',
          metadata: { platform: 'linkedin', method: 'automatic', expiresIn: '7 days' },
        }),
      });
    });
  });

  describe('logFailure', () => {
    it('should log failure event', async () => {
      vi.mocked(prisma.auditLog.create).mockResolvedValue({} as any);

      const result = await auditService.logFailure({
        connectionId: 'connection-1',
        platform: 'meta_ads',
        details: {
          error: 'Token validation failed',
          code: 'INVALID_TOKEN',
          statusCode: 401,
        },
      });

      expect(result.error).toBeNull();
      expect(prisma.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          action: 'FAILED',
          metadata: {
            platform: 'meta_ads',
            error: 'Token validation failed',
            code: 'INVALID_TOKEN',
            statusCode: 401,
          },
        }),
      });
    });
  });

  describe('createAuditLog', () => {
    it('should allow repeated identical security events', async () => {
      vi.mocked(prisma.auditLog.create)
        .mockResolvedValueOnce({ id: 1n } as any)
        .mockResolvedValueOnce({ id: 2n } as any);

      const input = {
        agencyId: 'agency-1',
        userEmail: 'ops@example.com',
        action: 'TOKEN_ACCESSED',
        resourceType: 'platform_authorization',
        resourceId: 'auth-1',
        metadata: { platform: 'meta' },
      };

      const first = await auditService.createAuditLog(input);
      const second = await auditService.createAuditLog(input);

      expect(first.error).toBeNull();
      expect(second.error).toBeNull();
      expect(prisma.auditLog.create).toHaveBeenCalledTimes(2);
    });
  });

  describe('getConnectionAuditTrail', () => {
    it('should return audit trail for a connection', async () => {
      const mockLogs = [
        {
          id: 'log-1',
          action: 'GRANTED',
          platform: 'meta_ads',
          userEmail: 'client@test.com',
          ipAddress: '10.0.0.1',
          createdAt: new Date('2025-01-01T10:00:00Z'),
        },
        {
          id: 'log-2',
          action: 'ACCESSED',
          platform: 'meta_ads',
          userEmail: 'admin@test.com',
          ipAddress: '192.168.1.1',
          createdAt: new Date('2025-01-02T14:30:00Z'),
        },
        {
          id: 'log-3',
          action: 'REFRESHED',
          platform: 'meta_ads',
          userEmail: 'system@background.com',
          ipAddress: 'localhost',
          createdAt: new Date('2025-01-03T08:00:00Z'),
        },
      ];

      vi.mocked(prisma.auditLog.findMany).mockResolvedValue(mockLogs as any);

      const result = await auditService.getConnectionAuditTrail('connection-1');

      expect(result.error).toBeNull();
      expect(result.data).toEqual(mockLogs);
      expect(prisma.auditLog.findMany).toHaveBeenCalledWith({
        where: {
          resourceId: 'connection-1',
          resourceType: 'connection',
        },
        orderBy: {
          createdAt: 'desc',
        },
        take: undefined,
      });
    });

    it('should filter audit trail by platform', async () => {
      const mockLogs = [
        {
          id: 'log-1',
          action: 'ACCESSED',
          platform: 'meta_ads',
        },
      ];

      vi.mocked(prisma.auditLog.findMany).mockResolvedValue(mockLogs as any);

      const result = await auditService.getConnectionAuditTrail('connection-1', 'meta_ads');

      expect(prisma.auditLog.findMany).toHaveBeenCalledWith({
        where: {
          resourceId: 'connection-1',
          resourceType: 'connection',
          metadata: {
            path: ['platform'],
            equals: 'meta_ads',
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
        take: undefined,
      });
    });

    it('should limit results and provide pagination', async () => {
      vi.mocked(prisma.auditLog.findMany).mockResolvedValue([]);

      await auditService.getConnectionAuditTrail('connection-1', undefined, 50);

      expect(prisma.auditLog.findMany).toHaveBeenCalledWith({
        where: {
          resourceId: 'connection-1',
          resourceType: 'connection',
        },
        orderBy: {
          createdAt: 'desc',
        },
        take: 50,
      });
    });
  });

  describe('getSecurityEvents', () => {
    it('should return security events for an agency', async () => {
      const mockConnection = {
        id: 'connection-1',
        agencyId: 'agency-1',
      };

      const mockLogs = [
        {
          id: 'log-1',
          action: 'FAILED',
          connectionId: 'connection-1',
          platform: 'meta_ads',
          createdAt: new Date(),
        },
        {
          id: 'log-2',
          action: 'REVOKED',
          connectionId: 'connection-1',
          platform: 'google_ads',
          createdAt: new Date(),
        },
      ];

      vi.mocked(prisma.clientConnection.findMany).mockResolvedValue([mockConnection] as any);
      vi.mocked(prisma.auditLog.findMany).mockResolvedValue(mockLogs as any);

      const result = await auditService.getSecurityEvents('agency-1', 7);

      expect(result.error).toBeNull();
      expect(result.data).toEqual(mockLogs);
      expect(prisma.auditLog.findMany).toHaveBeenCalledWith({
        where: {
          resourceId: { in: ['connection-1'] },
          resourceType: 'connection',
          action: { in: ['FAILED', 'REVOKED'] },
          createdAt: { gte: expect.any(Date) },
        },
        orderBy: {
          createdAt: 'desc',
        },
      });
    });
  });
});
