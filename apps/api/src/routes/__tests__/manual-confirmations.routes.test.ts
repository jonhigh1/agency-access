import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import Fastify, { type FastifyInstance } from 'fastify';
import { accessRequestRoutes } from '../access-requests.js';
import { manualConfirmationService } from '@/services/manual-confirmation.service.js';
import * as accessRequestService from '@/services/access-request.service.js';
import * as authorization from '@/lib/authorization.js';

const authClaims = vi.hoisted(() => ({ sub: 'user_1', email: 'Owner@Agency.test' }));

vi.mock('@/services/manual-confirmation.service.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/services/manual-confirmation.service.js')>();
  return {
    ...actual,
    manualConfirmationService: { confirmManualAccess: vi.fn() },
  };
});
vi.mock('@/services/access-request.service.js');
vi.mock('@/services/agency-platform.service.js', () => ({ agencyPlatformService: { getConnections: vi.fn() } }));
vi.mock('@/services/access-request-reminder.service.js', () => ({ accessRequestReminderService: { sendInviteReminder: vi.fn() } }));
vi.mock('@/services/audit.service.js', () => ({ auditService: { createAuditLog: vi.fn() } }));
vi.mock('@/services/quota.service.js', () => ({
  quotaService: { checkQuota: vi.fn().mockResolvedValue({ allowed: true }) },
  QuotaExceededError: class extends Error {},
}));
vi.mock('@/lib/authorization.js');
vi.mock('@/middleware/auth.js', () => ({
  authenticate: () => async (request: any) => {
    request.user = { ...authClaims };
  },
}));

describe('POST /access-requests/:id/manual-confirmations/:platform', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    vi.resetAllMocks();
    authClaims.sub = 'user_1';
    authClaims.email = 'Owner@Agency.test';
    app = Fastify();
    await app.register(accessRequestRoutes);
    vi.mocked(authorization.resolvePrincipalAgency).mockResolvedValue({
      data: {
        agencyId: 'agency-1',
        principalId: 'user_1',
        agency: { id: 'agency-1', name: 'Agency', email: 'agency@example.com' },
      },
      error: null,
    });
    vi.mocked(authorization.assertAgencyAccess).mockReturnValue(null);
    vi.mocked(authorization.resolveAuthenticatedUserEmail).mockResolvedValue('owner@agency.test');
    vi.mocked(accessRequestService.getAccessRequestOwnershipById).mockResolvedValue({
      data: { agencyId: 'agency-1', clientName: 'Client', clientEmail: 'client@example.com' },
      error: null,
    } as any);
    vi.mocked(manualConfirmationService.confirmManualAccess).mockResolvedValue({
      data: {
        confirmation: {
          platform: 'beehiiv',
          verificationStatus: 'verified',
          verificationMethod: 'manual_review',
          verifiedAt: '2026-10-04T16:00:00.000Z',
        },
        requestStatus: 'completed',
      },
      error: null,
    });
  });

  afterEach(async () => {
    vi.unstubAllEnvs();
    await app.close();
  });

  it('uses the verified principal for the confirmation actor', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/access-requests/request-1/manual-confirmations/beehiiv',
      headers: { 'x-forwarded-for': '203.0.113.10', 'user-agent': 'test-agent' },
      payload: { confirmed: true, actorEmail: 'attacker@example.com' },
    });

    expect(response.statusCode).toBe(200);
    expect(manualConfirmationService.confirmManualAccess).toHaveBeenCalledWith(expect.objectContaining({
      accessRequestId: 'request-1',
      agencyId: 'agency-1',
      platform: 'beehiiv',
      actorId: 'user_1',
      actorEmail: 'owner@agency.test',
      userAgent: 'test-agent',
    }));
    expect(response.json().data.requestStatus).toBe('completed');
  });

  it('returns a conflict when the connection is unavailable', async () => {
    vi.mocked(manualConfirmationService.confirmManualAccess).mockResolvedValue({
      data: null, error: { code: 'MANUAL_CONNECTION_UNAVAILABLE', message: 'Connection unavailable' },
    });
    const response = await app.inject({ method: 'POST', url: '/access-requests/request-1/manual-confirmations/beehiiv', payload: { confirmed: true } });
    expect(response.statusCode).toBe(409);
    expect(response.json().error.code).toBe('MANUAL_CONNECTION_UNAVAILABLE');
  });

  it('rejects another tenant before confirmation', async () => {
    vi.mocked(authorization.assertAgencyAccess).mockReturnValue({ code: 'FORBIDDEN', message: 'Forbidden' });

    const response = await app.inject({
      method: 'POST',
      url: '/access-requests/request-1/manual-confirmations/beehiiv',
      payload: { confirmed: true },
    });

    expect(response.statusCode).toBe(403);
    expect(manualConfirmationService.confirmManualAccess).not.toHaveBeenCalled();
  });

  it.each([
    [{ confirmed: false }, 'beehiiv'],
    [{ confirmed: true }, 'google_ads'],
  ])('rejects an invalid acknowledgment or platform', async (payload, platform) => {
    const response = await app.inject({
      method: 'POST',
      url: `/access-requests/request-1/manual-confirmations/${platform}`,
      payload,
    });

    expect(response.statusCode).toBe(400);
    expect(manualConfirmationService.confirmManualAccess).not.toHaveBeenCalled();
  });

  it('rejects a non-user principal before confirmation', async () => {
    authClaims.sub = 'api_key_1';
    vi.mocked(authorization.resolvePrincipalAgency).mockResolvedValue({
      data: {
        agencyId: 'agency-1',
        principalId: 'api_key_1',
        agency: { id: 'agency-1', name: 'Agency', email: 'agency@example.com' },
      },
      error: null,
    });

    const response = await app.inject({
      method: 'POST',
      url: '/access-requests/request-1/manual-confirmations/beehiiv',
      payload: { confirmed: true },
    });

    expect(response.statusCode).toBe(403);
    expect(response.json().error.code).toBe('AGENCY_USER_REQUIRED');
    expect(manualConfirmationService.confirmManualAccess).not.toHaveBeenCalled();
  });

  it('accepts the exact development bypass user only in development', async () => {
    vi.stubEnv('NODE_ENV', 'development');
    authClaims.sub = 'dev_user_test_123456789';

    const response = await app.inject({
      method: 'POST',
      url: '/access-requests/request-1/manual-confirmations/beehiiv',
      payload: { confirmed: true },
    });

    expect(response.statusCode).toBe(200);
    expect(manualConfirmationService.confirmManualAccess).toHaveBeenCalledWith(
      expect.objectContaining({ actorId: 'dev_user_test_123456789' })
    );
  });
});
