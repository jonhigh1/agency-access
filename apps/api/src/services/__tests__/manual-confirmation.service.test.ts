import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const tx = vi.hoisted(() => ({
  $queryRaw: vi.fn(),
  clientConnection: { update: vi.fn() },
  auditLog: { create: vi.fn() },
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    $transaction: vi.fn(),
  },
}));

vi.mock('@/services/access-request.service', () => ({
  accessRequestService: {
    markRequestAuthorized: vi.fn(),
  },
}));

import { prisma } from '@/lib/prisma';
import { accessRequestService } from '@/services/access-request.service';
import {
  isManualConfirmationActorId,
  manualConfirmationService,
} from '../manual-confirmation.service.js';

const future = new Date('2027-01-01T00:00:00.000Z');

function pendingRequest(platforms: unknown = [{ platform: 'beehiiv', accessLevel: 'manage' }]) {
  return {
    id: 'request-1',
    agencyId: 'agency-1',
    status: 'partial',
    expiresAt: future,
    platforms,
  };
}

describe('manualConfirmationService', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-04T16:00:00.000Z'));
    vi.mocked(prisma.$transaction).mockImplementation(async (callback: any) => callback(tx));
    tx.$queryRaw
      .mockResolvedValueOnce([{
        id: 'request-1',
        status: 'partial',
        expires_at: future,
        platforms: [{ platform: 'beehiiv', accessLevel: 'manage' }],
      }])
      .mockResolvedValueOnce([{
        id: 'connection-1',
        status: 'pending_verification',
        granted_assets: {
          beehiiv: {
            platform: 'beehiiv',
            verificationStatus: 'pending',
            agencyEmail: 'access@agency.test',
          },
          shopify: { platform: 'shopify', verificationStatus: 'pending', shopDomain: 'store.myshopify.com' },
        },
      }]);
    tx.clientConnection.update.mockResolvedValue({ id: 'connection-1' });
    tx.auditLog.create.mockResolvedValue({ id: 1n });
    vi.mocked(accessRequestService.markRequestAuthorized).mockResolvedValue({
      data: { id: 'request-1', status: 'partial' },
      error: null,
    } as any);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('locks the connection, preserves evidence and siblings, audits, and recomputes progress', async () => {
    const result = await manualConfirmationService.confirmManualAccess({
      accessRequestId: 'request-1',
      agencyId: 'agency-1',
      platform: 'beehiiv',
      actorId: 'user_1',
      actorEmail: 'owner@agency.test',
      ipAddress: '203.0.113.10',
      userAgent: 'test-agent',
    });

    expect(result).toEqual({
      data: {
        confirmation: {
          platform: 'beehiiv',
          verificationStatus: 'verified',
          verificationMethod: 'manual_review',
          verifiedAt: '2026-10-04T16:00:00.000Z',
        },
        requestStatus: 'partial',
      },
      error: null,
    });
    expect(tx.$queryRaw).toHaveBeenCalledTimes(2);
    expect(tx.clientConnection.update).toHaveBeenCalledWith({
      where: { id: 'connection-1' },
      data: {
        status: 'active',
        grantedAssets: {
          beehiiv: {
            platform: 'beehiiv',
            verificationStatus: 'verified',
            agencyEmail: 'access@agency.test',
            verificationMethod: 'manual_review',
            verifiedAt: '2026-10-04T16:00:00.000Z',
            verifiedBy: 'user_1',
          },
          shopify: { platform: 'shopify', verificationStatus: 'pending', shopDomain: 'store.myshopify.com' },
        },
      },
    });
    expect(tx.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        agencyId: 'agency-1',
        userEmail: 'owner@agency.test',
        action: 'MANUAL_ACCESS_CONFIRMED',
        resourceType: 'client_connection',
        resourceId: 'connection-1',
        actorType: 'agency_user',
        actorId: 'user_1',
        ipAddress: '203.0.113.10',
      }),
    });
    expect(accessRequestService.markRequestAuthorized).toHaveBeenCalledWith('request-1');
  });

  it('is idempotent after verification and does not duplicate the audit', async () => {
    tx.$queryRaw
      .mockReset()
      .mockResolvedValueOnce([{
        id: 'request-1',
        status: 'partial',
        expires_at: future,
        platforms: [{ platform: 'beehiiv', accessLevel: 'manage' }],
      }])
      .mockResolvedValueOnce([{
        id: 'connection-1',
        granted_assets: {
          beehiiv: {
            platform: 'beehiiv',
            verificationStatus: 'verified',
            verificationMethod: 'manual_review',
            verifiedAt: '2026-10-03T12:00:00.000Z',
            verifiedBy: 'user_1',
          },
        },
      }]);

    const result = await manualConfirmationService.confirmManualAccess({
      accessRequestId: 'request-1',
      agencyId: 'agency-1',
      platform: 'beehiiv',
      actorId: 'user_1',
      actorEmail: 'owner@agency.test',
      ipAddress: '203.0.113.10',
      userAgent: 'test-agent',
    });

    expect(result.data?.confirmation.verifiedAt).toBe('2026-10-03T12:00:00.000Z');
    expect(tx.clientConnection.update).not.toHaveBeenCalled();
    expect(tx.auditLog.create).not.toHaveBeenCalled();
    expect(accessRequestService.markRequestAuthorized).toHaveBeenCalledWith('request-1');
  });

  it('rejects a non-user actor before opening a transaction', async () => {
    const result = await manualConfirmationService.confirmManualAccess({
      accessRequestId: 'request-1',
      agencyId: 'agency-1',
      platform: 'beehiiv',
      actorId: 'api_key_1',
      actorEmail: 'owner@agency.test',
      ipAddress: '203.0.113.10',
      userAgent: 'test-agent',
    });

    expect(result).toMatchObject({ data: null, error: { code: 'AGENCY_USER_REQUIRED' } });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('allows only the exact development bypass actor in development', () => {
    vi.stubEnv('NODE_ENV', 'development');
    expect(isManualConfirmationActorId('dev_user_test_123456789')).toBe(true);
    expect(isManualConfirmationActorId('dev_user_other')).toBe(false);
    vi.stubEnv('NODE_ENV', 'production');
    expect(isManualConfirmationActorId('dev_user_test_123456789')).toBe(false);
  });

  it.each([
    ['another tenant', null, 'NOT_FOUND'],
    ['an unrequested platform', pendingRequest([{ platform: 'shopify', accessLevel: 'manage' }]), 'PLATFORM_NOT_REQUESTED'],
    ['a revoked request', { ...pendingRequest(), status: 'revoked' }, 'REQUEST_REVOKED'],
    ['an expired request', { ...pendingRequest(), expiresAt: new Date('2026-10-03T00:00:00.000Z') }, 'REQUEST_EXPIRED'],
  ])('rejects %s', async (_label, requestRow, code) => {
    tx.$queryRaw.mockReset().mockResolvedValueOnce(requestRow ? [{
      id: requestRow.id,
      status: requestRow.status,
      expires_at: requestRow.expiresAt,
      platforms: requestRow.platforms,
    }] : []);

    const result = await manualConfirmationService.confirmManualAccess({
      accessRequestId: 'request-1',
      agencyId: 'agency-1',
      platform: 'beehiiv',
      actorId: 'user_1',
      actorEmail: 'owner@agency.test',
      ipAddress: '203.0.113.10',
      userAgent: 'test-agent',
    });

    expect(result).toMatchObject({ data: null, error: { code } });
    expect(tx.clientConnection.update).not.toHaveBeenCalled();
    expect(tx.auditLog.create).not.toHaveBeenCalled();
  });

  it.each(['revoked', 'expired'])('rejects a %s connection without confirming its evidence', async (status) => {
    tx.$queryRaw.mockReset()
      .mockResolvedValueOnce([{ id: 'request-1', status: 'partial', expires_at: future, platforms: [{ platform: 'beehiiv' }] }])
      .mockResolvedValueOnce([{ id: 'connection-1', status, granted_assets: { beehiiv: { platform: 'beehiiv', verificationStatus: 'pending' } } }]);
    const result = await manualConfirmationService.confirmManualAccess({
      accessRequestId: 'request-1', agencyId: 'agency-1', platform: 'beehiiv', actorId: 'user_1',
      actorEmail: 'owner@agency.test', ipAddress: '127.0.0.1', userAgent: 'test-agent',
    });
    expect(result).toMatchObject({ data: null, error: { code: 'MANUAL_CONNECTION_UNAVAILABLE' } });
    expect(tx.clientConnection.update).not.toHaveBeenCalled();
    expect(tx.auditLog.create).not.toHaveBeenCalled();
  });

  it('rejects a connection without matching pending evidence', async () => {
    tx.$queryRaw
      .mockReset()
      .mockResolvedValueOnce([{
        id: 'request-1',
        status: 'partial',
        expires_at: future,
        platforms: [{ platform: 'beehiiv', accessLevel: 'manage' }],
      }])
      .mockResolvedValueOnce([{
        id: 'connection-1',
        granted_assets: { shopify: { platform: 'shopify', verificationStatus: 'pending' } },
      }]);

    const result = await manualConfirmationService.confirmManualAccess({
      accessRequestId: 'request-1',
      agencyId: 'agency-1',
      platform: 'beehiiv',
      actorId: 'user_1',
      actorEmail: 'owner@agency.test',
      ipAddress: '203.0.113.10',
      userAgent: 'test-agent',
    });

    expect(result).toMatchObject({ data: null, error: { code: 'MANUAL_EVIDENCE_NOT_FOUND' } });
    expect(tx.clientConnection.update).not.toHaveBeenCalled();
  });
});
