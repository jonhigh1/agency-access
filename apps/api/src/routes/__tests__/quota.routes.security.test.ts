import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import Fastify, { type FastifyInstance } from 'fastify';
import { quotaRoutes } from '@/routes/quota.routes';
import { quotaService } from '@/services/quota.service';
import { resolvePrincipalAgency } from '@/lib/authorization';
import { verifyToken } from '@clerk/backend';

vi.mock('@/services/quota.service', () => ({
  quotaService: { getUsage: vi.fn(), checkQuota: vi.fn() },
}));
vi.mock('@/lib/authorization', () => ({ resolvePrincipalAgency: vi.fn() }));
vi.mock('@clerk/backend', () => ({ verifyToken: vi.fn() }));

const headers = { authorization: 'Bearer valid-token' };

describe('quota routes - principal ownership and validation', () => {
  let app: FastifyInstance;
  beforeEach(async () => {
    vi.resetAllMocks();
    vi.mocked(verifyToken).mockResolvedValue({ orgId: 'org-1', sub: 'user-1' } as any);
    vi.mocked(resolvePrincipalAgency).mockResolvedValue({
      data: { agencyId: 'agency-uuid', principalId: 'org-1', agency: { id: 'agency-uuid', name: 'Fixture', email: 'owner@fixture.invalid' } },
      error: null,
    });
    vi.mocked(quotaService.getUsage).mockResolvedValue({ currentTier: 'SCALE' } as any);
    vi.mocked(quotaService.checkQuota).mockResolvedValue({ allowed: true } as any);
    app = Fastify();
    await app.register(quotaRoutes);
  });
  afterEach(async () => { await app.close(); });

  it.each(['GET', 'POST'] as const)('rejects missing credentials on %s without querying quota', async (method) => {
    const response = await app.inject({ method, url: method === 'GET' ? '/api/quota' : '/api/quota/check', ...(method === 'POST' ? { payload: { metric: 'clients' } } : {}) });
    expect(response.statusCode).toBe(401);
    expect(response.json().error.code).toBe('UNAUTHORIZED');
    expect(quotaService.getUsage).not.toHaveBeenCalled();
    expect(quotaService.checkQuota).not.toHaveBeenCalled();
  });

  it('uses the resolved internal agency ID, not the Clerk organization ID or supplied query', async () => {
    const response = await app.inject({ method: 'GET', url: '/api/quota?agencyId=other-agency', headers });
    expect(response.statusCode).toBe(200);
    expect(response.json().data.currentTier).toBe('SCALE');
    expect(quotaService.getUsage).toHaveBeenCalledWith('agency-uuid');
    expect(resolvePrincipalAgency).toHaveBeenCalledOnce();
  });

  it('supports a verified personal account without an organization', async () => {
    vi.mocked(verifyToken).mockResolvedValue({ sub: 'user-personal' } as any);
    const response = await app.inject({ method: 'GET', url: '/api/quota', headers });
    expect(response.statusCode).toBe(200);
    expect(quotaService.getUsage).toHaveBeenCalledWith('agency-uuid');
  });

  it('checks quota against the resolved agency with a validated amount', async () => {
    const response = await app.inject({ method: 'POST', url: '/api/quota/check', headers, payload: { metric: 'clients', requestedAmount: 2, agencyId: 'other-agency' } });
    expect(response.statusCode).toBe(200);
    expect(quotaService.checkQuota).toHaveBeenCalledWith({ agencyId: 'agency-uuid', metric: 'clients', action: 'create', requestedAmount: 2 });
  });

  it.each([null, 'reject'] as const)('returns an authentication error when token verification yields %s', async (outcome) => {
    if (outcome === 'reject') vi.mocked(verifyToken).mockRejectedValue(new Error('Invalid token'));
    else vi.mocked(verifyToken).mockResolvedValue(null as any);
    const response = await app.inject({ method: 'GET', url: '/api/quota', headers });
    expect(response.statusCode).toBe(401);
    expect(response.json().error.code).toBe('UNAUTHORIZED');
    expect(resolvePrincipalAgency).not.toHaveBeenCalled();
    expect(quotaService.getUsage).not.toHaveBeenCalled();
  });

  it('rejects a principal whose agency cannot be resolved', async () => {
    vi.mocked(resolvePrincipalAgency).mockResolvedValue({ data: null, error: { code: 'FORBIDDEN', message: 'Agency unavailable' } });
    const response = await app.inject({ method: 'GET', url: '/api/quota', headers });
    expect(response.statusCode).toBe(403);
    expect(quotaService.getUsage).not.toHaveBeenCalled();
  });

  it.each([undefined, {}, { metric: 'unknown' }, { metric: 'clients', requestedAmount: -1 }, { metric: 'clients', requestedAmount: 0 }, { metric: 'clients', requestedAmount: 1.5 }])('rejects invalid quota input before checking usage: %j', async (payload) => {
    const response = await app.inject({ method: 'POST', url: '/api/quota/check', headers, payload });
    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe('VALIDATION_ERROR');
    expect(quotaService.checkQuota).not.toHaveBeenCalled();
  });

  it('reports missing persisted agency usage honestly', async () => {
    vi.mocked(quotaService.getUsage).mockResolvedValue(null);
    const response = await app.inject({ method: 'GET', url: '/api/quota', headers });
    expect(response.statusCode).toBe(404);
    expect(response.json().error.code).toBe('NOT_FOUND');
  });
});
