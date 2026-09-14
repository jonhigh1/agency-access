import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import Fastify, { type FastifyInstance } from 'fastify';
import { registerIntakeRoutes } from '../intake.routes.js';
import { prisma } from '@/lib/prisma.js';

vi.mock('@/lib/prisma.js', () => ({
  prisma: { accessRequest: { findUnique: vi.fn(), update: vi.fn() } },
}));

describe('Client intake routes', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    vi.resetAllMocks();
    app = Fastify();
    await registerIntakeRoutes(app);
    // The route reads narrowly: id, fields, and expiry only.
    vi.mocked(prisma.accessRequest.findUnique).mockResolvedValue({
      id: 'request-1',
      intakeFields: [
        { id: 'company', label: 'Company name', type: 'text', required: true },
        { id: 'size', label: 'Company size', type: 'dropdown', required: false, options: ['1-10', '11-50'] },
      ],
      expiresAt: new Date(Date.now() + 60_000),
    } as any);
  });

  afterEach(async () => {
    await app.close();
  });

  it('stores configured intake answers and returns the saved readback', async () => {
    vi.mocked(prisma.accessRequest.update).mockResolvedValue({
      intakeResponses: { company: 'Acme', size: '11-50' },
    } as any);

    const response = await app.inject({
      method: 'POST',
      url: '/client/token-1/intake',
      payload: { intakeResponses: { company: 'Acme', size: '11-50' } },
    });

    expect(response.statusCode).toBe(200);
    expect(prisma.accessRequest.update).toHaveBeenCalledWith({
      where: { id: 'request-1' },
      data: { intakeResponses: { company: 'Acme', size: '11-50' } },
      select: { intakeResponses: true },
    });
    expect(response.json()).toEqual({
      data: {
        success: true,
        message: 'Intake responses saved',
        intakeResponses: { company: 'Acme', size: '11-50' },
      },
      error: null,
    });
  });

  it('rejects unknown, missing, and invalid dropdown answers before persistence', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/client/token-1/intake',
      payload: { intakeResponses: { extra: 'nope', size: 'enterprise' } },
    });

    expect(response.statusCode).toBe(400);
    expect(prisma.accessRequest.update).not.toHaveBeenCalled();
  });

  it('returns 404 REQUEST_NOT_FOUND for an unknown token', async () => {
    vi.mocked(prisma.accessRequest.findUnique).mockResolvedValue(null as any);

    const response = await app.inject({
      method: 'POST',
      url: '/client/token-1/intake',
      payload: { intakeResponses: { company: 'Acme' } },
    });

    expect(response.statusCode).toBe(404);
    expect(response.json().error).toMatchObject({ code: 'REQUEST_NOT_FOUND' });
  });

  it('returns 404 REQUEST_EXPIRED for an expired request before persisting', async () => {
    vi.mocked(prisma.accessRequest.findUnique).mockResolvedValue({
      id: 'request-1',
      intakeFields: [],
      expiresAt: new Date(Date.now() - 60_000),
    } as any);

    const response = await app.inject({
      method: 'POST',
      url: '/client/token-1/intake',
      payload: { intakeResponses: { company: 'Acme' } },
    });

    expect(response.statusCode).toBe(404);
    expect(response.json().error).toMatchObject({ code: 'REQUEST_EXPIRED' });
    expect(prisma.accessRequest.update).not.toHaveBeenCalled();
  });
});
