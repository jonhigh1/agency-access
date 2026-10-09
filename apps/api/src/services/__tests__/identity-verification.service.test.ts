/**
 * Tests for IdentityVerificationService
 *
 * TDD approach: Write failing tests first, then implement.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  IDENTITY_VERIFICATION_PLATFORMS,
  identityVerificationService,
} from '../identity-verification.service.js';

// Mock prisma with factory function to avoid hoisting issues
vi.mock('@/lib/prisma', () => ({
  prisma: {
    agency: {
      findUnique: vi.fn(),
    },
    agencyPlatformConnection: {
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    auditLog: {
      create: vi.fn(),
    },
  },
}));

// Get mock reference for assertions
const getAuditLogMock = async () => {
  const { prisma } = await import('@/lib/prisma');
  return prisma.auditLog.create as any;
};

describe('IdentityVerificationService', () => {
  describe('validateIdentity', () => {
    it('should validate a correct Google agency email', async () => {
      const result = await identityVerificationService.validateIdentity({
        platform: 'google',
        agencyEmail: 'agency@example.com',
      });

      expect(result.error).toBeNull();
      expect(result.data).toEqual({
        valid: true,
        normalizedEmail: 'agency@example.com',
      });
    });

    it('should validate a correct Meta Business ID', async () => {
      const result = await identityVerificationService.validateIdentity({
        platform: 'meta',
        businessId: '123456789012345',
      });

      expect(result.error).toBeNull();
      expect(result.data).toEqual({
        valid: true,
        normalizedBusinessId: '123456789012345',
      });
    });

    it('should reject invalid email format', async () => {
      const result = await identityVerificationService.validateIdentity({
        platform: 'google',
        agencyEmail: 'not-an-email',
      });

      expect(result.data).toBeNull();
      expect(result.error?.code).toBe('VALIDATION_ERROR');
      // Zod catches email validation first
      expect(result.error?.message).toBe('Invalid input data');
    });

    it('should reject Meta Business ID with fewer than 15 digits', async () => {
      const result = await identityVerificationService.validateIdentity({
        platform: 'meta',
        businessId: '12345',
      });

      expect(result.data).toBeNull();
      expect(result.error).toEqual({
        code: 'VALIDATION_ERROR',
        message: 'Business ID must be at least 15 digits',
      });
    });

    it('should normalize email to lowercase', async () => {
      const result = await identityVerificationService.validateIdentity({
        platform: 'google',
        agencyEmail: 'AgEncY@ExAmPlE.cOm',
      });

      expect(result.error).toBeNull();
      expect(result.data?.normalizedEmail).toBe('agency@example.com');
    });

    it('should reject missing required fields for Google', async () => {
      const result = await identityVerificationService.validateIdentity({
        platform: 'google',
      });

      expect(result.data).toBeNull();
      expect(result.error).toEqual({
        code: 'VALIDATION_ERROR',
        message: 'Agency email is required for GOOGLE platform',
      });
    });

    it('should reject missing required fields for Meta', async () => {
      const result = await identityVerificationService.validateIdentity({
        platform: 'meta',
      });

      expect(result.data).toBeNull();
      expect(result.error).toEqual({
        code: 'VALIDATION_ERROR',
        message: 'Business ID is required for Meta platform',
      });
    });
  });

  describe('checkIdentityUniqueness', () => {
    it('should return true when identity is unique', async () => {
      const { prisma } = await import('@/lib/prisma');
      (prisma.agencyPlatformConnection.findFirst as any).mockResolvedValue(null);

      const result = await identityVerificationService.checkIdentityUniqueness(
        'agency-123',
        'google',
        'agency@example.com'
      );

      expect(result.error).toBeNull();
      expect(result.data).toBe(true);
    });

    it('should return false when identity already exists', async () => {
      const { prisma } = await import('@/lib/prisma');
      (prisma.agencyPlatformConnection.findFirst as any).mockResolvedValue({
        id: 'existing-connection',
      });

      const result = await identityVerificationService.checkIdentityUniqueness(
        'agency-123',
        'google',
        'agency@example.com'
      );

      expect(result.error).toBeNull();
      expect(result.data).toBe(false);
    });
  });

  describe('createIdentityConnection', () => {
    const mockAgencyId = 'agency-123';
    const mockConnectedBy = 'user@example.com';

    beforeEach(() => {
      vi.clearAllMocks();
    });

    it('should create a Google identity connection', async () => {
      const { prisma } = await import('@/lib/prisma');
      (prisma.agency.findUnique as any).mockResolvedValue({ id: mockAgencyId });
      (prisma.agencyPlatformConnection.findFirst as any).mockResolvedValue(null);
      (prisma.agencyPlatformConnection.create as any).mockResolvedValue({
        id: 'connection-123',
        platform: 'google',
        connectionMode: 'identity',
        agencyEmail: 'agency@example.com',
        verificationStatus: 'pending',
      });
      const auditLogCreate = await getAuditLogMock();
      auditLogCreate.mockResolvedValue({});

      const result = await identityVerificationService.createIdentityConnection({
        agencyId: mockAgencyId,
        platform: 'google',
        agencyEmail: 'agency@example.com',
        connectedBy: mockConnectedBy,
      });

      expect(result.error).toBeNull();
      expect(result.data).toMatchObject({
        id: 'connection-123',
        platform: 'google',
        connectionMode: 'identity',
        agencyEmail: 'agency@example.com',
        verificationStatus: 'pending',
      });
    });

    it('should create a Meta identity connection', async () => {
      const { prisma } = await import('@/lib/prisma');
      (prisma.agency.findUnique as any).mockResolvedValue({ id: mockAgencyId });
      (prisma.agencyPlatformConnection.findFirst as any).mockResolvedValue(null);
      (prisma.agencyPlatformConnection.create as any).mockResolvedValue({
        id: 'connection-123',
        platform: 'meta',
        connectionMode: 'identity',
        businessId: '123456789012345',
        verificationStatus: 'pending',
      });
      const auditLogCreate = await getAuditLogMock();
      auditLogCreate.mockResolvedValue({});

      const result = await identityVerificationService.createIdentityConnection({
        agencyId: mockAgencyId,
        platform: 'meta',
        businessId: '123456789012345',
        connectedBy: mockConnectedBy,
      });

      expect(result.error).toBeNull();
      expect(result.data).toMatchObject({
        id: 'connection-123',
        platform: 'meta',
        connectionMode: 'identity',
        businessId: '123456789012345',
        verificationStatus: 'pending',
      });
    });

    it('should reject duplicate platform connections', async () => {
      const { prisma } = await import('@/lib/prisma');
      (prisma.agencyPlatformConnection.findFirst as any).mockResolvedValue({
        id: 'existing-connection',
      });

      const result = await identityVerificationService.createIdentityConnection({
        agencyId: mockAgencyId,
        platform: 'google',
        agencyEmail: 'agency@example.com',
        connectedBy: mockConnectedBy,
      });

      expect(result.data).toBeNull();
      expect(result.error).toEqual({
        code: 'PLATFORM_ALREADY_CONNECTED',
        message: 'Platform is already connected for this agency',
      });
    });

    it('should reject non-existent agency', async () => {
      const { prisma } = await import('@/lib/prisma');
      (prisma.agency.findUnique as any).mockResolvedValue(null);

      const result = await identityVerificationService.createIdentityConnection({
        agencyId: 'non-existent',
        platform: 'google',
        agencyEmail: 'agency@example.com',
        connectedBy: mockConnectedBy,
      });

      expect(result.data).toBeNull();
      expect(result.error).toEqual({
        code: 'AGENCY_NOT_FOUND',
        message: 'Agency not found',
      });
    });

    it('should create audit log entry', async () => {
      const { prisma } = await import('@/lib/prisma');
      (prisma.agency.findUnique as any).mockResolvedValue({ id: mockAgencyId });
      (prisma.agencyPlatformConnection.findFirst as any).mockResolvedValue(null);
      (prisma.agencyPlatformConnection.create as any).mockResolvedValue({
        id: 'connection-123',
      });
      const auditLogCreate = await getAuditLogMock();
      auditLogCreate.mockResolvedValue({});

      await identityVerificationService.createIdentityConnection({
        agencyId: mockAgencyId,
        platform: 'google',
        agencyEmail: 'agency@example.com',
        connectedBy: mockConnectedBy,
      });

      expect(auditLogCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({
          action: 'AGENCY_IDENTITY_ADDED',
          agencyId: mockAgencyId,
          userEmail: mockConnectedBy,
          metadata: expect.objectContaining({
            platform: 'google',
            connectionMode: 'identity',
          }),
        }),
      });
    });
  });
});

// GOLDEN — regenerate only via:
//   npx tsx scripts/generate-platform-registry-golden.ts --acknowledge=DEC-015
// Provenance: DEC-015 (docs/DECISIONS.md), 2026-10-08. Frozen literals; NEVER snapshots.
describe('identity verification platform list', () => {
  it('accepts exactly the six identity-mode platforms, characterized verbatim (DEC-015)', () => {
    expect([...IDENTITY_VERIFICATION_PLATFORMS]).toEqual([
      'google',
      'meta',
      'meta_ads',
      'google_ads',
      'ga4',
      'linkedin',
    ]);
  });
});
