/**
 * Webhook Routes
 *
 * Handles incoming webhooks from payment providers (Creem.io).
 * Processes subscription events and updates tier metadata accordingly.
 */

import { FastifyInstance } from 'fastify';
import { prisma } from '@/lib/prisma';
import { assertAgencyAccess } from '@/lib/authorization.js';
import { requirePrincipalAgency } from '@/lib/agency-guard.js';
import { clerkMetadataService } from '@/services/clerk-metadata.service';
import { authenticate } from '@/middleware/auth.js';
import { quotaEnforcementMiddleware } from '@/middleware/quota-enforcement.js';
import {
  createWebhookEndpoint,
  disableWebhookEndpoint,
  getWebhookEndpoint,
  rotateWebhookEndpointSecret,
  updateWebhookEndpoint,
} from '@/services/webhook-endpoint.service';
import {
  listWebhookDeliveries,
  sendWebhookTestEvent,
} from '@/services/webhook-management.service';
import { webhookService } from '@/services/webhook.service';
import {
  SubscriptionTier,
  type WebhookApiVersion,
  WebhookApiVersionSchema,
} from '@agency-platform/shared';
import { getTierFromProductId } from '@/config/creem.config';
import { creem } from '@/lib/creem';
import { trackSubscriptionLifecycleFromWebhook } from '@/services/billing-analytics.service';
import { sendError } from '../lib/response.js';

type CreemEvent = {
  id: string;
  type: string;
  data: Record<string, any>;
};

type CreemSubscriptionPayload = {
  id: string;
  status: 'active' | 'past_due' | 'canceled' | 'trialing';
  customer_id: string;
  price_id: string;
  current_period_start: string;
  current_period_end: string;
  trial_end?: string;
};

type CreemInvoicePayload = {
  id: string;
  [key: string]: any;
};

function getSubscriptionPayload(payload: CreemEvent): CreemSubscriptionPayload | null {
  const candidate = payload.data?.subscription ?? payload.data?.object ?? null;

  if (
    !candidate ||
    typeof candidate !== 'object' ||
    typeof candidate.id !== 'string' ||
    typeof candidate.customer_id !== 'string' ||
    typeof candidate.price_id !== 'string'
  ) {
    return null;
  }

  return candidate as CreemSubscriptionPayload;
}

function getInvoicePayload(payload: CreemEvent): CreemInvoicePayload | null {
  const candidate = payload.data?.invoice ?? payload.data?.object ?? null;

  if (!candidate || typeof candidate !== 'object' || typeof candidate.id !== 'string') {
    return null;
  }

  return candidate as CreemInvoicePayload;
}

function isUniqueConstraintError(error: unknown): boolean {
  return typeof error === 'object' && error !== null && (error as { code?: string }).code === 'P2002';
}

function resolveActorEmail(request: any): string {
  const user = request.user || {};
  return (
    user.email ||
    user.email_address ||
    user.emailAddress ||
    user?.email_addresses?.[0]?.email_address ||
    user?.email_addresses?.[0]?.emailAddress ||
    'system@agency-access.local'
  );
}

export async function webhookRoutes(fastify: FastifyInstance) {

  fastify.get('/agencies/:id/webhook-endpoint', {
    onRequest: [authenticate(), requirePrincipalAgency],
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const principalAgencyId = (request as any).principalAgencyId as string;
    const accessError = assertAgencyAccess(id, principalAgencyId);

    if (accessError) {
      return reply.code(403).send({
        data: null,
        error: accessError,
      });
    }

    const result = await getWebhookEndpoint(id);
    if (result.error) {
      const statusCode =
        result.error.code === 'NOT_FOUND'
          ? 404
          : result.error.code === 'INTERNAL_ERROR'
          ? 500
          : 400;
      return reply.code(statusCode).send({
        data: null,
        error: result.error,
      });
    }

    return reply.send(result);
  });

  fastify.put('/agencies/:id/webhook-endpoint', {
    onRequest: [authenticate(), requirePrincipalAgency, quotaEnforcementMiddleware({ metric: 'templates' })],
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const principalAgencyId = (request as any).principalAgencyId as string;
    const accessError = assertAgencyAccess(id, principalAgencyId);

    if (accessError) {
      return reply.code(403).send({
        data: null,
        error: accessError,
      });
    }

    const body = request.body as {
      url: string;
      subscribedEvents: string[];
      preferredApiVersion?: string;
    };
    const actorEmail = resolveActorEmail(request);
    const existing = await getWebhookEndpoint(id);

    let preferredApiVersion: WebhookApiVersion | undefined;
    if (body.preferredApiVersion !== undefined) {
      const versionParsed = WebhookApiVersionSchema.safeParse(body.preferredApiVersion);
      if (!versionParsed.success) {
        return sendError(reply, 'VALIDATION_ERROR', 'Invalid preferredApiVersion', 400, versionParsed.error.flatten(),);
      }
      preferredApiVersion = versionParsed.data;
    }

    const result =
      existing.data && !existing.error
        ? await updateWebhookEndpoint({
            agencyId: id,
            url: body.url,
            subscribedEvents: body.subscribedEvents as any,
            preferredApiVersion,
            updatedBy: actorEmail,
          })
        : await createWebhookEndpoint({
            agencyId: id,
            url: body.url,
            subscribedEvents: body.subscribedEvents as any,
            preferredApiVersion,
            createdBy: actorEmail,
          });

    if (result.error) {
      const statusCode =
        result.error.code === 'WEBHOOK_ENDPOINT_EXISTS' ? 409 : 400;
      return reply.code(statusCode).send({
        data: null,
        error: result.error,
      });
    }

    return reply.send(result);
  });

  fastify.post('/agencies/:id/webhook-endpoint/rotate-secret', {
    onRequest: [authenticate(), requirePrincipalAgency],
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const principalAgencyId = (request as any).principalAgencyId as string;
    const accessError = assertAgencyAccess(id, principalAgencyId);

    if (accessError) {
      return reply.code(403).send({
        data: null,
        error: accessError,
      });
    }

    const result = await rotateWebhookEndpointSecret({
      agencyId: id,
      rotatedBy: resolveActorEmail(request),
    });

    if (result.error) {
      const statusCode = result.error.code === 'NOT_FOUND' ? 404 : 400;
      return reply.code(statusCode).send({
        data: null,
        error: result.error,
      });
    }

    return reply.send(result);
  });

  fastify.post('/agencies/:id/webhook-endpoint/disable', {
    onRequest: [authenticate(), requirePrincipalAgency],
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const principalAgencyId = (request as any).principalAgencyId as string;
    const accessError = assertAgencyAccess(id, principalAgencyId);

    if (accessError) {
      return reply.code(403).send({
        data: null,
        error: accessError,
      });
    }

    const result = await disableWebhookEndpoint({
      agencyId: id,
      disabledBy: resolveActorEmail(request),
    });

    if (result.error) {
      const statusCode = result.error.code === 'NOT_FOUND' ? 404 : 400;
      return reply.code(statusCode).send({
        data: null,
        error: result.error,
      });
    }

    return reply.send(result);
  });

  fastify.post('/agencies/:id/webhook-endpoint/test', {
    onRequest: [authenticate(), requirePrincipalAgency],
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const principalAgencyId = (request as any).principalAgencyId as string;
    const accessError = assertAgencyAccess(id, principalAgencyId);

    if (accessError) {
      return reply.code(403).send({
        data: null,
        error: accessError,
      });
    }

    const result = await sendWebhookTestEvent({
      agencyId: id,
      requestedBy: resolveActorEmail(request),
    });

    if (result.error) {
      const statusCode = result.error.code === 'NOT_FOUND'
        ? 404
        : result.error.code === 'ENDPOINT_DISABLED'
        ? 409
        : 400;
      return reply.code(statusCode).send({
        data: null,
        error: result.error,
      });
    }

    return reply.send(result);
  });

  fastify.get('/agencies/:id/webhook-deliveries', {
    onRequest: [authenticate(), requirePrincipalAgency],
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const { limit } = request.query as { limit?: string };
    const principalAgencyId = (request as any).principalAgencyId as string;
    const accessError = assertAgencyAccess(id, principalAgencyId);

    if (accessError) {
      return reply.code(403).send({
        data: null,
        error: accessError,
      });
    }

    const parsedLimit = Number.parseInt(limit || '20', 10);
    const result = await listWebhookDeliveries({
      agencyId: id,
      limit: Number.isFinite(parsedLimit) ? parsedLimit : 20,
    });

    if (result.error) {
      const statusCode = result.error.code === 'INTERNAL_ERROR' ? 500 : 400;
      return reply.code(statusCode).send({
        data: null,
        error: result.error,
      });
    }

    return reply.send(result);
  });

  /**
   * POST /api/webhooks/creem
   *
   * Handles Creem.io subscription webhooks.
   * Processes subscription creation, updates, and cancellations.
   *
   * Idempotent: Duplicate events are detected via audit log and ignored.
   */
  fastify.post('/webhooks/creem', { config: { rawBody: true } }, async (request, reply) => {
    const payload = request.body as CreemEvent;
    const signatureHeader =
      (request.headers['x-creem-signature'] as string | undefined) ||
      (request.headers['creem-signature'] as string | undefined);
    const rawBody = (request as any).rawBody;
    const payloadString = typeof rawBody === 'string' ? rawBody : JSON.stringify(payload ?? {});

    // Extract IP and user agent for security logging
    const ipAddress = (request.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim()
      || (request.headers['x-real-ip'] as string)
      || request.ip
      || 'unknown';
    const userAgent = request.headers['user-agent'] as string || 'unknown';

    if (!signatureHeader || !creem.verifyWebhookSignature(payloadString, signatureHeader)) {
      // Log invalid signature attempts for security monitoring
      try {
        await prisma.auditLog.create({
          data: {
            action: 'WEBHOOK_SIGNATURE_INVALID',
            resourceType: 'webhook',
            resourceId: payload?.id || 'unknown',
            metadata: {
              hasSignature: !!signatureHeader,
              eventType: payload?.type,
              ipAddress,
              userAgent,
              timestamp: new Date().toISOString(),
            },
          },
        });
      } catch (logError) {
        // Don't fail the request if logging fails
        fastify.log.warn({ error: logError }, 'Failed to log invalid webhook signature');
      }

      fastify.log.warn({
        ipAddress,
        userAgent,
        hasSignature: !!signatureHeader,
        eventType: payload?.type,
      }, 'Invalid webhook signature received');

      return reply.code(401).send({
        error: 'Invalid webhook signature',
      });
    }

    try {
      const webhookAction = `CREEM_WEBHOOK_${payload.type}`;
      const existingWebhookMarker = await prisma.auditLog.findFirst({
        where: {
          action: webhookAction,
          resourceId: payload.id,
          resourceType: 'creem_webhook_marker',
        },
      });

      if (existingWebhookMarker) {
        return { received: true, duplicate: true, id: existingWebhookMarker.id.toString() };
      }

      try {
        await prisma.auditLog.create({
          data: {
            action: webhookAction,
            resourceId: payload.id,
            resourceType: 'creem_webhook_marker',
            metadata: payload as any,
          },
        });
      } catch (error) {
        if (isUniqueConstraintError(error)) {
          return { received: true, duplicate: true };
        }
        throw error;
      }

      if (payload.type === 'invoice.paid') {
        const invoice = getInvoicePayload(payload);

        if (!invoice) {
          return reply.code(400).send({ error: 'Invalid invoice payload' });
        }

        await webhookService.processInvoicePaid(invoice);
      } else if (
        payload.type === 'invoice.payment_failed' ||
        payload.type === 'invoice.refunded' ||
        payload.type === 'invoice.voided'
      ) {
        const invoice = getInvoicePayload(payload);

        if (!invoice) {
          return reply.code(400).send({ error: 'Invalid invoice payload' });
        }

        await webhookService.processInvoicePaymentFailed(invoice);
      } else if (
        payload.type === 'subscription.created' ||
        payload.type === 'subscription.updated' ||
        payload.type === 'subscription.canceled'
      ) {
        const subscription = getSubscriptionPayload(payload);

        if (!subscription) {
          return reply.code(400).send({ error: 'Invalid subscription payload' });
        }

        // Use Creem config utility to map product ID to tier
        let tier: SubscriptionTier;
        try {
          tier = getTierFromProductId(subscription.price_id);
        } catch (err: any) {
          // Unknown product ID - log and skip
          fastify.log.warn({ priceId: subscription.price_id, error: err?.message || String(err) }, 'Unknown Creem product ID in webhook');
          return reply.code(400).send({ error: 'Unknown product ID' });
        }

        const agency = await prisma.agency.findFirst({
          where: {
            subscription: {
              creemCustomerId: subscription.customer_id,
            },
          },
          include: {
            subscription: true,
          },
        });

        if (agency?.clerkUserId) {
          // Check if subscription was expired and is now being reactivated
          const wasExpired = agency.subscription?.status === 'expired';
          const isNowActive = subscription.status === 'active' || subscription.status === 'trialing';

          // Log reactivation if this was an expired subscription now being paid
          if (wasExpired && isNowActive) {
            await prisma.auditLog.create({
              data: {
                action: 'SUBSCRIPTION_REACTIVATED',
                resourceType: 'subscription',
                resourceId: agency.subscription?.id || subscription.id,
                agencyId: agency.id,
                metadata: {
                  previousStatus: 'expired',
                  newStatus: subscription.status,
                  newTier: tier,
                  reactivatedAt: new Date().toISOString(),
                },
              },
            });
            fastify.log.info({
              agencyId: agency.id,
              subscriptionId: subscription.id,
              tier,
            }, 'Reactivated previously expired subscription');
          }

          // Independent writes — Clerk metadata, agency tier, and subscription
          // record don't depend on each other; run them concurrently.
          await Promise.all([
            clerkMetadataService.setSubscriptionTier(
              agency.clerkUserId,
              tier,
              {
                subscriptionId: subscription.id,
                subscriptionStatus: subscription.status,
                currentPeriodStart: new Date(subscription.current_period_start),
                currentPeriodEnd: new Date(subscription.current_period_end),
                trialEndsAt: subscription.trial_end ? new Date(subscription.trial_end) : undefined,
              }
            ),

            // Update agency subscription tier in database
            // Ensure agency.subscriptionTier is always set correctly
            prisma.agency.update({
              where: { id: agency.id },
              data: { subscriptionTier: tier },
            }),

            // Also update subscription record if it exists
            agency.subscription
              ? prisma.subscription.update({
                  where: { id: agency.subscription.id },
                  data: {
                    tier,
                    status: subscription.status,
                    currentPeriodStart: new Date(subscription.current_period_start),
                    currentPeriodEnd: new Date(subscription.current_period_end),
                    trialStart: subscription.trial_end ? null : new Date(),
                    trialEnd: subscription.trial_end ? new Date(subscription.trial_end) : null,
                    creemData: subscription as any,
                  },
                })
              : Promise.resolve(null),

            trackSubscriptionLifecycleFromWebhook({
              eventType: payload.type as 'subscription.created' | 'subscription.updated' | 'subscription.canceled',
              context: {
                distinctId: agency.clerkUserId,
                agencyId: agency.id,
                creemSubscriptionId: subscription.id,
                creemCustomerId: subscription.customer_id,
                creemPriceId: subscription.price_id,
                status: subscription.status,
              },
            }),
          ]);
        }
      }

      return { received: true, processed: true };
    } catch (error: any) {
      return reply.code(500).send({
        error: 'Webhook failed',
        details: error.message,
      });
    }
  });
}
