import { randomUUID } from 'node:crypto';
import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { auditService } from '../../services/audit.service.js';
import { oauthStateService } from '../../services/oauth-state.service.js';
import { getConnector, type PlatformConnector } from '../../services/connectors/factory.js';
import { infisical } from '../../lib/infisical.js';
import { prisma } from '../../lib/prisma.js';
import { env } from '../../lib/env.js';
import { type Platform } from '@agency-platform/shared';
import { oauthExchangeSchema } from './schemas.js';
import { sanitizeOAuthError } from '../../lib/errors.js';
import { sendError } from '../../lib/response.js';
import { readPendingSecretDeletionIds } from '../../lib/meta-authorization-metadata.js';
import { accessRequestService } from '../../services/access-request.service.js';
import { Prisma } from '@prisma/client';
import { isPlatformRequested } from './platform-request.js';

interface OAuthExchangeOptions {
  /**
   * Static endpoint (/client/oauth-exchange) has no token in the URL, so the
   * access request token MUST come from the OAuth state. The tokened endpoint
   * can fall back to the access request's uniqueToken.
   */
  requireStateToken: boolean;
}

/**
 * Snapchat identity lookup is best-effort. It must not fail the exchange: by
 * that point the Snap authorization code has already been consumed, so a
 * thrown identity error would 500 the flow and store no authorization.
 * Mirrors the agency callback (routes/agency-platforms/oauth.routes.ts),
 * which degrades the same failure into discoveryFailed metadata. Every other
 * platform keeps strict identity handling and rethrows.
 */
async function getUserInfoForExchange(
  platform: string,
  connector: PlatformConnector,
  accessToken: string
): Promise<any> {
  try {
    return await connector.getUserInfo(accessToken);
  } catch (error) {
    if (platform !== 'snapchat') {
      throw error;
    }
    console.error('Failed to fetch Snapchat organizations:', error);
    return {
      organizations: [],
      adAccountCount: 0,
      discoveryFailed: true,
    };
  }
}

function mergeAuthorizationMetadata(existing: unknown, current: unknown, platform: string) {
  const existingRecord = existing && typeof existing === 'object' && !Array.isArray(existing)
    ? existing as Record<string, unknown>
    : {};
  const currentRecord = current && typeof current === 'object' && !Array.isArray(current)
    ? current as Record<string, unknown>
    : {};
  const merged = { ...existingRecord, ...currentRecord };
  if (platform === 'meta' || platform === 'meta_ads' || platform === 'meta_pages' || platform === 'instagram') {
    delete merged.providerRevokedAt;
  }
  return merged;
}

function isMetaPlatform(platform: string): boolean {
  return platform === 'meta' || platform === 'meta_ads' || platform === 'meta_pages' || platform === 'instagram';
}

async function getAuthorizationMetadata(
  platform: string,
  connector: PlatformConnector,
  accessToken: string,
): Promise<Prisma.InputJsonObject> {
  const userInfo = await getUserInfoForExchange(platform, connector, accessToken);
  if (!isMetaPlatform(platform)) return userInfo as Prisma.InputJsonObject;

  if (!connector.getTokenMetadata) {
    throw new Error('Meta token inspection is not configured.');
  }
  const debug = await connector.getTokenMetadata(accessToken);
  if (!debug.isValid) {
    throw new Error('Meta token inspection reported an invalid token.');
  }

  return {
    ...(userInfo as Prisma.InputJsonObject),
    grantedScopes: [...new Set(debug.scopes)].sort(),
    tokenDebug: {
      checkedAt: new Date().toISOString(),
      isValid: debug.isValid,
      ...(debug.userId ? { userId: debug.userId } : {}),
      ...(debug.expiresAt ? { expiresAt: debug.expiresAt.toISOString() } : {}),
      ...(debug.dataAccessExpiresAt ? { dataAccessExpiresAt: debug.dataAccessExpiresAt.toISOString() } : {}),
    },
  };
}

function buildOAuthExchangeHandler(fastify: FastifyInstance, options: OAuthExchangeOptions) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const validated = oauthExchangeSchema.safeParse(request.body);
    if (!validated.success) {
      return sendError(reply, 'VALIDATION_ERROR', 'Invalid OAuth exchange data', 400, validated.error.errors,);
    }

    const { code, state, platform: platformFromRequest } = validated.data;

    const stateResult = await oauthStateService.validateState(state);
    if (stateResult.error || !stateResult.data) {
      return sendError(reply, 'INVALID_STATE', 'Invalid or expired OAuth state token', 400);
    }

    const stateData = stateResult.data;
    const platform = stateData.platform;

    if (platformFromRequest && platformFromRequest !== platform) {
      return sendError(reply, 'PLATFORM_MISMATCH', 'Platform does not match OAuth state', 400);
    }

    if (options.requireStateToken && !stateData.accessRequestToken) {
      return sendError(reply, 'MISSING_TOKEN', 'Access request token not found in OAuth state', 400);
    }

    try {
      const redirectUri = stateData.redirectUrl || `${env.FRONTEND_URL}/invite/oauth-callback`;

      const accessRequest = await prisma.accessRequest.findUnique({
        where: { id: stateData.accessRequestId! },
      });

      if (!accessRequest) {
        return sendError(reply, 'ACCESS_REQUEST_NOT_FOUND', 'Access request not found', 404);
      }

      if (accessRequest.status === 'revoked') {
        return sendError(reply, 'REQUEST_REVOKED', 'Access request has been revoked', 404);
      }

      if (accessRequest.status === 'expired' || accessRequest.expiresAt < new Date()) {
        return sendError(reply, 'REQUEST_EXPIRED', 'Access request has expired', 404);
      }

      if (!isPlatformRequested(accessRequest.platforms, platform)) {
        return sendError(
          reply,
          'PLATFORM_NOT_REQUESTED',
          'Platform was not requested in this access request',
          400
        );
      }

      const connector = getConnector(platform as Platform);
      const [exchanged, existingConnection] = await Promise.all([
        (async () => {
          let tokens = await connector.exchangeCode(code, redirectUri);

          if (isMetaPlatform(platform) && connector.getLongLivedToken) {
            tokens = await connector.getLongLivedToken(tokens.accessToken);
          }

          const userInfo = await getAuthorizationMetadata(platform, connector, tokens.accessToken);
          return { tokens, userInfo };
        })(),
        prisma.clientConnection.findFirst({
          where: { accessRequestId: stateData.accessRequestId! },
        }),
      ]);

      let clientConnection = existingConnection;

      if (!clientConnection) {
        try {
          clientConnection = await prisma.clientConnection.create({
            data: {
              accessRequestId: stateData.accessRequestId!,
              agencyId: accessRequest.agencyId,
              clientEmail: stateData.clientEmail!,
              status: 'active',
            },
          });
        } catch (error) {
          if ((error as { code?: unknown })?.code !== 'P2002') throw error;
          clientConnection = await prisma.clientConnection.findFirst({
            where: { accessRequestId: stateData.accessRequestId! },
          });
          if (!clientConnection) throw error;
        }
      }

      const existingAuthorization = await prisma.platformAuthorization.findUnique({
        where: {
          connectionId_platform: {
            connectionId: clientConnection.id,
            platform: platform as Platform,
          },
        },
      });
      const isMetaAuthorization = isMetaPlatform(platform);
      const secretBase = infisical.generateSecretName(platform as Platform, clientConnection.id);
      const nextEpoch = (existingAuthorization?.authorizationEpoch ?? 1) + 1;
      const secretName = isMetaAuthorization && existingAuthorization
        ? `${secretBase}_epoch_${nextEpoch}_${randomUUID()}`
        : secretBase;

      await infisical.storeOAuthTokens(secretName, {
        accessToken: exchanged.tokens.accessToken,
        refreshToken: exchanged.tokens.refreshToken,
        expiresAt: exchanged.tokens.expiresAt,
      });

      const authorizationWrite = {
        where: {
          connectionId_platform: {
            connectionId: clientConnection.id,
            platform: platform as Platform,
          },
        },
        update: {
          secretId: secretName,
          expiresAt: exchanged.tokens.expiresAt,
          status: 'active',
          authorizationEpoch: { increment: 1 },
          metadata: (isMetaAuthorization
            ? {
                ...mergeAuthorizationMetadata(existingAuthorization?.metadata, exchanged.userInfo, platform),
                pendingSecretDeletion: [
                  ...new Set([
                    ...readPendingSecretDeletionIds(existingAuthorization?.metadata),
                    ...(existingAuthorization?.secretId && existingAuthorization.secretId !== secretName
                      ? [existingAuthorization.secretId]
                      : []),
                  ]),
                ],
              }
            : mergeAuthorizationMetadata(existingAuthorization?.metadata, exchanged.userInfo, platform)) as Prisma.InputJsonValue,
        },
        create: {
          connectionId: clientConnection.id,
          platform: platform as Platform,
          secretId: secretName,
          expiresAt: exchanged.tokens.expiresAt,
          status: 'active',
          metadata: exchanged.userInfo,
        },
      } satisfies Prisma.PlatformAuthorizationUpsertArgs;
      let platformAuth;
      let reauthorizationMetadata = authorizationWrite.update.metadata;
      try {
        platformAuth = isMetaAuthorization && existingAuthorization
          ? await prisma.$transaction(async (tx) => {
              await tx.$queryRaw(Prisma.sql`
                SELECT id
                FROM "platform_authorizations"
                WHERE id = ${existingAuthorization.id}
                FOR UPDATE
              `);
              const currentAuthorization = await tx.platformAuthorization.findUnique({
                where: { id: existingAuthorization.id },
              });
              if (!currentAuthorization) throw new Error('Meta authorization disappeared during reauthorization');

              reauthorizationMetadata = {
                ...mergeAuthorizationMetadata(currentAuthorization.metadata, exchanged.userInfo, platform),
                pendingSecretDeletion: [...new Set([
                  ...readPendingSecretDeletionIds(currentAuthorization.metadata),
                  ...(currentAuthorization.secretId !== secretName ? [currentAuthorization.secretId] : []),
                ])],
              } as Prisma.InputJsonValue;
              const authorization = await tx.platformAuthorization.upsert({
                ...authorizationWrite,
                update: {
                  ...authorizationWrite.update,
                  metadata: reauthorizationMetadata,
                },
              });
              await tx.metaAssetGrant.updateMany({
                where: { authorizationId: currentAuthorization.id, status: 'verified' },
                data: {
                  status: 'stale',
                  nextActor: 'client_admin',
                  lastErrorCode: 'AUTHORIZATION_REPLACED',
                  lastErrorMessage: 'Client Meta authorization was replaced and must be verified again',
                },
              });
              return authorization;
            })
          : await prisma.platformAuthorization.upsert(authorizationWrite);
      } catch (error) {
        if (isMetaAuthorization && existingAuthorization) {
          try {
            await infisical.deleteSecret(secretName);
          } catch (cleanupError) {
            // The authorization epoch did not advance. A retry uses this same
            // deterministic secret name and overwrites any orphaned value.
            console.warn(`[Meta OAuth] Failed to remove uncommitted token secret ${secretName}:`, cleanupError);
          }
        }
        throw error;
      }

      if (isMetaAuthorization && existingAuthorization && existingAuthorization.secretId !== secretName) {
        const pending = readPendingSecretDeletionIds(reauthorizationMetadata);
        const remaining: string[] = [];
        for (const secretId of pending) {
          try {
            await infisical.deleteSecret(secretId);
          } catch (error) {
            console.warn(`[Meta OAuth] Old token secret cleanup will retry for ${secretId}:`, error);
            remaining.push(secretId);
          }
        }
        const deletedSecretIds = new Set(pending.filter((secretId) => !remaining.includes(secretId)));
        if (deletedSecretIds.size > 0) {
          await prisma.$transaction(async (tx) => {
            await tx.$queryRaw(Prisma.sql`
              SELECT id
              FROM "platform_authorizations"
              WHERE id = ${platformAuth.id}
              FOR UPDATE
            `);
            const currentAuthorization = await tx.platformAuthorization.findUnique({
              where: { id: platformAuth.id },
            });
            if (!currentAuthorization) return;

            const currentMetadata = (currentAuthorization.metadata || {}) as Record<string, unknown>;
            const currentPending = readPendingSecretDeletionIds(currentMetadata);
            await tx.platformAuthorization.update({
              where: { id: platformAuth.id },
              data: {
                metadata: {
                  ...currentMetadata,
                  pendingSecretDeletion: currentPending.filter((secretId) => !deletedSecretIds.has(secretId)),
                } as Prisma.InputJsonValue,
              },
            });
          });
        }
      }

      if (isMetaAuthorization && existingAuthorization) {
        const lifecycle = await accessRequestService.markRequestAuthorized(accessRequest.id);
        if (lifecycle.error) {
          fastify.log.error(
            { accessRequestId: accessRequest.id, errorCode: lifecycle.error.code },
            'Failed to recalculate access request status after Meta reauthorization'
          );
          if (lifecycle.error.code === 'INTERNAL_ERROR') {
            const partial = await accessRequestService.setAccessRequestLifecycleStatus(accessRequest.id, 'partial');
            if (partial.error) {
              fastify.log.error(
                { accessRequestId: accessRequest.id, errorCode: partial.error.code },
                'Failed to reopen completed access request after Meta reauthorization'
              );
            }
          }
        }
      }

      await auditService.createAuditLog({
        agencyId: accessRequest.agencyId,
        action: 'CLIENT_AUTHORIZED',
        userEmail: stateData.clientEmail!,
        resourceType: 'client_connection',
        resourceId: clientConnection.id,
        metadata: {
          platform,
          accessRequestId: stateData.accessRequestId!,
          platformAuthId: platformAuth.id,
        },
      });

      if (platform === 'tiktok' || platform === 'tiktok_ads') {
        await auditService.createAuditLog({
          agencyId: accessRequest.agencyId,
          action: 'TIKTOK_TOKEN_EXCHANGED',
          userEmail: stateData.clientEmail!,
          resourceType: 'client_connection',
          resourceId: clientConnection.id,
          metadata: {
            platform,
            platformAuthId: platformAuth.id,
          },
          request,
        });
      }

      // requireStateToken guarantees accessRequestToken is set for the static
      // endpoint, so the fallback only ever applies to the tokened endpoint.
      return reply.send({
        data: {
          connectionId: clientConnection.id,
          platform,
          token: stateData.accessRequestToken || accessRequest.uniqueToken,
        },
        error: null,
      });
    } catch (error) {
      const sanitized = sanitizeOAuthError(error);
      fastify.log.error(
        {
          errorName: error instanceof Error ? error.name : 'UnknownError',
          errorCode: sanitized.code,
        },
        'OAuth exchange failed'
      );
      return reply.code(500).send({
        data: null,
        error: sanitized,
      });
    }
  };
}

export async function registerOAuthExchangeRoutes(fastify: FastifyInstance) {
  // Exchange OAuth code for temporary session (token in path)
  fastify.post(
    '/client/:token/oauth-exchange',
    buildOAuthExchangeHandler(fastify, { requireStateToken: false })
  );

  // Static OAuth exchange endpoint (token extracted from state)
  fastify.post(
    '/client/oauth-exchange',
    buildOAuthExchangeHandler(fastify, { requireStateToken: true })
  );
}
