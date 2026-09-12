/**
 * Agency Routes
 *
 * API endpoints for agency management.
 * Protected by Clerk JWT verification.
 */

import { FastifyInstance } from 'fastify';
import type { SubscriptionTier } from '@agency-platform/shared';
import { agencyService } from '../services/agency.service.js';
import { sendError, sendValidationError } from '../lib/response.js';
import { authenticate } from '../middleware/auth.js';
import { quotaEnforcementMiddleware } from '../middleware/quota-enforcement.js';
import { assertAgencyAccess } from '@/lib/authorization.js';
import { requirePrincipalAgency } from '@/lib/agency-guard.js';

export async function agencyRoutes(fastify: FastifyInstance) {
  // Add authentication middleware to all agency routes
  fastify.addHook('onRequest', authenticate());

  const getPrincipalId = (request: any): string | null => {
    const user = request.user as { sub?: string; orgId?: string } | undefined;
    return user?.orgId || user?.sub || null;
  };

  const forbidIfAgencyMismatch = (reply: any, requestedAgencyId: string, principalAgencyId: string): boolean => {
    const accessError = assertAgencyAccess(requestedAgencyId, principalAgencyId);
    if (!accessError) return false;

    sendError(reply, accessError.code, accessError.message, 403);
    return true;
  };

  /**
   * GET /agencies/by-email
   * Lightweight agency lookup by email (no members included)
   * Cached for 30 minutes - use this for performance-critical lookups
   */
  fastify.get('/agencies/by-email', async (request, reply) => {
    try {
      const { email } = request.query as { email?: string };

      if (!email) {
        fastify.log.warn('GET /agencies/by-email: No email provided');
        return sendValidationError(reply, 'Email query parameter is required');
      }

      const principal = await requirePrincipalAgency(request, reply);
      if (!principal) return;

      if (email !== principal.agency.email) {
        return sendError(reply, 'FORBIDDEN', 'You do not have access to this agency resource', 403);
      }

      fastify.log.info({ email }, 'GET /agencies/by-email');

      const result = await agencyService.getAgencyByEmail(email);

      if (result.error) {
        fastify.log.error({ error: result.error }, 'GET /agencies/by-email: Service error');
        return sendError(reply, result.error.code, result.error.message, 500);
      }

      fastify.log.info({ found: !!result.data }, 'GET /agencies/by-email: Success');
      return reply.send({ data: result.data, error: null });
    } catch (error) {
      fastify.log.error({ error }, 'Error in GET /agencies/by-email');
      return sendError(reply, 'INTERNAL_ERROR', 'Failed to retrieve agency', 500);
    }
  });

  // List agencies with optional filters
  fastify.get('/agencies', async (request, reply) => {
    try {
      const { email, clerkUserId, fields } = request.query as {
        email?: string;
        clerkUserId?: string;
        fields?: string; // Comma-separated list of fields to include: 'id,name,email,clerkUserId,members'
      };

      fastify.log.info({ email, clerkUserId, fields }, 'GET /agencies');

      // Validate that at least one filter is provided
      if (!email && !clerkUserId) {
        fastify.log.warn('GET /agencies: No filter provided');
        return sendValidationError(reply, 'Either email or clerkUserId query parameter is required');
      }

      const principal = await requirePrincipalAgency(request, reply);
      if (!principal) return;
      const principalId = principal.principalId;

      if (clerkUserId && clerkUserId !== principalId) {
        return sendError(reply, 'FORBIDDEN', 'You do not have access to this agency resource', 403);
      }

      if (email && email !== principal.agency.email) {
        return sendError(reply, 'FORBIDDEN', 'You do not have access to this agency resource', 403);
      }

      // Parse fields parameter to determine what to include
      const includeMembers = !fields || fields.includes('members');
      if (clerkUserId === principalId && !email && !includeMembers) {
        return reply.send({
          data: [
            {
              ...principal.agency,
              clerkUserId: principalId,
            },
          ],
          error: null,
        });
      }

      const result = await agencyService.listAgencies(
        {
          email,
          clerkUserId: clerkUserId || principalId,
        },
        includeMembers
      );

      if (result.error) {
        fastify.log.error({ error: result.error }, 'GET /agencies: Service error');
        return sendError(reply, result.error.code, result.error.message, 500);
      }

      // Ensure we always return a valid response format
      const response = {
        data: result.data || [],
        error: null,
      };

      fastify.log.info({ count: response.data.length }, 'GET /agencies: Success');
      return reply.send(response);
    } catch (error) {
      fastify.log.error({ error }, 'Error in GET /agencies');
      return sendError(reply, 'INTERNAL_ERROR', 'Failed to retrieve agencies', 500);
    }
  });

  // Get agency by ID
  fastify.get('/agencies/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const principal = await requirePrincipalAgency(request, reply);
    if (!principal) return;
    if (forbidIfAgencyMismatch(reply, id, principal.agencyId)) return;

    const result = await agencyService.getAgency(id);

    if (result.error) {
      return sendError(reply, result.error.code, result.error.message, result.error.code === 'NOT_FOUND' ? 404 : 500);
    }

    return reply.send(result);
  });

  // Create agency
  fastify.post('/agencies', async (request, reply) => {
    const principalId = getPrincipalId(request);
    if (!principalId) {
      return sendError(reply, 'UNAUTHORIZED', 'Authenticated user context is required', 401);
    }

    const body = request.body as { clerkUserId?: string; affiliateClickToken?: string; [key: string]: any };
    if (body.clerkUserId && body.clerkUserId !== principalId) {
      return sendError(reply, 'FORBIDDEN', 'You do not have access to this agency resource', 403);
    }

    const result = await agencyService.createAgency({
      ...body,
      clerkUserId: principalId,
    } as any);

    if (result.error) {
      const statusCode = result.error.code === 'AGENCY_EXISTS' ? 409 : 400;
      return sendError(reply, result.error.code, result.error.message, statusCode);
    }

    return reply.send(result);
  });

  /**
   * POST /api/agencies/signup-checkout
   *
   * Create agency and Creem checkout session in one atomic operation.
   * Used during signup flow to redirect user to payment immediately.
   */
  fastify.post('/agencies/signup-checkout', async (request, reply) => {
    try {
      const principalId = getPrincipalId(request);
      if (!principalId) {
        return sendError(reply, 'UNAUTHORIZED', 'Authenticated user context is required', 401);
      }

      const body = request.body as {
        clerkUserId: string;
        name: string;
        email: string;
        selectedTier: SubscriptionTier;
        billingInterval: 'monthly' | 'yearly';
        settings?: Record<string, any>;
        affiliateClickToken?: string;
      };

      if (body.clerkUserId && body.clerkUserId !== principalId) {
        return sendError(reply, 'FORBIDDEN', 'You do not have access to this agency resource', 403);
      }

      const payload = {
        ...body,
        clerkUserId: principalId,
      };

      fastify.log.info({ email: payload.email, tier: payload.selectedTier }, 'POST /agencies/signup-checkout');

      const result = await agencyService.createAgencyWithCheckout(payload);

      if (result.error) {
        fastify.log.error({ error: result.error }, 'POST /agencies/signup-checkout: Service error');
        const statusCode = result.error.code === 'AGENCY_EXISTS' ? 409 : 400;
        return sendError(reply, result.error.code, result.error.message, statusCode);
      }

      fastify.log.info({ agencyId: result.data.agency.id }, 'POST /agencies/signup-checkout: Success');
      return reply.send(result);
    } catch (error) {
      fastify.log.error({ error }, 'Error in POST /agencies/signup-checkout');
      return sendError(reply, 'INTERNAL_ERROR', 'Failed to create agency with checkout', 500);
    }
  });

  // Update agency
  fastify.patch('/agencies/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const principal = await requirePrincipalAgency(request, reply);
    if (!principal) return;
    if (forbidIfAgencyMismatch(reply, id, principal.agencyId)) return;

    const result = await agencyService.updateAgency(id, request.body as any);

    if (result.error) {
      const statusCode = result.error.code === 'NOT_FOUND' ? 404 : 400;
      return sendError(reply, result.error.code, result.error.message, statusCode);
    }

    return reply.send(result);
  });

  // Get agency members
  fastify.get('/agencies/:id/members', async (request, reply) => {
    const { id } = request.params as { id: string };
    const principal = await requirePrincipalAgency(request, reply);
    if (!principal) return;
    if (forbidIfAgencyMismatch(reply, id, principal.agencyId)) return;

    const result = await agencyService.getAgencyMembers(id);

    if (result.error) {
      return sendError(reply, result.error.code, result.error.message, 500);
    }

    return reply.send(result);
  });

  // Invite member
  fastify.post(
    '/agencies/:id/members',
    {
      onRequest: [quotaEnforcementMiddleware({
        metric: 'team_seats',
        getAgencyId: (request) => (request.params as any).id,
      })],
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const principal = await requirePrincipalAgency(request, reply);
      if (!principal) return;
      if (forbidIfAgencyMismatch(reply, id, principal.agencyId)) return;
      const body = request.body as { email: string; role: 'admin' | 'member' | 'viewer' };
      const result = await agencyService.inviteMember(id, body);

      if (result.error) {
        const statusCode = result.error.code === 'MEMBER_EXISTS' ? 409 : 400;
        return sendError(reply, result.error.code, result.error.message, statusCode);
      }
      return reply.send(result);
    }
  );

  // Bulk invite members (for onboarding)
  fastify.post(
    '/agencies/:id/members/bulk',
    {
      onRequest: [quotaEnforcementMiddleware({
        metric: 'team_seats',
        getAgencyId: (request) => (request.params as any).id,
        requestedAmount: (request: any) => (request.body?.members?.length as number) || 1,
      })],
    },
    async (request, reply) => {
    const { id } = request.params as { id: string };
    const principal = await requirePrincipalAgency(request, reply);
    if (!principal) return;
    if (forbidIfAgencyMismatch(reply, id, principal.agencyId)) return;

    const result = await agencyService.bulkInviteMembers(id, request.body as any);

    if (result.error) {
      const statusCode = result.error.code === 'AGENCY_NOT_FOUND' ? 404 : 400;
      return sendError(reply, result.error.code, result.error.message, statusCode);
    }

    return reply.send(result);
    },
  );

  // Get onboarding status
  fastify.get('/agencies/:id/onboarding-status', async (request, reply) => {
    const { id } = request.params as { id: string };
    const principal = await requirePrincipalAgency(request, reply);
    if (!principal) return;
    if (forbidIfAgencyMismatch(reply, id, principal.agencyId)) return;

    const result = await agencyService.getOnboardingStatus(id);

    if (result.error) {
      const statusCode = result.error.code === 'AGENCY_NOT_FOUND' ? 404 : 500;
      return sendError(reply, result.error.code, result.error.message, statusCode);
    }

    return reply.send(result);
  });

  // Update onboarding progress metadata
  fastify.patch('/agencies/:id/onboarding-progress', async (request, reply) => {
    const { id } = request.params as { id: string };
    const principal = await requirePrincipalAgency(request, reply);
    if (!principal) return;
    if (forbidIfAgencyMismatch(reply, id, principal.agencyId)) return;

    const result = await agencyService.updateOnboardingProgress(id, request.body as any);

    if (result.error) {
      const statusCode =
        result.error.code === 'AGENCY_NOT_FOUND'
          ? 404
          : result.error.code === 'VALIDATION_ERROR'
            ? 400
            : 500;
      return sendError(reply, result.error.code, result.error.message, statusCode);
    }

    return reply.send(result);
  });

  // Update member role
  fastify.patch('/members/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const principal = await requirePrincipalAgency(request, reply);
    if (!principal) return;

    const body = request.body as { role: 'admin' | 'member' | 'viewer' };
    const result = await agencyService.updateMemberRoleForAgency(id, principal.agencyId, body.role);

    if (result.error) {
      const statusCode =
        result.error.code === 'FORBIDDEN'
          ? 403
          : (result.error.code === 'NOT_FOUND' || result.error.code === 'MEMBER_NOT_FOUND')
            ? 404
            : 400;
      return sendError(reply, result.error.code, result.error.message, statusCode);
    }

    return reply.send(result);
  });

  // Remove member
  fastify.delete('/members/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const principal = await requirePrincipalAgency(request, reply);
    if (!principal) return;

    const result = await agencyService.removeMemberForAgency(id, principal.agencyId);

    if (result.error) {
      const statusCode =
        result.error.code === 'FORBIDDEN'
          ? 403
          : (result.error.code === 'NOT_FOUND' || result.error.code === 'MEMBER_NOT_FOUND')
            ? 404
            : 500;
      return sendError(reply, result.error.code, result.error.message, statusCode);
    }

    return reply.send({ data: { success: true }, error: null });
  });
}
