/**
 * Clients Routes Tests
 *
 * Test-Driven Development for Phase 5 Client Management API
 * Following Red-Green-Refactor cycle
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import Fastify, { FastifyInstance } from 'fastify';
import { clientRoutes } from '../clients.js';
import * as clientService from '@/services/client.service';

// Mock service
vi.mock('@/services/client.service', () => ({
  createClient: vi.fn(),
  getClients: vi.fn(),
  getClientsWithConnections: vi.fn(),
  getClientById: vi.fn(),
  updateClient: vi.fn(),
  findClientByEmail: vi.fn(),
  deleteClient: vi.fn(),
  ClientError: {
    EMAIL_EXISTS: 'CLIENT_EMAIL_EXISTS',
    INVALID_EMAIL: 'CLIENT_INVALID_EMAIL',
    NOT_FOUND: 'CLIENT_NOT_FOUND',
  },
}));
vi.mock('@/middleware/quota-enforcement', () => ({
  quotaEnforcementMiddleware: () => async () => undefined,
}));
vi.mock('@/lib/authorization', () => ({
  resolvePrincipalAgency: vi.fn(async () => ({
    data: { agencyId: 'agency-1', principalId: 'test-user', agency: { id: 'agency-1', name: 'Agency', email: 'test@example.com' } },
    error: null,
  })),
  resolveAuthenticatedUserEmail: vi.fn(async () => 'test@example.com'),
}));

describe('Phase 5: Clients Routes - TDD Tests', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    app = Fastify();
    app.addHook('onRequest', async (request) => {
      (request as any).user = { sub: 'test-user' };
    });
    await app.register(clientRoutes, { prefix: '/api' });
    vi.clearAllMocks();
    vi.mocked(clientService.getClientsWithConnections).mockImplementation((dto: any) =>
      vi.mocked(clientService.getClients)(dto) as any
    );
  });

  afterEach(async () => {
    await app.close();
  });

  describe('POST /api/clients', () => {
    it('should create a new client', async () => {
      const mockClient = {
        id: 'client-1',
        agencyId: 'agency-1',
        name: 'John Smith',
        company: 'Acme Corp',
        email: 'john@acme.com',
        language: 'en',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.mocked(clientService.createClient).mockResolvedValue(mockClient as any);

      const response = await app.inject({
        method: 'POST',
        url: '/api/clients',
        headers: { 'x-agency-id': 'agency-1' },
        body: {
          name: 'John Smith',
          company: 'Acme Corp',
          email: 'john@acme.com',
          language: 'en',
        },
      });

      expect(response.statusCode).toBe(201);
      // Match excluding dates which are serialized differently
      expect(response.json()).toMatchObject({
        data: {
          id: 'client-1',
          agencyId: 'agency-1',
          name: 'John Smith',
          company: 'Acme Corp',
          email: 'john@acme.com',
          language: 'en',
        },
      });
      expect(clientService.createClient).toHaveBeenCalledWith({
        agencyId: 'agency-1',
        name: 'John Smith',
        company: 'Acme Corp',
        email: 'john@acme.com',
        language: 'en',
      });
    });

    it('should create a client with default language en', async () => {
      const mockClient = {
        id: 'client-1',
        agencyId: 'agency-1',
        name: 'Jane Doe',
        company: 'TechCo',
        email: 'jane@techco.com',
        language: 'en',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.mocked(clientService.createClient).mockResolvedValue(mockClient as any);

      const response = await app.inject({
        method: 'POST',
        url: '/api/clients',
        headers: { 'x-agency-id': 'agency-1' },
        body: {
          name: 'Jane Doe',
          company: 'TechCo',
          email: 'jane@techco.com',
        },
      });

      expect(response.statusCode).toBe(201);
      expect(response.json().data.language).toBe('en');
    });

    it('should return 400 for invalid email', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/clients',
        headers: { 'x-agency-id': 'agency-1' },
        body: {
          name: 'Test',
          company: 'Test',
          email: 'invalid-email',
        },
      });

      expect(response.statusCode).toBe(400);
      // Zod validation catches this before service
      expect(response.json()).toMatchObject({
        data: null,
      });
    });

    it('should return 409 for duplicate email', async () => {
      vi.mocked(clientService.createClient).mockRejectedValue(new Error('CLIENT_EMAIL_EXISTS'));

      const response = await app.inject({
        method: 'POST',
        url: '/api/clients',
        headers: { 'x-agency-id': 'agency-1' },
        body: {
          name: 'Test',
          company: 'Test',
          email: 'existing@test.com',
        },
      });

      expect(response.statusCode).toBe(409);
      expect(response.json()).toMatchObject({
        error: { code: 'EMAIL_EXISTS', message: expect.any(String) },
      });
    });

    it('should return 400 for missing required fields', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/clients',
        headers: { 'x-agency-id': 'agency-1' },
        body: {
          name: 'Test',
          // missing company, email
        },
      });

      expect(response.statusCode).toBe(400);
    });

    it('should return 400 for invalid language', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/clients',
        headers: { 'x-agency-id': 'agency-1' },
        body: {
          name: 'Test',
          company: 'Test',
          email: 'test@example.com',
          language: 'invalid',
        },
      });

      expect(response.statusCode).toBe(400);
    });
  });

  describe('GET /api/clients', () => {
    it('should list all clients for an agency', async () => {
      const mockClients = [
        { id: 'client-1', name: 'Alice', company: 'AAA', email: 'alice@aaa.com', language: 'en' },
        { id: 'client-2', name: 'Bob', company: 'BBB', email: 'bob@bbb.com', language: 'es' },
      ];

      vi.mocked(clientService.getClients).mockResolvedValue({
        data: mockClients as any,
        pagination: { total: 2, limit: 50, offset: 0 },
      });

      const response = await app.inject({
        method: 'GET',
        url: '/api/clients',
        headers: { 'x-agency-id': 'agency-1' },
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toMatchObject({
        data: {
          data: mockClients,
          pagination: { total: 2, limit: 50, offset: 0 },
        },
      });
    });

    it('should support pagination with limit and offset', async () => {
      vi.mocked(clientService.getClients).mockResolvedValue({
        data: [{ id: 'client-1', name: 'Alice' }] as any,
        pagination: { total: 10, limit: 5, offset: 5 },
      });

      const response = await app.inject({
        method: 'GET',
        url: '/api/clients?limit=5&offset=5',
        headers: { 'x-agency-id': 'agency-1' },
      });

      expect(response.statusCode).toBe(200);
      expect(response.json().data.pagination).toEqual({ total: 10, limit: 5, offset: 5 });
      expect(clientService.getClients).toHaveBeenCalledWith({
        agencyId: 'agency-1',
        limit: 5,
        offset: 5,
      });
    });

    it('should support search query', async () => {
      vi.mocked(clientService.getClients).mockResolvedValue({
        data: [{ id: 'client-1', name: 'Alice' }] as any,
        pagination: { total: 1, limit: 50, offset: 0 },
      });

      const response = await app.inject({
        method: 'GET',
        url: '/api/clients?search=Alice',
        headers: { 'x-agency-id': 'agency-1' },
      });

      expect(response.statusCode).toBe(200);
      expect(clientService.getClients).toHaveBeenCalledWith({
        agencyId: 'agency-1',
        search: 'Alice',
        limit: 50,
        offset: 0,
      });
    });

    it('should validate limit is a number', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/clients?limit=invalid',
        headers: { 'x-agency-id': 'agency-1' },
      });

      expect(response.statusCode).toBe(400);
    });

    it('should validate limit maximum value', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/clients?limit=1000',
        headers: { 'x-agency-id': 'agency-1' },
      });

      expect(response.statusCode).toBe(400);
    });
  });

  describe('GET /api/clients/:id', () => {
    it('should get a client by id', async () => {
      const mockClient = {
        id: 'client-1',
        name: 'John Smith',
        company: 'Acme Corp',
        email: 'john@acme.com',
        language: 'en',
      };

      vi.mocked(clientService.getClientById).mockResolvedValue(mockClient as any);

      const response = await app.inject({
        method: 'GET',
        url: '/api/clients/client-1',
        headers: { 'x-agency-id': 'agency-1' },
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({ data: mockClient });
      expect(clientService.getClientById).toHaveBeenCalledWith('client-1', 'agency-1');
    });

    it('should return 404 for non-existent client', async () => {
      vi.mocked(clientService.getClientById).mockResolvedValue(null);

      const response = await app.inject({
        method: 'GET',
        url: '/api/clients/non-existent',
        headers: { 'x-agency-id': 'agency-1' },
      });

      expect(response.statusCode).toBe(404);
      expect(response.json()).toMatchObject({
        error: { code: 'NOT_FOUND', message: expect.any(String) },
      });
    });
  });

  describe('PUT /api/clients/:id', () => {
    it('should update a client', async () => {
      const mockUpdated = {
        id: 'client-1',
        name: 'Updated Name',
        company: 'Acme Corp',
        email: 'john@acme.com',
        language: 'es',
      };

      vi.mocked(clientService.updateClient).mockResolvedValue(mockUpdated as any);

      const response = await app.inject({
        method: 'PUT',
        url: '/api/clients/client-1',
        headers: { 'x-agency-id': 'agency-1' },
        body: {
          name: 'Updated Name',
          language: 'es',
        },
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({ data: mockUpdated });
      expect(clientService.updateClient).toHaveBeenCalledWith(
        'client-1',
        'agency-1',
        { name: 'Updated Name', language: 'es' }
      );
    });

    it('should return 404 for non-existent client', async () => {
      vi.mocked(clientService.updateClient).mockResolvedValue(null);

      const response = await app.inject({
        method: 'PUT',
        url: '/api/clients/non-existent',
        headers: { 'x-agency-id': 'agency-1' },
        body: { name: 'New Name' },
      });

      expect(response.statusCode).toBe(404);
      expect(response.json()).toMatchObject({
        error: { code: 'NOT_FOUND', message: expect.any(String) },
      });
    });

    it('should return 409 for duplicate email', async () => {
      vi.mocked(clientService.updateClient).mockRejectedValue(new Error('CLIENT_EMAIL_EXISTS'));

      const response = await app.inject({
        method: 'PUT',
        url: '/api/clients/client-1',
        headers: { 'x-agency-id': 'agency-1' },
        body: { email: 'existing@test.com' },
      });

      expect(response.statusCode).toBe(409);
      expect(response.json()).toMatchObject({
        error: { code: 'EMAIL_EXISTS', message: expect.any(String) },
      });
    });
  });

  describe('DELETE /api/clients/:id', () => {
    it('should delete a client', async () => {
      vi.mocked(clientService.deleteClient).mockResolvedValue(true);

      const response = await app.inject({
        method: 'DELETE',
        url: '/api/clients/client-1',
        headers: { 'x-agency-id': 'agency-1' },
      });

      expect(response.statusCode).toBe(204);
      expect(clientService.deleteClient).toHaveBeenCalledWith('client-1', 'agency-1', {
        userEmail: 'test@example.com',
        ipAddress: expect.any(String),
      });
    });

    it('should return 404 for non-existent client', async () => {
      vi.mocked(clientService.deleteClient).mockResolvedValue(false);

      const response = await app.inject({
        method: 'DELETE',
        url: '/api/clients/non-existent',
        headers: { 'x-agency-id': 'agency-1' },
      });

      expect(response.statusCode).toBe(404);
      expect(response.json()).toMatchObject({
        error: { code: 'NOT_FOUND', message: expect.any(String) },
      });
    });
  });

  describe('GET /api/clients/search', () => {
    it('should search clients by email', async () => {
      const mockClient = {
        id: 'client-1',
        name: 'John Smith',
        company: 'Acme Corp',
        email: 'john@acme.com',
      };

      vi.mocked(clientService.findClientByEmail).mockResolvedValue(mockClient as any);

      const response = await app.inject({
        method: 'GET',
        url: '/api/clients/search?email=john@acme.com',
        headers: { 'x-agency-id': 'agency-1' },
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({ data: mockClient });
      expect(clientService.findClientByEmail).toHaveBeenCalledWith('agency-1', 'john@acme.com');
    });

    it('should return 404 if no client found', async () => {
      vi.mocked(clientService.findClientByEmail).mockResolvedValue(null);

      const response = await app.inject({
        method: 'GET',
        url: '/api/clients/search?email=nonexistent@test.com',
        headers: { 'x-agency-id': 'agency-1' },
      });

      expect(response.statusCode).toBe(404);
      expect(response.json()).toMatchObject({
        error: { code: 'NOT_FOUND', message: expect.any(String) },
      });
    });

    it('should return 400 for missing email parameter', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/clients/search',
        headers: { 'x-agency-id': 'agency-1' },
      });

      expect(response.statusCode).toBe(400);
    });
  });

  describe('Authentication', () => {
    it('should return 401 without x-agency-id header', async () => {
      const unauthenticatedApp = Fastify();
      await unauthenticatedApp.register(clientRoutes, { prefix: '/api' });
      const response = await unauthenticatedApp.inject({
        method: 'GET',
        url: '/api/clients',
      });

      expect(response.statusCode).toBe(401);
      await unauthenticatedApp.close();
    });
  });
});
