import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import Fastify, { FastifyInstance } from 'fastify';
import { agencyRoutes } from '../agencies.js';
import { agencyService } from '../../services/agency.service.js';
import * as authorization from '../../lib/authorization.js';

vi.mock('../../lib/authorization.js');
vi.mock('../../services/agency.service.js', () => ({
  agencyService: {
    getAgencyByEmail: vi.fn(),
    listAgencies: vi.fn(),
    getAgency: vi.fn(),
    createAgency: vi.fn(),
    createAgencyWithCheckout: vi.fn(),
    updateAgency: vi.fn(),
    getAgencyMembers: vi.fn(),
    inviteMember: vi.fn(),
    bulkInviteMembers: vi.fn(),
    getOnboardingStatus: vi.fn(),
    updateOnboardingProgress: vi.fn(),
    updateMemberRole: vi.fn(),
    removeMember: vi.fn(),
    updateMemberRoleForAgency: vi.fn(),
    removeMemberForAgency: vi.fn(),
  },
}));
vi.mock('../../middleware/auth.js', () => ({
  authenticate: () => async (request: any, reply: any) => {
    if (!request.headers.authorization) {
      return reply.code(401).send({
        data: null,
        error: { code: 'UNAUTHORIZED', message: 'Missing token' },
      });
    }
    request.user = { sub: 'user_123' };
  },
}));
vi.mock('../../middleware/quota-enforcement.js', () => ({
  quotaEnforcementMiddleware: () => async () => {},
}));

describe('Agency Routes - Security', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    app = Fastify();
    await app.register(agencyRoutes);
    vi.clearAllMocks();

    vi.mocked(authorization.resolvePrincipalAgency).mockResolvedValue({
      data: {
        agencyId: 'agency-owner',
        principalId: 'user_123',
        agency: {
          id: 'agency-owner',
          name: 'Owner Agency',
          email: 'owner@example.com',
        },
      },
      error: null,
    });

    vi.mocked(authorization.assertAgencyAccess).mockImplementation((requested, principal) => {
      if (requested !== principal) {
        return {
          code: 'FORBIDDEN',
          message: 'You do not have access to this agency resource',
        };
      }

      return null;
    });
  });

  afterEach(async () => {
    await app.close();
  });

  it('returns 403 when /agencies clerkUserId filter does not match principal', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/agencies?clerkUserId=user_other',
      headers: { authorization: 'Bearer token' },
    });

    expect(response.statusCode).toBe(403);
    expect(response.json().error.code).toBe('FORBIDDEN');
    expect(agencyService.listAgencies).not.toHaveBeenCalled();
  });

  it('allows /agencies clerkUserId lookup for principal even when no agency exists yet', async () => {
    vi.mocked(agencyService.listAgencies).mockResolvedValue({ data: [], error: null } as any);

    const response = await app.inject({
      method: 'GET',
      url: '/agencies?clerkUserId=user_123',
      headers: { authorization: 'Bearer token' },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ data: [], error: null });
    expect(agencyService.listAgencies).toHaveBeenCalledWith(
      { clerkUserId: 'user_123', email: undefined },
      true
    );
  });

  it('returns the principal agency directly for self clerkUserId lookups without members', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/agencies?clerkUserId=user_123&fields=id,name,email,clerkUserId',
      headers: { authorization: 'Bearer token' },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      data: [
        {
          id: 'agency-owner',
          name: 'Owner Agency',
          email: 'owner@example.com',
          clerkUserId: 'user_123',
          analyticsInternal: false,
        },
      ],
      error: null,
    });
    expect(agencyService.listAgencies).not.toHaveBeenCalled();
  });

  it('returns 403 when /agencies email filter does not match principal agency email', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/agencies?email=other@example.com',
      headers: { authorization: 'Bearer token' },
    });

    expect(response.statusCode).toBe(403);
    expect(response.json().error.code).toBe('FORBIDDEN');
    expect(agencyService.listAgencies).not.toHaveBeenCalled();
  });

  it('returns 403 when /agencies/by-email requests non-principal email', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/agencies/by-email?email=other@example.com',
      headers: { authorization: 'Bearer token' },
    });

    expect(response.statusCode).toBe(403);
    expect(response.json().error.code).toBe('FORBIDDEN');
    expect(agencyService.getAgencyByEmail).not.toHaveBeenCalled();
  });

  it('returns 403 when /agencies/:id targets a different agency', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/agencies/agency-other',
      headers: { authorization: 'Bearer token' },
    });

    expect(response.statusCode).toBe(403);
    expect(response.json().error.code).toBe('FORBIDDEN');
    expect(agencyService.getAgency).not.toHaveBeenCalled();
  });

  it('returns 403 when patching a different agency', async () => {
    const response = await app.inject({
      method: 'PATCH',
      url: '/agencies/agency-other',
      headers: { authorization: 'Bearer token' },
      payload: { name: 'Updated' },
    });

    expect(response.statusCode).toBe(403);
    expect(response.json().error.code).toBe('FORBIDDEN');
    expect(agencyService.updateAgency).not.toHaveBeenCalled();
  });

  it('returns 403 when requesting members for a different agency', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/agencies/agency-other/members',
      headers: { authorization: 'Bearer token' },
    });

    expect(response.statusCode).toBe(403);
    expect(response.json().error.code).toBe('FORBIDDEN');
    expect(agencyService.getAgencyMembers).not.toHaveBeenCalled();
  });

  it('returns 403 when bulk-inviting members for a different agency', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/agencies/agency-other/members/bulk',
      headers: { authorization: 'Bearer token' },
      payload: { members: [{ email: 'a@example.com', role: 'member' }] },
    });

    expect(response.statusCode).toBe(403);
    expect(response.json().error.code).toBe('FORBIDDEN');
    expect(agencyService.bulkInviteMembers).not.toHaveBeenCalled();
  });

  it('returns 403 when reading onboarding status for a different agency', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/agencies/agency-other/onboarding-status',
      headers: { authorization: 'Bearer token' },
    });

    expect(response.statusCode).toBe(403);
    expect(response.json().error.code).toBe('FORBIDDEN');
    expect(agencyService.getOnboardingStatus).not.toHaveBeenCalled();
  });

  it('returns 403 when updating onboarding progress for a different agency', async () => {
    const response = await app.inject({
      method: 'PATCH',
      url: '/agencies/agency-other/onboarding-progress',
      headers: { authorization: 'Bearer token' },
      payload: {
        status: 'in_progress',
      },
    });

    expect(response.statusCode).toBe(403);
    expect(response.json().error.code).toBe('FORBIDDEN');
    expect(agencyService.updateOnboardingProgress).not.toHaveBeenCalled();
  });

  it('returns 403 when create agency payload clerkUserId mismatches principal', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/agencies',
      headers: { authorization: 'Bearer token' },
      payload: {
        clerkUserId: 'user_other',
        name: 'Agency',
        email: 'owner@example.com',
      },
    });

    expect(response.statusCode).toBe(403);
    expect(response.json().error.code).toBe('FORBIDDEN');
    expect(agencyService.createAgency).not.toHaveBeenCalled();
  });

  it('returns 403 when signup-checkout payload clerkUserId mismatches principal', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/agencies/signup-checkout',
      headers: { authorization: 'Bearer token' },
      payload: {
        clerkUserId: 'user_other',
        name: 'Agency',
        email: 'owner@example.com',
        selectedTier: 'STARTER',
        billingInterval: 'monthly',
      },
    });

    expect(response.statusCode).toBe(403);
    expect(response.json().error.code).toBe('FORBIDDEN');
    expect(agencyService.createAgencyWithCheckout).not.toHaveBeenCalled();
  });

  it('returns 403 when scoped member role update fails ownership check', async () => {
    vi.mocked(agencyService.updateMemberRoleForAgency).mockResolvedValue({
      data: null,
      error: {
        code: 'FORBIDDEN',
        message: 'You do not have access to this agency resource',
      },
    } as any);

    const response = await app.inject({
      method: 'PATCH',
      url: '/members/member-1',
      headers: { authorization: 'Bearer token' },
      payload: { role: 'member' },
    });

    expect(response.statusCode).toBe(403);
    expect(response.json().error.code).toBe('FORBIDDEN');
  });

  it('returns 403 when scoped member deletion fails ownership check', async () => {
    vi.mocked(agencyService.removeMemberForAgency).mockResolvedValue({
      data: null,
      error: {
        code: 'FORBIDDEN',
        message: 'You do not have access to this agency resource',
      },
    } as any);

    const response = await app.inject({
      method: 'DELETE',
      url: '/members/member-1',
      headers: { authorization: 'Bearer token' },
    });

    expect(response.statusCode).toBe(403);
    expect(response.json().error.code).toBe('FORBIDDEN');
  });
});
