import type { FastifyRequest } from 'fastify';
import { getClerkClient } from '@/lib/clerk';
import { agencyResolutionService } from '@/services/agency-resolution.service';

export interface AuthorizationError {
  code: string;
  message: string;
}

export interface PrincipalAgencyData {
  agencyId: string;
  principalId: string;
  agency: {
    id: string;
    name: string;
    email: string;
  };
}

export interface AuthUserClaims {
  sub?: string;
  orgId?: string;
  email?: string;
  email_address?: string;
  emailAddress?: string;
  email_addresses?: Array<{ email_address?: string; emailAddress?: string }>;
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function resolveUserEmail(user: AuthUserClaims | undefined): string | undefined {
  const direct = user?.email || user?.email_address || user?.emailAddress;
  if (direct) return normalizeEmail(direct);

  const firstEmail = user?.email_addresses?.[0];
  if (!firstEmail) return undefined;

  const nested = firstEmail.email_address || firstEmail.emailAddress;
  if (!nested) return undefined;

  return normalizeEmail(nested);
}

export async function resolveAuthenticatedUserEmail(
  user: AuthUserClaims | undefined
): Promise<string | undefined> {
  const claimEmail = resolveUserEmail(user);
  if (claimEmail) return claimEmail;

  if (!user?.sub?.startsWith('user_')) return undefined;

  return fetchClerkEmailAddress(user.sub);
}

async function fetchClerkEmailAddress(userId: string): Promise<string | undefined> {
  try {
    const user = await getClerkClient().users.getUser(userId);
    // Only verified addresses may drive agency identity. An unverified address
    // on the Clerk record is not proof of control and must not be inherited.
    const verifiedEmails = user.emailAddresses.filter(
      email => email.verification?.status === 'verified'
    );
    const primary = verifiedEmails.find(
      email => email.id === user.primaryEmailAddressId
    );
    const email = primary?.emailAddress || verifiedEmails[0]?.emailAddress;
    return email ? normalizeEmail(email) : undefined;
  } catch {
    return undefined;
  }
}

export async function resolvePrincipalAgency(
  request: FastifyRequest
): Promise<{ data: PrincipalAgencyData | null; error: AuthorizationError | null }> {
  const user = (request as any).user as AuthUserClaims | undefined;
  const principalId = user?.orgId || user?.sub;

  if (!principalId) {
    return {
      data: null,
      error: {
        code: 'UNAUTHORIZED',
        message: 'Authenticated user context is required',
      },
    };
  }

  let userEmail = resolveUserEmail(user);
  const buildPrincipalData = (agencyResultData: {
    agencyId: string;
    agency: {
      id: string;
      name: string;
      email: string;
    };
  }): PrincipalAgencyData => ({
    agencyId: agencyResultData.agencyId,
    principalId,
    agency: {
      id: agencyResultData.agency.id,
      name: agencyResultData.agency.name,
      email: agencyResultData.agency.email,
    },
  });

  // Cache-first lookup: avoid create-if-missing on the hot path for existing users.
  const cacheFirstResult = await agencyResolutionService.resolveAgency(principalId, {
    createIfMissing: false,
    userEmail,
  });

  if (cacheFirstResult.data) {
    return {
      data: buildPrincipalData(cacheFirstResult.data),
      error: null,
    };
  }

  if (!userEmail && user?.sub?.startsWith('user_')) {
    userEmail = await fetchClerkEmailAddress(user.sub);
  }

  // Only fallback to create-if-missing when agency does not exist.
  const createIfMissingResult = await agencyResolutionService.resolveAgency(principalId, {
    createIfMissing: true,
    userEmail,
  });

  if (createIfMissingResult.error || !createIfMissingResult.data) {
    return {
      data: null,
      error: {
        code: 'FORBIDDEN',
        message: 'Unable to resolve agency for authenticated user',
      },
    };
  }

  return {
    data: buildPrincipalData(createIfMissingResult.data),
    error: null,
  };
}

export function assertAgencyAccess(
  requestedAgencyId: string,
  principalAgencyId: string
): AuthorizationError | null {
  if (requestedAgencyId !== principalAgencyId) {
    return {
      code: 'FORBIDDEN',
      message: 'You do not have access to this agency resource',
    };
  }

  return null;
}
