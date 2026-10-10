// Import Sentry instrumentation FIRST (before any other modules)
import "./instrument.js";
import * as Sentry from "@sentry/node";

import Fastify, { type FastifyRequest } from 'fastify';
import cors from '@fastify/cors';
import compress from '@fastify/compress';
import rateLimit, { type errorResponseBuilderContext } from '@fastify/rate-limit';
import helmet from '@fastify/helmet';
import fastifyRawBody from 'fastify-raw-body';
import { env } from './lib/env.js';
import { getCorsOptions } from './lib/cors.js';
import { authenticate, optionalAuthenticate } from './middleware/auth.js';
import { extractClientIp } from './lib/ip.js';
import { agencyRoutes } from './routes/agencies.js';
import { accessRequestRoutes } from './routes/access-requests.js';
import { tokenHealthRoutes } from './routes/token-health.js';
import { clientAuthRoutes } from './routes/client-auth.js';
import { templateRoutes } from './routes/templates.js';
import { platformAuthorizationRoutes } from './routes/platform-authorization.js';
import { clientRoutes } from './routes/clients.js';
import { agencyPlatformsRoutes } from './routes/agency-platforms.js';
import { dashboardRoutes } from './routes/dashboard.js';
import { usageRoutes } from './routes/usage.js';
import { webhookRoutes } from './routes/webhooks.js';
import { beehiivRoutes } from './routes/beehiiv.js';
import { subscriptionRoutes } from './routes/subscriptions.js';
import { internalAdminRoutes } from './routes/internal-admin.routes.js';
import { quotaRoutes } from './routes/quota.routes';
import { contactRoutes } from './routes/contact.js';
import { helpScoutRoutes } from './routes/help-scout.js';
import { affiliateRoutes } from './routes/affiliate.js';
import { sentryWebhooksRoutes } from './routes/sentry-webhooks.js';
import { sentryTestRoutes } from './routes/sentry-test.routes.js';
import { agentGrantRoutes } from './routes/agent-grants.js';
import { agentOperationRoutes } from './routes/agent-operations.js';
import { clientOffboardingRoutes } from './routes/client-offboarding.routes.js';
import { apiKeyRoutes } from './routes/api-keys.js';
import { v1Routes } from './routes/v1.js';
import { mcpRoutes } from './routes/mcp.js';
import { performanceOnRequest, performanceOnSend } from './middleware/performance.js';
import { shouldSkipGlobalLimiter } from './middleware/v1-gate.js';
import { prisma } from './lib/prisma.js';
import { redactSensitiveString } from './lib/sentry-redaction.js';

const trustProxy = env.TRUST_PROXY_IPS.length > 0 ? env.TRUST_PROXY_IPS : false;

function buildAuthenticatedRateLimitAllowList() {
  return async (request: FastifyRequest, _key: string): Promise<boolean> => {
    // v1 traffic is owned by the per-key limiter — never double-count it here.
    if (shouldSkipGlobalLimiter(request.url)) return true;
    return Boolean((request as FastifyRequest & { user?: unknown }).user);
  };
}

const fastify = Fastify({
  trustProxy,
  logger: {
    level: env.LOG_LEVEL || 'info',
    serializers: {
      req(request) {
        const version = request.headers['accept-version'];
        return {
          method: request.method,
          url: redactSensitiveString(request.url),
          version: Array.isArray(version) ? version[0] : version,
          host: request.host,
          remoteAddress: request.ip,
          remotePort: request.socket?.remotePort,
        };
      },
    },
    transport: env.NODE_ENV === 'development' ? {
      target: 'pino-pretty',
      options: {
        translateTime: 'HH:MM:ss Z',
        ignore: 'pid,hostname',
      },
    } : undefined,
  },
});

// Register plugins
await fastify.register(
  cors,
  getCorsOptions(env.FRONTEND_URL, env.CORS_ALLOWED_ORIGINS, {
    allowVercelPreviews: env.CORS_ALLOW_VERCEL_PREVIEWS,
    previewOrigins: env.CORS_PREVIEW_ORIGINS,
  })
);
await fastify.register(fastifyRawBody, {
  field: 'rawBody',
  global: false,
  encoding: 'utf8',
  runFirst: true,
});

// Register compression middleware
await fastify.register(compress, {
  encodings: ['gzip', 'deflate', 'br'],
  threshold: 1024, // Only compress responses larger than 1KB
});

// Register performance monitoring middleware before auth/rate-limit hooks.
fastify.addHook('onRequest', performanceOnRequest);
fastify.addHook('onSend', performanceOnSend);

// Register rate limiting middleware (prevents DoS/brute force attacks)
if (env.RATE_LIMIT_ENABLED) {
  if (env.RATE_LIMIT_SKIP_AUTHENTICATED) {
    fastify.addHook('onRequest', optionalAuthenticate());
  }

  await fastify.register(rateLimit, {
    global: true,
    max: env.RATE_LIMIT_MAX_REQUESTS,
    timeWindow: env.RATE_LIMIT_TIME_WINDOW_SECONDS * 1000,
    skipOnError: true,
    allowList: env.RATE_LIMIT_SKIP_AUTHENTICATED
      ? buildAuthenticatedRateLimitAllowList()
      : async (request: FastifyRequest, _key: string) =>
          shouldSkipGlobalLimiter(request.url),
    keyGenerator: (request: FastifyRequest) => {
      // Use IP address as rate limit key
      return extractClientIp(request);
    },
    errorResponseBuilder: (_request: FastifyRequest, context: errorResponseBuilderContext) => ({
      data: null,
      error: {
        code: 'RATE_LIMIT_EXCEEDED',
        message: 'Too many requests. Please try again later.',
        details: {
          limit: context.max,
          reset: new Date(Date.now() + context.ttl).toISOString(),
        },
      },
    }),
  });
}

// Register security headers middleware
await fastify.register(helmet, {
  contentSecurityPolicy: false, // Disabled for OAuth compatibility
  hsts: {
    maxAge: 31536000, // 1 year
    includeSubDomains: true,
    preload: true,
  },
  frameguard: {
    action: 'deny',
  },
  xssFilter: true,
  noSniff: true,
  referrerPolicy: {
    policy: 'strict-origin-when-cross-origin',
  },
});

// Custom error handler: return our standard { error: { code, message } } format
// so frontend always gets a parseable error.message
fastify.setErrorHandler((error: unknown, _request, reply) => {
  const err = error as { statusCode?: number; code?: string; message?: string };
  const statusCode = err.statusCode ?? 500;
  const message = err?.message || 'An unexpected error occurred';

  // Capture 500 errors in Sentry (4xx are client errors, don't need tracking)
  if (statusCode >= 500 && process.env.SENTRY_DSN) {
    Sentry.captureException(error);
  }

  void reply.code(statusCode).send({
    data: null,
    error: {
      code: err?.code || 'INTERNAL_ERROR',
      message,
    },
  });
});

// Note: JWT verification is now handled in the authenticate() middleware
// using Clerk's backend SDK which properly handles RS256 tokens

// Register routes
await fastify.register(agencyRoutes, { prefix: '/api' });
await fastify.register(accessRequestRoutes, { prefix: '/api' });
await fastify.register(tokenHealthRoutes, { prefix: '/api' });
await fastify.register(clientAuthRoutes, { prefix: '/api' });
await fastify.register(templateRoutes, { prefix: '/api' });
await fastify.register(platformAuthorizationRoutes, { prefix: '/api' });
await fastify.register(clientRoutes, { prefix: '/api' });
await fastify.register(dashboardRoutes, { prefix: '/api' });
await fastify.register(usageRoutes, { prefix: '/api' });
await fastify.register(webhookRoutes, { prefix: '/api' });
await fastify.register(agencyPlatformsRoutes);
await fastify.register(beehiivRoutes);
await fastify.register(subscriptionRoutes, { prefix: '/api' });
await fastify.register(internalAdminRoutes, { prefix: '/api' });
const { reviewDemoRoutes } = await import('./routes/review-demo.routes.js');
await fastify.register(reviewDemoRoutes, { prefix: '/api' });
await fastify.register(quotaRoutes, { prefix: '/api' });
await fastify.register(contactRoutes);
await fastify.register(helpScoutRoutes, { prefix: '/api' });
await fastify.register(affiliateRoutes, { prefix: '/api' });
await fastify.register(sentryWebhooksRoutes, { prefix: '/api' });
await fastify.register(sentryTestRoutes); // No prefix - routes handle their own paths
await fastify.register(agentGrantRoutes, { prefix: '/api' });
await fastify.register(agentOperationRoutes, { prefix: '/api' });
await fastify.register(clientOffboardingRoutes, { prefix: '/api' });
await fastify.register(apiKeyRoutes, { prefix: '/api' });
await fastify.register(v1Routes, { prefix: '/api/v1' });
if (env.AGENT_NATIVE_ENABLED) {
  await fastify.register(mcpRoutes);
}

// Health check and root routes
fastify.get('/health', async () => {
  return { status: 'ok', timestamp: new Date().toISOString() };
});

// Performance monitoring endpoint (requires authentication)
fastify.get('/performance-stats', {
  onRequest: [authenticate()],
}, async () => {
  const { getPerformanceStats } = await import('./middleware/performance.js');
  return getPerformanceStats();
});

fastify.get('/', async () => {
  return {
    name: 'Agency Access Platform API',
    version: '0.1.0',
    status: 'running',
    documentation: '/health'
  };
});

// Start server
const start = async () => {
  try {
    await prisma.$connect();

    if (env.NODE_ENV === 'production') {
      const { assertWebhookSchemaReady } = await import('./lib/webhook-schema-readiness.js');
      await assertWebhookSchemaReady();
      fastify.log.info('webhook schema readiness check passed');
      if (env.AGENT_NATIVE_ENABLED) {
        const { assertAgentSchemaReady } = await import('./lib/agent-schema-readiness.js');
        await assertAgentSchemaReady();
        fastify.log.info('agent schema readiness check passed');
      }
    }

    // Start pg-boss job handlers
    const startJobHandlers = async () => {
      try {
        const { getPgBoss, scheduleJob, ensureAllQueues } = await import('./lib/pg-boss.js');
        const { startAllHandlers, scheduleRecurringJobs } = await import('./lib/job-handlers.js');

        // Initialize pg-boss (creates schema if needed)
        await getPgBoss();

        // Create all queues BEFORE registering handlers
        // pg-boss requires queues to exist before work() can be called
        await ensureAllQueues();

        // Start all job handlers
        await startAllHandlers();

        // Schedule recurring jobs
        await scheduleRecurringJobs();

        // Add OAuth/PKCE cleanup job (runs every hour)
        await scheduleJob('cleanup-expired-requests', '0 * * * *', { type: 'delete-expired-requests' });

        fastify.log.info('pg-boss job handlers started');
      } catch (error) {
        fastify.log.error({ error }, 'Failed to start pg-boss job handlers');
        throw error;
      }
    };

    if (env.BACKGROUND_WORKERS_ENABLED) {
      await startJobHandlers();
    } else {
      fastify.log.info(
        'Background workers disabled (BACKGROUND_WORKERS_ENABLED=false). Job processing disabled.'
      );
    }

    await fastify.listen({
      port: env.PORT,
      host: '0.0.0.0',
    });
    fastify.log.info(`Server listening on port ${env.PORT}`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

// Graceful shutdown
const gracefulShutdown = async (signal: string) => {
  fastify.log.info(`Received ${signal}, starting graceful shutdown...`);

  try {
    // Stop pg-boss
    const { stopPgBoss } = await import('./lib/pg-boss.js');
    await stopPgBoss();

    // Stop cache cleanup
    const { stopCache } = await import('./lib/cache.js');
    stopCache();

    // Close Fastify
    await fastify.close();

    // Disconnect Prisma
    await prisma.$disconnect();

    fastify.log.info('Graceful shutdown complete');
    process.exit(0);
  } catch (error) {
    fastify.log.error({ error }, 'Error during graceful shutdown');
    process.exit(1);
  }
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

start();
