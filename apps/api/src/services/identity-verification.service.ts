/**
 * Identity Verification Service
 *
 * Handles agency platform identity collection and validation for platform-native authorization flow.
 *
 * Agencies can connect their platforms in two modes:
 * - OAuth mode: Store access tokens for API automation
 * - Identity mode: Store email/Business ID for client instructions
 *
 * This service handles identity mode connections.
 */

import { prisma } from '@/lib/prisma';
import { z } from 'zod';

/**
 * @internal-for-golden — pinned by __tests__/identity-verification.service.test.ts.
 * Curated identity-mode subset, characterized verbatim from the duplicated
 * literals this const replaces (DEC-015, docs/DECISIONS.md). Intentionally NOT
 * derived from the PLATFORMS registry. Phase 2a may absorb it there.
 */
export const IDENTITY_VERIFICATION_PLATFORMS = [
  'google',
  'meta',
  'meta_ads',
  'google_ads',
  'ga4',
  'linkedin',
] as const;

// Validation schemas
const validateIdentitySchema = z.object({
  platform: z.enum(IDENTITY_VERIFICATION_PLATFORMS),
  agencyEmail: z.string().email().optional(),
  businessId: z.string().optional(),
});

const createIdentityConnectionSchema = z.object({
  agencyId: z.string().min(1),
  platform: z.enum(IDENTITY_VERIFICATION_PLATFORMS),
  agencyEmail: z.string().email().optional(),
  businessId: z.string().optional(),
  connectedBy: z.string().email(),
});

export type ValidateIdentityInput = z.infer<typeof validateIdentitySchema>;
export type CreateIdentityConnectionInput = z.infer<typeof createIdentityConnectionSchema>;

/**
 * Validate agency identity format before saving
 *
 * Validates email format or Business Manager ID format based on platform.
 * Normalizes emails to lowercase.
 *
 * @param input - Identity data to validate
 * @returns Validation result with normalized data
 */
export async function validateIdentity(input: ValidateIdentityInput) {
  try {
    const validated = validateIdentitySchema.parse(input);

    // Google/LinkedIn require email
    if ((validated.platform === 'google' || validated.platform === 'google_ads' || validated.platform === 'ga4' || validated.platform === 'linkedin') && !validated.agencyEmail) {
      return {
        data: null,
        error: {
          code: 'VALIDATION_ERROR',
          message: `Agency email is required for ${validated.platform.toUpperCase().replace('_', ' ')} platform`,
        },
      };
    }

    // Meta requires Business ID
    if ((validated.platform === 'meta' || validated.platform === 'meta_ads') && !validated.businessId) {
      return {
        data: null,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Business ID is required for Meta platform',
        },
      };
    }

    // Validate email format if provided
    if (validated.agencyEmail) {
      const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
      if (!emailRegex.test(validated.agencyEmail)) {
        return {
          data: null,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid email format',
          },
        };
      }
    }

    // Validate Business ID format if provided (15+ digits)
    if (validated.businessId) {
      const businessIdRegex = /^\d{15,}$/;
      if (!businessIdRegex.test(validated.businessId)) {
        return {
          data: null,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Business ID must be at least 15 digits',
          },
        };
      }
    }

    // Normalize email to lowercase
    const normalizedEmail = validated.agencyEmail?.toLowerCase();
    // Normalize Business ID (remove any non-digit characters)
    const normalizedBusinessId = validated.businessId?.replace(/\D/g, '');

    return {
      data: {
        valid: true,
        normalizedEmail,
        normalizedBusinessId,
      },
      error: null,
    };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        data: null,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid input data',
          details: error.errors,
        },
      };
    }

    return {
      data: null,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Validation failed',
      },
    };
  }
}

/**
 * Check if identity is unique for agency
 *
 * Prevents duplicate platform connections for the same agency.
 *
 * @param agencyId - Agency ID
 * @param platform - Platform to check
 * @param identity - Email or Business ID (for logging purposes)
 * @returns Whether identity is unique
 */
export async function checkIdentityUniqueness(
  agencyId: string,
  platform: string,
  identity: string
) {
  try {
    const existingConnection = await prisma.agencyPlatformConnection.findFirst({
      where: {
        agencyId,
        platform,
      },
    });

    if (existingConnection) {
      return { data: false, error: null };
    }

    return { data: true, error: null };
  } catch (error) {
    return {
      data: null,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to check identity uniqueness',
      },
    };
  }
}

/**
 * Create identity-only connection (no OAuth tokens)
 *
 * Stores agency's platform identity (email or Business Manager ID) for use in
 * client authorization instructions.
 *
 * @param input - Connection data
 * @returns Created connection record
 */
export async function createIdentityConnection(input: CreateIdentityConnectionInput) {
  try {
    const validated = createIdentityConnectionSchema.parse(input);

    // First validate identity format
    const validationResult = await validateIdentity({
      platform: validated.platform,
      agencyEmail: validated.agencyEmail,
      businessId: validated.businessId,
    });

    if (validationResult.error) {
      return validationResult;
    }

    // Verify agency exists
    const agency = await prisma.agency.findUnique({
      where: { id: validated.agencyId },
    });

    if (!agency) {
      return {
        data: null,
        error: {
          code: 'AGENCY_NOT_FOUND',
          message: 'Agency not found',
        },
      };
    }

    // Check if platform already connected
    const existingConnection = await prisma.agencyPlatformConnection.findFirst({
      where: {
        agencyId: validated.agencyId,
        platform: validated.platform,
      },
    });

    if (existingConnection) {
      return {
        data: null,
        error: {
          code: 'PLATFORM_ALREADY_CONNECTED',
          message: 'Platform is already connected for this agency',
        },
      };
    }

    // Use normalized values from validation
    const normalizedEmail = validationResult.data?.normalizedEmail;
    const normalizedBusinessId = validationResult.data?.normalizedBusinessId;

    // Create database record (no OAuth tokens needed)
    const connection = await prisma.agencyPlatformConnection.create({
      data: {
        agencyId: validated.agencyId,
        platform: validated.platform,
        connectionMode: 'identity',
        agencyEmail: normalizedEmail,
        businessId: normalizedBusinessId,
        secretId: null, // Identity mode doesn't need tokens
        status: 'active', // Identity connections are active immediately
        verificationStatus: 'pending',
        connectedBy: validated.connectedBy,
      },
    });

    // Log audit event
    await prisma.auditLog.create({
      data: {
        agencyId: validated.agencyId,
        action: 'AGENCY_IDENTITY_ADDED',
        userEmail: validated.connectedBy,
        agencyConnectionId: connection.id,
        metadata: {
          platform: validated.platform,
          connectionMode: 'identity',
          agencyEmail: normalizedEmail,
          businessId: normalizedBusinessId,
        },
        ipAddress: '0.0.0.0', // Will be populated by API route
        userAgent: 'unknown', // Will be populated by API route
      },
    });

    return { data: connection, error: null };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        data: null,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid input data',
          details: error.errors,
        },
      };
    }

    return {
      data: null,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to create identity connection',
      },
    };
  }
}

/**
 * Identity Verification Service
 * Exports all identity verification service functions
 */
export const identityVerificationService = {
  validateIdentity,
  checkIdentityUniqueness,
  createIdentityConnection,
};
