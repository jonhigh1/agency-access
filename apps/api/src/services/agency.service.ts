/**
 * Agency Service
 *
 * Business logic for agency management operations.
 * All methods follow the { data, error } response pattern.
 */

import { prisma } from '@/lib/prisma';
import { z } from 'zod';
import { getCached, CacheKeys, CacheTTL } from '@/lib/cache.js';
import { creem } from '@/lib/creem.js';
import { getProductId } from '@/config/creem.config';
import {
  AgencyRoleSchema,
  SubscriptionTierSchema,
  UnifiedOnboardingProgressSchema,
  UnifiedOnboardingStatusSchema,
  type AgencyRole,
  type SubscriptionTier,
  type UnifiedOnboardingProgress,
  type UnifiedOnboardingStatus,
} from '@agency-platform/shared';
import { onboardingEmailService } from '@/services/onboarding-email.service';
import { affiliateService } from '@/services/affiliate.service';

// Validation schemas
const createAgencySchema = z.object({
  name: z.string().min(1, 'Agency name is required'),
  email: z.string().email('Invalid email address'),
  clerkUserId: z.string().optional(),
  subscriptionTier: SubscriptionTierSchema.optional(),
  settings: z.record(z.any()).optional(),
  affiliateClickToken: z.string().min(1).optional(),
});

const inviteMemberSchema = z.object({
  email: z.string().email('Invalid email address'),
  role: AgencyRoleSchema,
});

const updateAgencySchema = z.object({
  name: z.string().min(1, 'Agency name is required').optional(),
  subscriptionTier: SubscriptionTierSchema.optional(),
  settings: z.record(z.any()).nullable().optional(),
}).refine((value) => Object.keys(value).length > 0, {
  message: 'At least one field must be provided',
});

export type CreateAgencyInput = z.infer<typeof createAgencySchema>;
export type InviteMemberInput = z.infer<typeof inviteMemberSchema>;
export type UpdateAgencyInput = z.infer<typeof updateAgencySchema>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function getUnifiedOnboardingSettings(settings: unknown): Partial<UnifiedOnboardingProgress> {
  if (!isRecord(settings)) {
    return {};
  }

  const onboarding = settings.onboarding;
  if (!isRecord(onboarding)) {
    return {};
  }

  const unifiedV1 = onboarding.unifiedV1;
  if (!isRecord(unifiedV1)) {
    return {};
  }

  return unifiedV1 as Partial<UnifiedOnboardingProgress>;
}

function resolveOnboardingLifecycleStatus(
  onboarding: Partial<UnifiedOnboardingProgress>,
  hasProfile: boolean,
  hasRequests: boolean
): UnifiedOnboardingStatus {
  const explicitStatus = UnifiedOnboardingStatusSchema.safeParse(onboarding.status);
  if (explicitStatus.success && explicitStatus.data === 'completed') {
    return 'completed';
  }

  if (onboarding.completedAt || onboarding.dismissedAt) {
    return 'completed';
  }

  if (
    hasRequests ||
    (explicitStatus.success && explicitStatus.data === 'activated') ||
    onboarding.activatedAt
  ) {
    return 'activated';
  }

  if (
    (explicitStatus.success && explicitStatus.data === 'in_progress') ||
    onboarding.startedAt ||
    typeof onboarding.lastVisitedStep === 'number' ||
    typeof onboarding.lastCompletedStep === 'number' ||
    hasProfile
  ) {
    return 'in_progress';
  }

  return 'not_started';
}

/**
 * Create a new agency with an admin member
 */
export async function createAgency(input: CreateAgencyInput) {
  try {
    const validated = createAgencySchema.parse(input);

    // Check if agency with this clerkUserId already exists
    if (validated.clerkUserId) {
      const existingByClerk = await prisma.agency.findUnique({
        where: { clerkUserId: validated.clerkUserId },
      });

      if (existingByClerk) {
        return {
          data: null,
          error: {
            code: 'AGENCY_EXISTS',
            message: 'An agency already exists for this user',
          },
        };
      }
    }

    // Check if agency with this email already exists
    const existingByEmail = await prisma.agency.findUnique({
      where: { email: validated.email },
    });

    if (existingByEmail) {
      return {
        data: null,
        error: {
          code: 'AGENCY_EXISTS',
          message: 'An agency with this email already exists',
        },
      };
    }

    // Check if agency with this name already exists
    const existingByName = await prisma.agency.findFirst({
      where: { name: validated.name },
    });

    if (existingByName) {
      return {
        data: null,
        error: {
          code: 'AGENCY_EXISTS',
          message: 'An agency with this name already exists',
        },
      };
    }

    // Use transaction to create agency and admin member atomically
    const result = await prisma.$transaction(async (tx: any) => {
      const agency = await tx.agency.create({
        data: {
          name: validated.name,
          email: validated.email,
          clerkUserId: validated.clerkUserId || null,
          settings: validated.settings || null,
          subscriptionTier: validated.subscriptionTier || null,
        },
      });

      const admin = await tx.agencyMember.create({
        data: {
          agencyId: agency.id,
          email: validated.email,
          role: 'admin',
        },
      });

      return { agency, admin };
    });

    const queued = await onboardingEmailService.queueSequenceStart({
      agencyId: result.agency.id,
    });

    if (queued?.error) {
      console.warn('Failed to queue onboarding email sequence', {
        agencyId: result.agency.id,
        error: queued.error,
      });
    }

    if (validated.affiliateClickToken) {
      const affiliateClaim = await affiliateService.claimReferralForAgency({
        clickToken: validated.affiliateClickToken,
        agencyId: result.agency.id,
        agencyEmail: validated.email,
      });

      if (affiliateClaim.error) {
        console.warn('Failed to claim affiliate referral during agency creation', {
          agencyId: result.agency.id,
          error: affiliateClaim.error,
        });
      }
    }

    return { data: result.agency, error: null };
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
        message: 'Failed to create agency',
      },
    };
  }
}

/**
 * Create a new agency with Creem checkout session
 * Creates agency, admin member, and checkout URL atomically in a single transaction
 */
export interface CreateAgencyWithCheckoutInput {
  clerkUserId: string;
  name: string;
  email: string;
  selectedTier: SubscriptionTier;
  billingInterval: 'monthly' | 'yearly';
  settings?: Record<string, any>;
  affiliateClickToken?: string;
}

export async function createAgencyWithCheckout(input: CreateAgencyWithCheckoutInput) {
  try {
    // Validate input
    const schema = z.object({
      clerkUserId: z.string().min(1, 'Clerk user ID is required'),
      name: z.string().min(1, 'Agency name is required'),
      email: z.string().email('Invalid email address'),
      selectedTier: SubscriptionTierSchema,
      billingInterval: z.enum(['monthly', 'yearly']),
      settings: z.record(z.any()).optional(),
      affiliateClickToken: z.string().min(1).optional(),
    });

    const validated = schema.parse(input);

    // Check if agency with this clerkUserId already exists
    if (validated.clerkUserId) {
      const existingByClerk = await prisma.agency.findUnique({
        where: { clerkUserId: validated.clerkUserId },
      });

      if (existingByClerk) {
        return {
          data: null,
          error: {
            code: 'AGENCY_EXISTS',
            message: 'An agency already exists for this user',
          },
        };
      }
    }

    // Check if agency with this email already exists
    const existingByEmail = await prisma.agency.findUnique({
      where: { email: validated.email },
    });

    if (existingByEmail) {
      return {
        data: null,
        error: {
          code: 'AGENCY_EXISTS',
          message: 'An agency with this email already exists',
        },
      };
    }

    // Check if agency with this name already exists
    const existingByName = await prisma.agency.findFirst({
      where: { name: validated.name },
    });

    if (existingByName) {
      return {
        data: null,
        error: {
          code: 'AGENCY_EXISTS',
          message: 'An agency with this name already exists',
        },
      };
    }

    // Use transaction to create agency and admin member atomically
    const result = await prisma.$transaction(async (tx: any) => {
      // 1. Create agency with selected tier
      const agency = await tx.agency.create({
        data: {
          name: validated.name,
          email: validated.email,
          clerkUserId: validated.clerkUserId || null,
          subscriptionTier: validated.selectedTier,
          settings: validated.settings || null,
        },
      });

      // 2. Create admin member
      await tx.agencyMember.create({
        data: {
          agencyId: agency.id,
          email: validated.email,
          role: 'admin',
        },
      });

      return { agency };
    });

    const queued = await onboardingEmailService.queueSequenceStart({
      agencyId: result.agency.id,
    });

    if (queued?.error) {
      console.warn('Failed to queue onboarding email sequence', {
        agencyId: result.agency.id,
        error: queued.error,
      });
    }

    if (validated.affiliateClickToken) {
      const affiliateClaim = await affiliateService.claimReferralForAgency({
        clickToken: validated.affiliateClickToken,
        agencyId: result.agency.id,
        agencyEmail: validated.email,
      });

      if (affiliateClaim.error) {
        console.warn('Failed to claim affiliate referral during signup checkout', {
          agencyId: result.agency.id,
          error: affiliateClaim.error,
        });
      }
    }

    // 3. Create Creem checkout session (outside transaction - agency is already created)
    const productId = getProductId(validated.selectedTier, validated.billingInterval);

    const checkout = await creem.createCheckoutSession({
      customer: result.agency.email,
      customerEmail: result.agency.email,
      productId,
      successUrl: `${process.env.FRONTEND_URL}/checkout/success?agency=${result.agency.id}`,
      cancelUrl: `${process.env.FRONTEND_URL}/checkout/cancel?agency=${result.agency.id}`,
      metadata: {
        agencyId: result.agency.id,
        tier: validated.selectedTier,
        billingInterval: validated.billingInterval,
      },
    });

    if (checkout.error) {
      // Agency was created but checkout failed - log and return error
      console.error('Failed to create Creem checkout:', checkout.error);
      return {
        data: { agency: result.agency, checkoutUrl: null },
        error: {
          code: 'CREEM_CHECKOUT_FAILED',
          message: 'Agency created but checkout session failed. Please try again from settings.',
          details: checkout.error,
        },
      };
    }

    return {
      data: {
        agency: result.agency,
        checkoutUrl: checkout.data?.url || null,
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
        message: 'Failed to create agency with checkout',
        details: error instanceof Error ? error.message : String(error),
      },
    };
  }
}

/**
 * List agencies with optional filters
 * @param filters - Email or clerkUserId to filter by
 * @param includeMembers - Whether to include members relationship (default: true for backward compatibility)
 */
export async function listAgencies(
  filters: { email?: string; clerkUserId?: string } = {},
  includeMembers: boolean = true
) {
  try {
    const { email, clerkUserId } = filters;

    const where: any = {};

    if (email) {
      where.email = email;
    }

    if (clerkUserId) {
      where.clerkUserId = clerkUserId;
    }

    const agencies = await prisma.agency.findMany({
      where,
      include: includeMembers ? { members: true } : undefined,
    });

    return { data: agencies, error: null };
  } catch (error) {
    return {
      data: null,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to retrieve agencies',
      },
    };
  }
}

/**
 * Get agency by email with caching
 *
 * Lightweight lookup that returns only the agency record (no members).
 * Uses extended cache TTL (30 minutes) since agency data rarely changes.
 *
 * @param email - Agency email address
 * @returns Agency record or null
 */
export async function getAgencyByEmail(email: string) {
  const cacheKey = CacheKeys.agencyByEmail(email);

  const result = await getCached<{
    id: string;
    name: string;
    email: string;
    clerkUserId: string | null;
  }>({
    key: cacheKey,
    ttl: CacheTTL.EXTENDED, // 30 minutes
    fetch: async () => {
      const agency = await prisma.agency.findUnique({
        where: { email },
        select: {
          id: true,
          name: true,
          email: true,
          clerkUserId: true,
        },
      });

      return { data: agency, error: null };
    },
  });

  return result;
}

/**
 * Get agency by ID
 */
export async function getAgency(agencyId: string) {
  try {
    const agency = await prisma.agency.findUnique({
      where: { id: agencyId },
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

    return { data: agency, error: null };
  } catch (error) {
    return {
      data: null,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to retrieve agency',
      },
    };
  }
}

/**
 * Update agency
 */
export async function updateAgency(agencyId: string, input: UpdateAgencyInput) {
  try {
    const validated = updateAgencySchema.parse(input);

    // Verify agency exists
    const existing = await prisma.agency.findUnique({
      where: { id: agencyId },
    });

    if (!existing) {
      return {
        data: null,
        error: {
          code: 'NOT_FOUND',
          message: 'Agency not found',
        },
      };
    }

    // If updating name, check for conflicts
    if (validated.name && validated.name !== existing.name) {
      const nameConflict = await prisma.agency.findFirst({
        where: { name: validated.name },
      });

      if (nameConflict) {
        return {
          data: null,
          error: {
            code: 'AGENCY_EXISTS',
            message: 'An agency with this name already exists',
          },
        };
      }
    }

    const existingSettings = (
      existing.settings &&
      typeof existing.settings === 'object' &&
      !Array.isArray(existing.settings)
    ) ? existing.settings as Record<string, any> : {};

    const mergedSettings = validated.settings === undefined
      ? undefined
      : {
        ...existingSettings,
        ...(validated.settings || {}),
      };

    const agency = await prisma.agency.update({
      where: { id: agencyId },
      data: {
        ...(validated.name && { name: validated.name }),
        ...(validated.subscriptionTier && { subscriptionTier: validated.subscriptionTier as any }),
        ...(mergedSettings !== undefined && { settings: mergedSettings }),
        updatedAt: new Date(),
      },
    });

    return { data: agency, error: null };
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
        message: 'Failed to update agency',
      },
    };
  }
}

/**
 * Get all members of an agency
 */
export async function getAgencyMembers(agencyId: string) {
  try {
    const members = await prisma.agencyMember.findMany({
      where: { agencyId },
      orderBy: { invitedAt: 'asc' },
    });

    return { data: members, error: null };
  } catch (error) {
    return {
      data: null,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to retrieve agency members',
      },
    };
  }
}

/**
 * Invite a member to an agency
 */
export async function inviteMember(agencyId: string, input: InviteMemberInput) {
  try {
    const validated = inviteMemberSchema.parse(input);

    // Verify agency exists
    const agency = await prisma.agency.findUnique({
      where: { id: agencyId },
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

    // Check if member already exists
    const existing = await prisma.agencyMember.findFirst({
      where: {
        agencyId,
        email: validated.email,
      },
    });

    if (existing) {
      return {
        data: null,
        error: {
          code: 'MEMBER_EXISTS',
          message: 'This email is already a member of this agency',
        },
      };
    }

    const member = await prisma.agencyMember.create({
      data: {
        agencyId,
        email: validated.email,
        role: validated.role,
      },
    });

    return { data: member, error: null };
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
        message: 'Failed to invite member',
      },
    };
  }
}

/**
 * Update member role
 */
export async function updateMemberRole(memberId: string, role: AgencyRole) {
  try {
    // Validate role
    const validRoles = AgencyRoleSchema.options;
    if (!validRoles.includes(role)) {
      return {
        data: null,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid role',
        },
      };
    }

    // Get current member to check if they're the last admin
    const currentMember = await prisma.agencyMember.findFirst({
      where: { id: memberId },
    });

    if (!currentMember) {
      return {
        data: null,
        error: {
          code: 'MEMBER_NOT_FOUND',
          message: 'Member not found',
        },
      };
    }

    // If changing from admin to something else, check if this is the last admin
    if (currentMember.role === 'admin' && role !== 'admin') {
      const adminCount = await prisma.agencyMember.count({
        where: {
          agencyId: currentMember.agencyId,
          role: 'admin',
        },
      });

      if (adminCount === 1) {
        return {
          data: null,
          error: {
            code: 'LAST_ADMIN',
            message: 'Cannot remove the last admin from an agency',
          },
        };
      }
    }

    const member = await prisma.agencyMember.update({
      where: { id: memberId },
      data: { role },
    });

    return { data: member, error: null };
  } catch (error) {
    return {
      data: null,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to update member role',
      },
    };
  }
}

/**
 * Remove member from agency
 */
export async function removeMember(memberId: string) {
  try {
    // Get current member to check if they're the last admin
    const currentMember = await prisma.agencyMember.findFirst({
      where: { id: memberId },
    });

    if (!currentMember) {
      return {
        data: null,
        error: {
          code: 'MEMBER_NOT_FOUND',
          message: 'Member not found',
        },
      };
    }

    // If removing an admin, check if this is the last admin
    if (currentMember.role === 'admin') {
      const adminCount = await prisma.agencyMember.count({
        where: {
          agencyId: currentMember.agencyId,
          role: 'admin',
        },
      });

      if (adminCount === 1) {
        return {
          data: null,
          error: {
            code: 'LAST_ADMIN',
            message: 'Cannot remove the last admin from an agency',
          },
        };
      }
    }

    // Delete and return the member
    const member = await prisma.agencyMember.delete({
      where: { id: memberId },
    });

    return { data: member, error: null };
  } catch (error) {
    return {
      data: null,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to remove member',
      },
    };
  }
}

/**
 * Update member role with explicit agency ownership enforcement.
 */
export async function updateMemberRoleForAgency(
  memberId: string,
  principalAgencyId: string,
  role: AgencyRole
) {
  const member = await prisma.agencyMember.findFirst({
    where: { id: memberId },
    select: { id: true, agencyId: true },
  });

  if (!member) {
    return {
      data: null,
      error: {
        code: 'MEMBER_NOT_FOUND',
        message: 'Member not found',
      },
    };
  }

  if (member.agencyId !== principalAgencyId) {
    return {
      data: null,
      error: {
        code: 'FORBIDDEN',
        message: 'You do not have access to this agency resource',
      },
    };
  }

  return updateMemberRole(memberId, role);
}

/**
 * Remove member with explicit agency ownership enforcement.
 */
export async function removeMemberForAgency(
  memberId: string,
  principalAgencyId: string
) {
  const member = await prisma.agencyMember.findFirst({
    where: { id: memberId },
    select: { id: true, agencyId: true },
  });

  if (!member) {
    return {
      data: null,
      error: {
        code: 'MEMBER_NOT_FOUND',
        message: 'Member not found',
      },
    };
  }

  if (member.agencyId !== principalAgencyId) {
    return {
      data: null,
      error: {
        code: 'FORBIDDEN',
        message: 'You do not have access to this agency resource',
      },
    };
  }

  return removeMember(memberId);
}

/**
 * Get onboarding completion status for an agency
 * Checks if agency has completed initial setup (profile + team members)
 */
export async function getOnboardingStatus(agencyId: string) {
  try {
    const agency = await prisma.agency.findUnique({
      where: { id: agencyId },
      select: {
        id: true,
        name: true,
        settings: true,
        _count: {
          select: {
            members: true,
            accessRequests: true,
          },
        },
      },
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

    // Legacy onboarding flags
    const hasProfile = !!(agency.name && agency.settings);
    const agencyRecord = agency as {
      _count?: { members?: number; accessRequests?: number };
      members?: unknown[];
      accessRequests?: unknown[];
    };
    const membersCount =
      typeof agencyRecord._count?.members === 'number'
        ? agencyRecord._count.members
        : Array.isArray(agencyRecord.members)
          ? agencyRecord.members.length
          : 0;
    const accessRequestCount =
      typeof agencyRecord._count?.accessRequests === 'number'
        ? agencyRecord._count.accessRequests
        : Array.isArray(agencyRecord.accessRequests)
          ? agencyRecord.accessRequests.length
          : 0;
    const hasMembers = membersCount > 1; // More than just the creator
    const hasRequests = accessRequestCount > 0;
    const onboarding = getUnifiedOnboardingSettings(agency.settings);
    const status = resolveOnboardingLifecycleStatus(onboarding, hasProfile, hasRequests);
    const legacyCompleted = hasProfile && hasMembers;
    const completed = status === 'completed' || legacyCompleted;

    return {
      data: {
        completed,
        status,
        lifecycle: onboarding,
        step: {
          profile: hasProfile,
          members: hasMembers,
          firstRequest: hasRequests,
        },
      },
      error: null,
    };
  } catch (error) {
    return {
      data: null,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to check onboarding status',
      },
    };
  }
}

export async function updateOnboardingProgress(
  agencyId: string,
  progressInput: UnifiedOnboardingProgress
) {
  try {
    const validated = UnifiedOnboardingProgressSchema.parse(progressInput);

    const agency = await prisma.agency.findUnique({
      where: { id: agencyId },
      select: { id: true, settings: true },
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

    const currentSettings = isRecord(agency.settings) ? { ...agency.settings } : {};
    const currentOnboarding = isRecord(currentSettings.onboarding)
      ? { ...currentSettings.onboarding }
      : {};
    const currentUnified = isRecord(currentOnboarding.unifiedV1)
      ? { ...currentOnboarding.unifiedV1 }
      : {};

    const mergedProgress = {
      ...currentUnified,
      ...validated,
    };

    const updatedSettings = {
      ...currentSettings,
      onboarding: {
        ...currentOnboarding,
        unifiedV1: mergedProgress,
      },
    };

    const updatedAgency = await prisma.agency.update({
      where: { id: agencyId },
      data: {
        settings: updatedSettings,
      },
      select: {
        id: true,
        settings: true,
      },
    });

    if (validated.status === 'activated' && validated.accessRequestId) {
      const queued = await onboardingEmailService.queueActivatedFollowUp({
        agencyId: updatedAgency.id,
        accessRequestId: validated.accessRequestId,
      });

      if (queued?.error) {
        console.warn('Failed to queue onboarding activation follow-up', {
          agencyId: updatedAgency.id,
          accessRequestId: validated.accessRequestId,
          error: queued.error,
        });
      }
    }

    return {
      data: {
        agencyId: updatedAgency.id,
        lifecycle: getUnifiedOnboardingSettings(updatedAgency.settings),
      },
      error: null,
    };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        data: null,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid onboarding progress payload',
          details: error.errors,
        },
      };
    }

    return {
      data: null,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to update onboarding progress',
      },
    };
  }
}

/**
 * Bulk invite team members to an agency
 * Creates/updates multiple AgencyMember records in a single transaction
 */
export async function bulkInviteMembers(
  agencyId: string,
  invitations: Array<{ email: string; role: AgencyRole }>
) {
  try {
    // Verify agency exists
    const agency = await prisma.agency.findUnique({
      where: { id: agencyId },
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

    // Validate all invitations
    const bulkInviteSchema = z.array(
      z.object({
        email: z.string().email(),
        role: AgencyRoleSchema,
      })
    );

    const validated = bulkInviteSchema.parse(invitations);

    // Use transaction to create/update all members atomically
    const results = await prisma.$transaction(
      validated.map((invite) =>
        prisma.agencyMember.upsert({
          where: {
            agencyId_email: { agencyId, email: invite.email },
          },
          update: { role: invite.role },
          create: {
            agencyId,
            email: invite.email,
            role: invite.role,
          },
        })
      )
    );

    return { data: results, error: null };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        data: null,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid invitation data',
          details: error.errors,
        },
      };
    }

    return {
      data: null,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to invite members',
      },
    };
  }
}

/**
 * Agency Service
 * Exports all agency-related service functions as a single object
 */
export const agencyService = {
  listAgencies,
  getAgencyByEmail,
  createAgency,
  createAgencyWithCheckout,
  getAgency,
  updateAgency,
  getAgencyMembers,
  inviteMember,
  updateMemberRole,
  updateMemberRoleForAgency,
  removeMember,
  removeMemberForAgency,
  getOnboardingStatus,
  updateOnboardingProgress,
  bulkInviteMembers,
};
