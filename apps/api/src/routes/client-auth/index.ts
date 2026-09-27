import { FastifyInstance } from 'fastify';
import { registerOAuthStateRoutes } from './oauth-state.routes.js';
import { registerOAuthExchangeRoutes } from './oauth-exchange.routes.js';
import { registerAssetRoutes } from './assets.routes.js';
import { registerIntakeRoutes } from './intake.routes.js';
import { registerCompletionRoutes } from './completion.routes.js';
import { registerManualRoutes } from './manual.routes.js';
import { registerAssetCreationRoutes } from './asset-creation.routes.js';

export async function clientAuthRoutes(fastify: FastifyInstance) {
  await registerOAuthStateRoutes(fastify);
  await registerOAuthExchangeRoutes(fastify);
  await registerAssetRoutes(fastify);
  await registerIntakeRoutes(fastify);
  await registerCompletionRoutes(fastify);
  await registerManualRoutes(fastify);
  await registerAssetCreationRoutes(fastify);
}
