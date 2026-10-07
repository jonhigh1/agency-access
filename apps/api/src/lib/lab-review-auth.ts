import { hasLabReviewAccess } from '@agency-platform/shared';
import { getClerkClient } from '@/lib/clerk.js';
import { env } from '@/lib/env.js';
import { normalizeEmail, resolveUserEmail, type AuthUserClaims } from '@/lib/authorization.js';

export interface LabReviewAuthError {
  code: 'UNAUTHORIZED' | 'FORBIDDEN' | 'FEATURE_DISABLED';
  message: string;
}

export interface LabReviewAuthResult {
  data: { userId: string; email?: string } | null;
  error: LabReviewAuthError | null;
}

async function fetchClerkPublicMetadata(userId: string): Promise<unknown> {
  try {
    const user = await getClerkClient().users.getUser(userId);
    return user.publicMetadata;
  } catch {
    return undefined;
  }
}

function isAllowedByAllowlist(user: AuthUserClaims | undefined): boolean {
  const userId = user?.sub;
  if (userId && env.META_REVIEW_LAB_USER_IDS.includes(userId)) {
    return true;
  }
  const email = resolveUserEmail(user);
  if (email && env.META_REVIEW_LAB_EMAILS.map(normalizeEmail).includes(email)) {
    return true;
  }
  return false;
}

export async function resolveLabReviewAccess(user: AuthUserClaims | undefined): Promise<LabReviewAuthResult> {
  if (!env.META_REVIEW_DEMO_ENABLED) {
    return {
      data: null,
      error: {
        code: 'FEATURE_DISABLED',
        message: 'Meta review demo mode is not enabled on this environment',
      },
    };
  }

  const userId = user?.sub;
  if (!userId) {
    return {
      data: null,
      error: {
        code: 'UNAUTHORIZED',
        message: 'Authenticated user context is required',
      },
    };
  }

  if (isAllowedByAllowlist(user)) {
    return {
      data: { userId, email: resolveUserEmail(user) },
      error: null,
    };
  }

  const metadata =
    (user as { public_metadata?: unknown; publicMetadata?: unknown }).public_metadata ??
    (user as { public_metadata?: unknown; publicMetadata?: unknown }).publicMetadata ??
    (await fetchClerkPublicMetadata(userId));

  if (hasLabReviewAccess(metadata)) {
    return {
      data: { userId, email: resolveUserEmail(user) },
      error: null,
    };
  }

  return {
    data: null,
    error: {
      code: 'FORBIDDEN',
      message: 'Lab review access is required for /review-demo',
    },
  };
}
