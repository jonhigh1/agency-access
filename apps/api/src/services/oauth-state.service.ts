/**
 * OAuth State Service
 *
 * Manages OAuth state tokens for CSRF protection during OAuth flows.
 * State tokens are stored in Postgres with 10-minute expiry and are single-use.
 *
 * Security enhancements:
 * - HMAC SHA-256 signatures prevent state token tampering
 * - Single-use tokens prevent replay attacks
 * - Automatic expiration limits attack window
 */

import { randomBytes, createHmac, timingSafeEqual } from 'crypto';
import { prisma } from '@/lib/prisma';
import { env } from '@/lib/env.js';
import { logger } from '@/lib/logger.js';

export interface OAuthState {
  agencyId: string;
  platform: string;
  userEmail: string;
  redirectUrl?: string;
  timestamp: number;
  // For client authorization flows
  accessRequestId?: string;
  accessRequestToken?: string; // Unique token for the access request link
  clientEmail?: string;
  // For platform-specific parameters (e.g., Shopify shop name)
  shop?: string;
  [key: string]: any; // Allow other platform-specific params
}

const STATE_EXPIRY_SECONDS = 600; // 10 minutes
const STATE_MAX_AGE_MS = 10 * 60 * 1000; // 10 minutes in milliseconds

export interface OAuthStateWithSignature extends OAuthState {
  signature?: string;
}

const STATELESS_TOKEN_PREFIX = 'stateless';

function encodeStatelessStateToken(stateData: OAuthState): string {
  const payload = Buffer.from(JSON.stringify(stateData)).toString('base64url');
  const signature = signStateToken(payload);
  return `${STATELESS_TOKEN_PREFIX}.${payload}.${signature}`;
}

function decodeStatelessStateToken(stateToken: string): OAuthState | null {
  const [prefix, payload, signature] = stateToken.split('.');
  if (prefix !== STATELESS_TOKEN_PREFIX || !payload || !signature) {
    return null;
  }

  if (!verifyStateSignature(payload, signature)) {
    return null;
  }

  try {
    return JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as OAuthState;
  } catch {
    return null;
  }
}

/**
 * Generate HMAC SHA-256 signature for state token
 * Prevents tampering with state data
 */
function signStateToken(stateToken: string): string {
  const hmac = createHmac('sha256', env.OAUTH_STATE_HMAC_SECRET);
  hmac.update(stateToken);
  return hmac.digest('hex');
}

/**
 * Verify HMAC signature for state token
 * Uses timingSafeEqual to prevent timing attacks
 */
function verifyStateSignature(stateToken: string, signature: string): boolean {
  const expectedSignature = signStateToken(stateToken);
  try {
    return timingSafeEqual(
      Buffer.from(signature, 'hex'),
      Buffer.from(expectedSignature, 'hex')
    );
  } catch {
    return false;
  }
}

/**
 * Create a new OAuth state token
 * Stores state data in Postgres with 10-minute expiry and HMAC signature
 */
async function createState(
  stateData: OAuthState
): Promise<{ data: string | null; error: { code: string; message?: string } | null }> {
  try {
    // Generate random state token
    const stateToken = randomBytes(32).toString('hex');

    // Generate HMAC signature
    const signature = signStateToken(stateToken);

    // Calculate expiry time
    const expiresAt = new Date(Date.now() + STATE_EXPIRY_SECONDS * 1000);

    // Store in Postgres
    await prisma.oAuthStateToken.create({
      data: {
        stateToken,
        agencyId: stateData.agencyId,
        platform: stateData.platform,
        userEmail: stateData.userEmail,
        redirectUrl: stateData.redirectUrl,
        accessRequestId: stateData.accessRequestId,
        accessRequestToken: stateData.accessRequestToken,
        clientEmail: stateData.clientEmail,
        shop: stateData.shop,
        metadata: stateData,
        signature,
        timestamp: BigInt(stateData.timestamp),
        expiresAt,
      },
    });

    return { data: stateToken, error: null };
  } catch (error) {
    const errorWithCode = error as Error & { code?: string };
    const errorMeta =
      error instanceof Error
        ? {
            name: error.name,
            message: error.message,
            stack: error.stack,
            ...(typeof errorWithCode.code === 'string'
              ? { code: errorWithCode.code }
              : {}),
          }
        : { message: String(error) };

    logger.error('OAuth state creation failed', {
      error: errorMeta,
    });

    if (process.env.NODE_ENV === 'production') {
      return {
        data: null,
        error: {
          code: 'STATE_STORAGE_UNAVAILABLE',
          message: 'Unable to create durable OAuth state token',
        },
      };
    }

    // Fallback to stateless token if database fails outside production.
    const fallbackToken = encodeStatelessStateToken(stateData);
    logger.warn('Falling back to stateless OAuth state token', {
      platform: stateData.platform,
      agencyId: stateData.agencyId,
    });

    return { data: fallbackToken, error: null };
  }
}

/**
 * Read OAuth state without consuming (for routing hints before exchange).
 */
async function peekState(
  stateToken: string
): Promise<{ data: OAuthState | null; error: { code: string; message?: string } | null }> {
  try {
    if (!stateToken || stateToken.trim() === '') {
      return {
        data: null,
        error: {
          code: 'INVALID_STATE_TOKEN',
          message: 'State token cannot be empty',
        },
      };
    }

    const statelessStateData = decodeStatelessStateToken(stateToken);
    if (statelessStateData) {
      if (process.env.NODE_ENV === 'production') {
        return {
          data: null,
          error: {
            code: 'STATE_STORAGE_REQUIRED',
            message: 'Durable OAuth state storage is required in production',
          },
        };
      }

      const age = Date.now() - statelessStateData.timestamp;
      if (age > STATE_MAX_AGE_MS) {
        return {
          data: null,
          error: {
            code: 'STATE_EXPIRED',
            message: 'State token has expired',
          },
        };
      }

      return { data: statelessStateData, error: null };
    }

    const stateRecord = await prisma.oAuthStateToken.findUnique({
      where: { stateToken },
    });

    if (!stateRecord) {
      return { data: null, error: null };
    }

    if (stateRecord.consumedAt) {
      return {
        data: null,
        error: {
          code: 'STATE_ALREADY_CONSUMED',
          message: 'State token has already been used',
        },
      };
    }

    if (stateRecord.expiresAt < new Date()) {
      return {
        data: null,
        error: {
          code: 'STATE_EXPIRED',
          message: 'State token has expired',
        },
      };
    }

    if (!stateRecord.signature || !verifyStateSignature(stateToken, stateRecord.signature)) {
      return {
        data: null,
        error: {
          code: 'INVALID_STATE_SIGNATURE',
          message: 'State token signature verification failed',
        },
      };
    }

    const age = Date.now() - Number(stateRecord.timestamp);
    if (age > STATE_MAX_AGE_MS) {
      return {
        data: null,
        error: {
          code: 'STATE_EXPIRED',
          message: 'State token has expired',
        },
      };
    }

    const stateData: OAuthState = {
      agencyId: stateRecord.agencyId ?? '',
      platform: stateRecord.platform,
      userEmail: stateRecord.userEmail ?? '',
      redirectUrl: stateRecord.redirectUrl ?? undefined,
      timestamp: Number(stateRecord.timestamp),
      accessRequestId: stateRecord.accessRequestId ?? undefined,
      accessRequestToken: stateRecord.accessRequestToken ?? undefined,
      clientEmail: stateRecord.clientEmail ?? undefined,
      shop: stateRecord.shop ?? undefined,
      ...(stateRecord.metadata as Record<string, unknown> ?? {}),
    };

    return { data: stateData, error: null };
  } catch (error) {
    logger.error('OAuth state peek failed', {
      error: error instanceof Error ? error.message : String(error),
    });
    return {
      data: null,
      error: {
        code: 'STATE_PEEK_FAILED',
        message: 'Failed to read OAuth state token',
      },
    };
  }
}

/**
 * Validate and consume OAuth state token (one-time use)
 * Returns state data if valid, null if invalid or expired
 *
 * Security checks:
 * - HMAC signature verification
 * - Token presence in database
 * - Required fields validation
 * - Timestamp age validation
 * - Single-use via consumedAt field
 */
async function validateState(
  stateToken: string
): Promise<{ data: OAuthState | null; error: { code: string; message?: string } | null }> {
  try {
    // Validate token is not empty
    if (!stateToken || stateToken.trim() === '') {
      return {
        data: null,
        error: {
          code: 'INVALID_STATE_TOKEN',
          message: 'State token cannot be empty',
        },
      };
    }

    // Check for stateless token (fallback mode)
    const statelessStateData = decodeStatelessStateToken(stateToken);
    if (statelessStateData) {
      if (process.env.NODE_ENV === 'production') {
        return {
          data: null,
          error: {
            code: 'STATE_STORAGE_REQUIRED',
            message: 'Durable OAuth state storage is required in production',
          },
        };
      }

      const age = Date.now() - statelessStateData.timestamp;

      if (age > STATE_MAX_AGE_MS) {
        return {
          data: null,
          error: {
            code: 'STATE_EXPIRED',
            message: 'State token has expired',
          },
        };
      }

      return { data: statelessStateData, error: null };
    }

    // Find the state token in database
    const stateRecord = await prisma.oAuthStateToken.findUnique({
      where: { stateToken },
    });

    // Token not found (expired, already used, or never existed)
    if (!stateRecord) {
      return { data: null, error: null };
    }

    // Check if already consumed (single-use)
    if (stateRecord.consumedAt) {
      return {
        data: null,
        error: {
          code: 'STATE_ALREADY_CONSUMED',
          message: 'State token has already been used',
        },
      };
    }

    // Check if expired
    if (stateRecord.expiresAt < new Date()) {
      return {
        data: null,
        error: {
          code: 'STATE_EXPIRED',
          message: 'State token has expired',
        },
      };
    }

    // Verify HMAC signature (prevents tampering)
    if (!stateRecord.signature || !verifyStateSignature(stateToken, stateRecord.signature)) {
      return {
        data: null,
        error: {
          code: 'INVALID_STATE_SIGNATURE',
          message: 'State token signature verification failed',
        },
      };
    }

    // Atomic consume: set consumedAt if not already set
    // This prevents race conditions where two requests try to use the same token
    const updated = await prisma.oAuthStateToken.updateMany({
      where: {
        stateToken,
        consumedAt: null, // Only update if not already consumed
      },
      data: {
        consumedAt: new Date(),
      },
    });

    // If no rows updated, token was consumed by another request
    if (updated.count === 0) {
      return {
        data: null,
        error: {
          code: 'STATE_ALREADY_CONSUMED',
          message: 'State token has already been used',
        },
      };
    }

    // Validate required fields
    // For agency flows: agencyId, platform, userEmail required
    // For client flows: accessRequestId, platform, clientEmail required
    const isAgencyFlow = !!stateRecord.agencyId && !!stateRecord.userEmail;
    const isClientFlow = !!stateRecord.accessRequestId && !!stateRecord.clientEmail;

    if (!stateRecord.platform || !stateRecord.timestamp || (!isAgencyFlow && !isClientFlow)) {
      return {
        data: null,
        error: {
          code: 'INVALID_STATE_DATA',
          message: 'State data is missing required fields',
        },
      };
    }

    // Validate timestamp (prevent replay attacks)
    const now = Date.now();
    const age = now - Number(stateRecord.timestamp);

    if (age > STATE_MAX_AGE_MS) {
      return {
        data: null,
        error: {
          code: 'STATE_EXPIRED',
          message: 'State token has expired',
        },
      };
    }

    // Build state object from database record
    const stateData: OAuthState = {
      agencyId: stateRecord.agencyId ?? '',
      platform: stateRecord.platform,
      userEmail: stateRecord.userEmail ?? '',
      redirectUrl: stateRecord.redirectUrl ?? undefined,
      timestamp: Number(stateRecord.timestamp),
      accessRequestId: stateRecord.accessRequestId ?? undefined,
      accessRequestToken: stateRecord.accessRequestToken ?? undefined,
      clientEmail: stateRecord.clientEmail ?? undefined,
      shop: stateRecord.shop ?? undefined,
      ...(stateRecord.metadata as Record<string, unknown> ?? {}),
    };

    return { data: stateData, error: null };
  } catch (error) {
    const errorWithCode = error as Error & { code?: string };
    const errorMeta =
      error instanceof Error
        ? {
            name: error.name,
            message: error.message,
            stack: error.stack,
            ...(typeof errorWithCode.code === 'string'
              ? { code: errorWithCode.code }
              : {}),
          }
        : { message: String(error) };

    logger.error('OAuth state validation failed', {
      error: errorMeta,
    });
    return {
      data: null,
      error: {
        code: 'STATE_VALIDATION_FAILED',
        message: 'Failed to validate OAuth state token',
      },
    };
  }
}

/**
 * Cleanup expired OAuth state tokens
 * Should be called periodically (e.g., by a background job)
 */
async function cleanupExpiredTokens(): Promise<{ deleted: number }> {
  const result = await prisma.oAuthStateToken.deleteMany({
    where: {
      OR: [
        { expiresAt: { lt: new Date() } },
        { consumedAt: { not: null } },
      ],
    },
  });

  return { deleted: result.count };
}

// Export as service object for easier mocking in tests
export const oauthStateService = {
  createState,
  peekState,
  validateState,
  cleanupExpiredTokens,
};
