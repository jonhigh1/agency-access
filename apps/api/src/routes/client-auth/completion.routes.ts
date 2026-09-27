import { FastifyInstance } from 'fastify';
import { accessRequestService } from '../../services/access-request.service.js';
import { notificationService } from '../../services/notification.service.js';

export async function registerCompletionRoutes(fastify: FastifyInstance) {
  // Complete client authorization
  fastify.post('/client/:token/complete', async (request, reply) => {
    const { token } = request.params as { token: string };

    const accessRequestResult = await accessRequestService.getAccessRequestByToken(token);

    if (accessRequestResult.error || !accessRequestResult.data) {
      return reply.code(404).send({
        data: null,
        error: accessRequestResult.error || {
          code: 'NOT_FOUND',
          message: 'Access request not found',
        },
      });
    }

    const accessRequest = accessRequestResult.data;

    const result = await accessRequestService.markRequestAuthorized(accessRequest.id);

    if (result.error) {
      return reply.code(404).send({
        data: null,
        error: result.error,
      });
    }

    if (result.data?.status !== 'completed') {
      return reply.code(409).send({
        data: {
          success: false,
          status: result.data?.status || 'partial',
        },
        error: {
          code: 'FULFILLMENT_INCOMPLETE',
          message: 'Access is not complete. Finish or explicitly exclude every unresolved asset and assignee, then check again.',
        },
      });
    }

    if (result.previousStatus !== 'completed') {
      await notificationService.queueNotification({
      agencyId: accessRequest.agencyId,
      accessRequestId: accessRequest.id,
      clientEmail: accessRequest.clientEmail,
      clientName: accessRequest.clientEmail.split('@')[0],
      platforms:
        accessRequest.authorizationProgress?.fulfilledProducts?.map((item) => item.product) ||
        accessRequest.authorizationProgress?.completedPlatforms ||
        [],
      completedAt: new Date(),
      });
    }

    return reply.send({
      data: {
        success: true,
        message: 'Authorization complete',
      },
      error: null,
    });
  });
}
