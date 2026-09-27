import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { accessRequestService } from '../../services/access-request.service.js';
import { metaAssetCreationService } from '../../services/meta-asset-creation.service.js';
import { prisma } from '../../lib/prisma.js';
import { sendError } from '../../lib/response.js';

// Validation schemas
const createAdAccountSchema = z.object({
  connectionId: z.string().min(1, 'Connection ID is required'),
  businessId: z.string().min(1, 'Business ID is required'),
  name: z.string().min(1, 'Ad account name is required').max(100, 'Name too long'),
  currency: z.string().length(3, 'Currency must be a 3-letter code'),
  timezoneId: z.string().min(1, 'Timezone ID is required'),
});

const createProductCatalogSchema = z.object({
  connectionId: z.string().min(1, 'Connection ID is required'),
  businessId: z.string().min(1, 'Business ID is required'),
  name: z.string().min(1, 'Catalog name is required').max(100, 'Name too long'),
});

const createBusinessSchema = z.object({
  connectionId: z.string().min(1, 'Connection ID is required'),
  name: z.string().min(1, 'Business name is required').max(100, 'Name too long'),
  primaryPageId: z.string().min(1, 'A Facebook Page is required'),
  timezoneId: z.string().min(1, 'Timezone ID is required'),
  vertical: z.string().min(1).default('OTHER'),
});

const getUserPagesSchema = z.object({
  connectionId: z.string().min(1, 'Connection ID is required'),
});

const getLinksSchema = z.object({
  businessId: z.string().min(1, 'Business ID is required'),
});

function creationErrorStatus(code: string) {
  if (code === 'AUTHORIZATION_NOT_FOUND' || code === 'TOKEN_NOT_FOUND') return 404;
  if (code === 'TOKEN_EXPIRED' || code === 'AUTHORIZATION_INACTIVE') return 400;
  if (code.startsWith('CREATION_') || code.startsWith('IDEMPOTENCY_')) return 409;
  return 500;
}

/**
 * Resolve and validate an authorized connection for an access request token
 */
async function resolveAuthorizedConnection(token: string, connectionId: string) {
  const accessRequest = await accessRequestService.getAccessRequestByToken(token);
  if (accessRequest.error || !accessRequest.data) {
    return {
      accessRequest: null,
      connection: null,
      error: {
        code: 'ACCESS_REQUEST_NOT_FOUND',
        message: 'Access request not found',
      },
    };
  }

  const connection = await prisma.clientConnection.findUnique({
    where: { id: connectionId },
  });

  if (!connection) {
    return {
      accessRequest: accessRequest.data,
      connection: null,
      error: {
        code: 'CONNECTION_NOT_FOUND',
        message: 'Client connection not found',
      },
    };
  }

  const isAuthorizedConnection =
    connection.accessRequestId === accessRequest.data.id &&
    connection.agencyId === accessRequest.data.agencyId;

  if (!isAuthorizedConnection) {
    return {
      accessRequest: accessRequest.data,
      connection: null,
      error: {
        code: 'FORBIDDEN',
        message: 'Connection does not belong to this access request',
      },
    };
  }

  return {
    accessRequest: accessRequest.data,
    connection,
    error: null,
  };
}

export async function registerAssetCreationRoutes(fastify: FastifyInstance) {
  /**
   * Create a new Meta ad account
   * POST /api/client/:token/create/meta/ad-account
   */
  fastify.post('/client/:token/create/meta/ad-account', async (request, reply) => {
    const { token } = request.params as { token: string };

    // Validate request body
    const validated = createAdAccountSchema.safeParse(request.body);
    if (!validated.success) {
      return sendError(reply, 'VALIDATION_ERROR', 'Invalid request parameters', 400, validated.error.errors,);
    }

    const { connectionId, businessId, name, currency, timezoneId } = validated.data;

    // Resolve and authorize connection
    const authContext = await resolveAuthorizedConnection(token, connectionId);
    if (authContext.error || !authContext.connection || !authContext.accessRequest) {
      const statusCode = authContext.error?.code === 'FORBIDDEN' ? 403 : 404;
      return reply.code(statusCode).send({
        data: null,
        error: authContext.error,
      });
    }

    // Create ad account
    const result = await metaAssetCreationService.createAdAccount(
      connectionId,
      businessId,
      { accessRequestId: authContext.accessRequest.id, name, currency, timezoneId },
      authContext.connection.clientEmail,
      authContext.accessRequest.agencyId
    );

    if (result.error) {
      const statusCode = creationErrorStatus(result.error.code);
      return reply.code(statusCode).send({
        data: null,
        error: result.error,
      });
    }

    return reply.send({
      data: result.data,
      error: null,
    });
  });

  /**
   * Create a new Meta product catalog
   * POST /api/client/:token/create/meta/product-catalog
   */
  fastify.post('/client/:token/create/meta/product-catalog', async (request, reply) => {
    const { token } = request.params as { token: string };

    // Validate request body
    const validated = createProductCatalogSchema.safeParse(request.body);
    if (!validated.success) {
      return sendError(reply, 'VALIDATION_ERROR', 'Invalid request parameters', 400, validated.error.errors,);
    }

    const { connectionId, businessId, name } = validated.data;

    // Resolve and authorize connection
    const authContext = await resolveAuthorizedConnection(token, connectionId);
    if (authContext.error || !authContext.connection || !authContext.accessRequest) {
      const statusCode = authContext.error?.code === 'FORBIDDEN' ? 403 : 404;
      return reply.code(statusCode).send({
        data: null,
        error: authContext.error,
      });
    }

    // Create product catalog
    const result = await metaAssetCreationService.createProductCatalog(
      connectionId,
      businessId,
      { accessRequestId: authContext.accessRequest.id, name },
      authContext.connection.clientEmail,
      authContext.accessRequest.agencyId
    );

    if (result.error) {
      const statusCode = creationErrorStatus(result.error.code);
      return reply.code(statusCode).send({
        data: null,
        error: result.error,
      });
    }

    return reply.send({
      data: result.data,
      error: null,
    });
  });

  /**
   * Create a new Meta Business Portfolio for the client user
   * POST /api/client/:token/create/meta/business
   */
  fastify.post('/client/:token/create/meta/business', async (request, reply) => {
    const { token } = request.params as { token: string };

    // Validate request body
    const validated = createBusinessSchema.safeParse(request.body);
    if (!validated.success) {
      return sendError(reply, 'VALIDATION_ERROR', 'Invalid request parameters', 400, validated.error.errors);
    }

    const { connectionId, name, primaryPageId, timezoneId, vertical } = validated.data;

    // Resolve and authorize connection
    const authContext = await resolveAuthorizedConnection(token, connectionId);
    if (authContext.error || !authContext.connection || !authContext.accessRequest) {
      const statusCode = authContext.error?.code === 'FORBIDDEN' ? 403 : 404;
      return reply.code(statusCode).send({
        data: null,
        error: authContext.error,
      });
    }

    // Create business
    const result = await metaAssetCreationService.createBusiness(
      connectionId,
      { accessRequestId: authContext.accessRequest.id, name, vertical, primaryPageId, timezoneId },
      authContext.connection.clientEmail,
      authContext.accessRequest.agencyId
    );

    if (result.error) {
      const statusCode = creationErrorStatus(result.error.code);
      return reply.code(statusCode).send({
        data: null,
        error: result.error,
      });
    }

    return reply.send({
      data: result.data,
      error: null,
    });
  });

  /**
   * List the client user's own Facebook Pages (guided Page prerequisite check)
   * GET /api/client/:token/create/meta/user-pages
   */
  fastify.get('/client/:token/create/meta/user-pages', async (request, reply) => {
    const { token } = request.params as { token: string };
    const query = request.query as { connectionId?: string };

    const validated = getUserPagesSchema.safeParse({ connectionId: query.connectionId });
    if (!validated.success) {
      return sendError(reply, 'VALIDATION_ERROR', 'Connection ID is required', 400, validated.error.errors);
    }

    // Resolve and authorize connection
    const authContext = await resolveAuthorizedConnection(token, validated.data.connectionId);
    if (authContext.error || !authContext.connection || !authContext.accessRequest) {
      const statusCode = authContext.error?.code === 'FORBIDDEN' ? 403 : 404;
      return reply.code(statusCode).send({
        data: null,
        error: authContext.error,
      });
    }

    const result = await metaAssetCreationService.getUserPages(validated.data.connectionId);

    if (result.error) {
      const statusCode =
        result.error.code === 'AUTHORIZATION_NOT_FOUND' ||
        result.error.code === 'TOKEN_NOT_FOUND'
          ? 404
          : result.error.code === 'TOKEN_EXPIRED' ||
            result.error.code === 'AUTHORIZATION_INACTIVE'
          ? 400
          : 500;
      return reply.code(statusCode).send({
        data: null,
        error: result.error,
      });
    }

    return reply.send({
      data: { pages: result.data },
      error: null,
    });
  });

  /**
   * Get asset creation links (for pages and pixels - manual creation)
   * GET /api/client/:token/create/meta/links
   */
  fastify.get('/client/:token/create/meta/links', async (request, reply) => {
    const { token } = request.params as { token: string };
    const { businessId } = request.query as { businessId?: string };

    // Validate businessId
    const validated = getLinksSchema.safeParse({ businessId });
    if (!validated.success) {
      return sendError(reply, 'VALIDATION_ERROR', 'Business ID is required', 400, validated.error.errors,);
    }

    // Get access request to verify token is valid
    const accessRequest = await accessRequestService.getAccessRequestByToken(token);
    if (accessRequest.error || !accessRequest.data) {
      return sendError(reply, 'ACCESS_REQUEST_NOT_FOUND', 'Access request not found', 404);
    }

    // Get creation links
    const links = metaAssetCreationService.getAssetCreationLinks(validated.data.businessId);

    return reply.send({
      data: links,
      error: null,
    });
  });

  /**
   * Get supported currencies for ad account creation
   * GET /api/client/:token/create/meta/currencies
   */
  fastify.get('/client/:token/create/meta/currencies', async (request, reply) => {
    const { token } = request.params as { token: string };

    // Get access request to verify token is valid
    const accessRequest = await accessRequestService.getAccessRequestByToken(token);
    if (accessRequest.error || !accessRequest.data) {
      return sendError(reply, 'ACCESS_REQUEST_NOT_FOUND', 'Access request not found', 404);
    }

    const currencies = metaAssetCreationService.getSupportedCurrencies();

    return reply.send({
      data: { currencies },
      error: null,
    });
  });

  /**
   * Get supported timezones for ad account creation
   * GET /api/client/:token/create/meta/timezones
   */
  fastify.get('/client/:token/create/meta/timezones', async (request, reply) => {
    const { token } = request.params as { token: string };

    // Get access request to verify token is valid
    const accessRequest = await accessRequestService.getAccessRequestByToken(token);
    if (accessRequest.error || !accessRequest.data) {
      return sendError(reply, 'ACCESS_REQUEST_NOT_FOUND', 'Access request not found', 404);
    }

    const timezones = metaAssetCreationService.getSupportedTimezones();

    return reply.send({
      data: { timezones },
      error: null,
    });
  });
}
