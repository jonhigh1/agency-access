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
    // The route reads narrowly: id, status, fields, and expiry only.
    vi.mocked(prisma.accessRequest.findUnique).mockResolvedValue({
      id: 'request-1',
      status: 'pending',
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
      status: 'pending',
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

  it('returns 500 INTAKE_SAVE_FAILED when persistence fails', async () => {
    vi.mocked(prisma.accessRequest.update).mockRejectedValue(new Error('write failed'));

    const response = await app.inject({
      method: 'POST',
      url: '/client/token-1/intake',
      payload: { intakeResponses: { company: 'Acme', size: '11-50' } },
    });

    expect(response.statusCode).toBe(500);
    expect(response.json().error).toMatchObject({ code: 'INTAKE_SAVE_FAILED' });
  });

  it('returns 400 with field intakeFields when the stored form is not an array', async () => {
    vi.mocked(prisma.accessRequest.findUnique).mockResolvedValue({
      id: 'request-1',
      status: 'pending',
      intakeFields: 'not-an-array',
      expiresAt: new Date(Date.now() + 60_000),
    } as any);

    const response = await app.inject({
      method: 'POST',
      url: '/client/token-1/intake',
      payload: { intakeResponses: { Company: 'Acme' } },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json().error.details).toEqual([
      { field: 'intakeFields', message: 'This request has an invalid intake form.' },
    ]);
    expect(prisma.accessRequest.update).not.toHaveBeenCalled();
  });

  it.each(['completed', 'revoked'])(
    'returns 404 for a %s request before persisting',
    async (status) => {
      vi.mocked(prisma.accessRequest.findUnique).mockResolvedValue({
        id: 'request-1',
        status,
        intakeFields: [],
        expiresAt: new Date(Date.now() + 60_000),
      } as any);

      const response = await app.inject({
        method: 'POST',
        url: '/client/token-1/intake',
        payload: { intakeResponses: { company: 'Acme' } },
      });

      expect(response.statusCode).toBe(404);
      expect(response.json().error).toMatchObject({ code: 'REQUEST_NOT_FOUND' });
      expect(prisma.accessRequest.update).not.toHaveBeenCalled();
    }
  );

  it('accepts label-keyed answers for legacy id-less intake forms', async () => {
    vi.mocked(prisma.accessRequest.findUnique).mockResolvedValue({
      id: 'request-1',
      status: 'pending',
      intakeFields: [
        { label: 'Company name', type: 'text', required: true },
        { label: 'Company size', type: 'dropdown', required: false, options: ['1-10', '11-50'] },
      ],
      expiresAt: new Date(Date.now() + 60_000),
    } as any);
    vi.mocked(prisma.accessRequest.update).mockResolvedValue({
      intakeResponses: { 'Company name': 'Acme', 'Company size': '11-50' },
    } as any);

    const response = await app.inject({
      method: 'POST',
      url: '/client/token-1/intake',
      payload: {
        intakeResponses: { 'Company name': 'Acme', 'Company size': '11-50' },
      },
    });

    expect(response.statusCode).toBe(200);
    expect(prisma.accessRequest.update).toHaveBeenCalledWith({
      where: { id: 'request-1' },
      data: { intakeResponses: { 'Company name': 'Acme', 'Company size': '11-50' } },
      select: { intakeResponses: true },
    });
  });

  it('enforces required and dropdown rules under label-keyed matching', async () => {
    vi.mocked(prisma.accessRequest.findUnique).mockResolvedValue({
      id: 'request-1',
      status: 'pending',
      intakeFields: [
        { label: 'Company name', type: 'text', required: true },
        { label: 'Company size', type: 'dropdown', required: false, options: ['1-10', '11-50'] },
      ],
      expiresAt: new Date(Date.now() + 60_000),
    } as any);

    const response = await app.inject({
      method: 'POST',
      url: '/client/token-1/intake',
      payload: { intakeResponses: { 'Company size': 'enterprise' } },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json().error.details).toEqual([
      { field: 'Company name', message: 'This field is required.' },
      { field: 'Company size', message: 'Choose one of the provided options.' },
    ]);
    expect(prisma.accessRequest.update).not.toHaveBeenCalled();
  });

  it('returns 422 INVALID_INTAKE_FORM for a stored form with mixed ids', async () => {
    vi.mocked(prisma.accessRequest.findUnique).mockResolvedValue({
      id: 'request-1',
      status: 'pending',
      intakeFields: [
        { id: 'company', label: 'Company name', type: 'text', required: true },
        { label: 'Company size', type: 'dropdown', required: false, options: ['1-10', '11-50'] },
      ],
      expiresAt: new Date(Date.now() + 60_000),
    } as any);

    const response = await app.inject({
      method: 'POST',
      url: '/client/token-1/intake',
      payload: { intakeResponses: { company: 'Acme' } },
    });

    expect(response.statusCode).toBe(422);
    expect(response.json().error).toMatchObject({ code: 'INVALID_INTAKE_FORM' });
    expect(prisma.accessRequest.update).not.toHaveBeenCalled();
  });
});
