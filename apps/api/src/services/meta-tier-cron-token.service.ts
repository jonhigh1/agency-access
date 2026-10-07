import { env } from '@/lib/env.js';
import { infisical } from '@/lib/infisical.js';
import { logger } from '@/lib/logger.js';
import {
  metaTierCronTokenSecretName,
  reviewDemoMetaSecretName,
} from '@/lib/review-demo-secrets.js';

interface StoredReviewDemoToken {
  accessToken?: string;
  refreshToken?: string;
  expiresAt?: string;
  scope?: string;
  identity?: { id?: string; name?: string };
}

function resolveSourceClerkUserId(): string | null {
  if (env.META_MARKETING_API_TIER_CRON_LAB_USER_ID?.trim()) {
    return env.META_MARKETING_API_TIER_CRON_LAB_USER_ID.trim();
  }
  const first = env.META_REVIEW_LAB_USER_IDS[0];
  return first?.trim() ? first.trim() : null;
}

async function readSecretJson(secretName: string): Promise<StoredReviewDemoToken | null> {
  try {
    const raw = await infisical.getPlainSecret(secretName);
    return JSON.parse(raw) as StoredReviewDemoToken;
  } catch {
    return null;
  }
}

export async function readMetaTierCronAccessToken(): Promise<string | null> {
  const stored = await readSecretJson(metaTierCronTokenSecretName());
  const token = stored?.accessToken?.trim();
  return token ? token : null;
}

export interface SeedMetaTierCronTokenResult {
  seeded: boolean;
  alreadyPresent: boolean;
  sourceClerkUserId: string | null;
  reason?: string;
}

/**
 * Idempotently copy the lab review-demo token into meta_tier_cron_token.
 * Never logs or returns token values.
 */
export async function seedMetaTierCronTokenFromReviewDemo(): Promise<SeedMetaTierCronTokenResult> {
  const existing = await readSecretJson(metaTierCronTokenSecretName());
  if (existing?.accessToken?.trim()) {
    return {
      seeded: false,
      alreadyPresent: true,
      sourceClerkUserId: resolveSourceClerkUserId(),
    };
  }

  const sourceClerkUserId = resolveSourceClerkUserId();
  if (!sourceClerkUserId) {
    return {
      seeded: false,
      alreadyPresent: false,
      sourceClerkUserId: null,
      reason: 'missing_lab_clerk_user_id',
    };
  }

  const source = await readSecretJson(reviewDemoMetaSecretName(sourceClerkUserId));
  if (!source?.accessToken?.trim()) {
    return {
      seeded: false,
      alreadyPresent: false,
      sourceClerkUserId,
      reason: 'missing_review_demo_token',
    };
  }

  await infisical.storePlainSecret(metaTierCronTokenSecretName(), JSON.stringify(source));
  logger.info('meta_tier_cron_token_seeded', {
    sourceClerkUserId,
    destinationSecret: metaTierCronTokenSecretName(),
  });

  return {
    seeded: true,
    alreadyPresent: false,
    sourceClerkUserId,
  };
}
