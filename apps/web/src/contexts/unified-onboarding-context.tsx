/**
 * UnifiedOnboardingContext
 *
 * State management for the unified PLG onboarding flow.
 * Implements the "Zero-to-One" flow that gets founders to their first real client access link quickly.
 *
 * Design Principles:
 * - Opinionated: Smart defaults, pre-select Google as starting platform
 * - Interruptive: Full-screen experiences for key moments
 * - Interactive: Users CREATE value (first access request) immediately
 *
 * Flow:
 * Screen 0: Welcome & Value Hook
 * Screen 1: Quick Agency Profile
 * Screen 2A: First Access Request (Client selection)
 * Screen 2B: Platform Selection
 * Screen 3: Aha! Moment (Success link display)
 * Screen 4: Optional Team Invite (fully skippable)
 * Screen 5: Final Success & Dashboard Tease
 */

'use client';

import { createContext, useContext, useState, useCallback, ReactNode, useEffect, useRef, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth, useUser } from '@clerk/nextjs';
import { Client, Platform, AgencyRole, UnifiedOnboardingProgress } from '@agency-platform/shared';
import { authorizedApiFetch, AuthorizedApiError } from '@/lib/api/authorized-api-fetch';
import { getApiErrorMessage } from '@/lib/api/extract-error';
import { trackAffiliateEvent } from '@/lib/analytics/affiliate';
import { buildAuthorizeUrl } from '@/lib/app-url';
import { trackOnboardingEvent } from '@/lib/analytics/onboarding';
import { getAffiliateClickTokenFromDocument } from '@/lib/affiliate-cookie';
import {
  resolveOnboardingResumeStep,
  type AgencyOnboardingStatusData,
} from '@/lib/query/onboarding';
import { ONBOARDING_TOTAL_STEPS } from '@/lib/onboarding-steps';

// ============================================================
// TYPES
// ============================================================

export interface AgencySettings {
  timezone: string;
  industry: string;
  logoUrl?: string;
  website?: string;
}

export interface AgencyData {
  name: string;
  settings?: Partial<AgencySettings>;
}

export interface ClientData {
  id?: string;
  name: string;
  email: string;
}

export type PlatformSelection = Record<string, string[]>; // { google: ['google'], meta: ['meta'], linkedin: ['linkedin'] }

export interface TeamInvite {
  email: string;
  role: AgencyRole;
}

export interface OnboardingState {
  // Progress tracking
  currentStep: number;
  completedSteps: Set<number>;
  startedAt: number; // Timestamp when onboarding started

  // Agency profile (Screen 1)
  agencyName: string;
  agencySettings: AgencySettings;

  // First access request (Screen 2A)
  clientId?: string;
  clientEmail?: string;
  clientName?: string;
  existingClients: Client[]; // Loaded from API for typeahead

  // Platform selection (Screen 2B)
  selectedPlatforms: PlatformSelection;
  preSelectedPlatforms: Platform[]; // Google as smart default

  // Generated link (Screen 3 - The Aha! Moment)
  agencyId?: string;
  accessLink?: string;
  accessRequestId?: string;

  // Team invites (Screen 4 - Optional)
  teamInvites: TeamInvite[];

  // Meta state
  loading: boolean;
  error: string | null;
}

interface UnifiedOnboardingContextValue {
  state: OnboardingState;

  // Navigation
  nextStep: () => void;
  prevStep: () => void;
  goToStep: (step: number) => void;
  canGoNext: () => boolean;
  canGoBack: () => boolean;
  canSkip: () => boolean;

  // Data updates
  updateAgency: (data: AgencyData) => void;
  updateClient: (data: ClientData) => void;
  updatePlatforms: (platforms: PlatformSelection) => void;
  addTeamInvite: (invite: TeamInvite) => void;
  removeTeamInvite: (email: string) => void;
  updateTeamInviteRole: (email: string, role: AgencyRole) => void;

  // API actions
  loadExistingClients: () => Promise<void>;
  createAgencyAndAccessRequest: () => Promise<CreateAgencyAndAccessRequestResult>;
  deferUntilClientReady: () => Promise<void>;
  sendTeamInvites: () => Promise<boolean>;

  // Completion
  completeOnboarding: () => Promise<void>;
  skipOnboarding: () => void;

  // Error handling
  setError: (error: string | null) => void;
  clearError: () => void;
}

export interface CreateAgencyAndAccessRequestResult {
  ok: boolean;
  agencyId?: string;
  accessRequestId?: string;
  accessLink?: string;
  error?: string;
}

// ============================================================
// CONTEXT
// ============================================================

const UnifiedOnboardingContext = createContext<UnifiedOnboardingContextValue | undefined>(undefined);

// ============================================================
// INITIAL STATE & CONSTANTS
// ============================================================

const PRESELECTED_PLATFORMS: Platform[] = ['google'];
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const SECOND_LEVEL_TLDS = new Set(['co', 'com', 'org', 'net', 'gov', 'edu', 'ac']);
const ACRONYM_TOKENS = new Set(['ai', 'seo', 'ppc', 'crm', 'saas', 'b2b', 'b2c']);
const TRAILING_NAME_TOKENS = [
  'consulting',
  'marketing',
  'solutions',
  'partners',
  'digital',
  'agency',
  'studio',
  'media',
  'group',
  'labs',
  'co',
  'company',
  'inc',
  'llc',
  'ai',
  'seo',
  'ppc',
  'crm',
  'saas',
  'b2b',
  'b2c',
];

function extractAgencyDomainLabel(email: string): string | null {
  const atIndex = email.lastIndexOf('@');
  if (atIndex < 0) {
    return null;
  }

  const domain = email.slice(atIndex + 1).trim().toLowerCase();
  if (!domain) {
    return null;
  }

  const hostname = domain.split(':')[0];
  const parts = hostname.split('.').filter(Boolean);
  if (parts.length === 0) {
    return null;
  }

  if (parts.length === 1) {
    return parts[0];
  }

  const tld = parts[parts.length - 1];
  const secondLevel = parts[parts.length - 2];
  const usesCountrySecondLevel = tld.length === 2 && SECOND_LEVEL_TLDS.has(secondLevel);
  const labelIndex = usesCountrySecondLevel && parts.length >= 3
    ? parts.length - 3
    : parts.length - 2;

  return parts[labelIndex];
}

function splitTrailingNameTokens(segment: string): string[] {
  if (!segment) {
    return [];
  }

  const tokens: string[] = [];
  let remaining = segment;

  while (remaining.length > 0) {
    const matchedToken = TRAILING_NAME_TOKENS.find(
      (token) => remaining.length > token.length && remaining.endsWith(token)
    );

    if (!matchedToken) {
      break;
    }

    tokens.unshift(matchedToken);
    remaining = remaining.slice(0, -matchedToken.length);
  }

  if (remaining.length > 0) {
    tokens.unshift(remaining);
  }

  return tokens;
}

function toDisplayAgencyToken(token: string): string {
  if (ACRONYM_TOKENS.has(token)) {
    return token.toUpperCase();
  }

  return token.charAt(0).toUpperCase() + token.slice(1);
}

function formatAgencyName(source: string): string | null {
  const normalized = source.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  if (!normalized) {
    return null;
  }

  const rawSegments = normalized.split(/\s+/).filter(Boolean);
  const formattedTokens = rawSegments
    .flatMap((segment) => splitTrailingNameTokens(segment))
    .filter((segment) => segment.length > 0)
    .map((segment) => toDisplayAgencyToken(segment));

  if (formattedTokens.length === 0) {
    return null;
  }

  return formattedTokens.join(' ');
}

function getAgencyNameFromEmail(email?: string): string | null {
  if (!email) {
    return null;
  }

  const domainLabel = extractAgencyDomainLabel(email);
  const domainName = domainLabel ? formatAgencyName(domainLabel) : null;
  if (domainName) {
    return domainName;
  }

  const localPart = email.split('@')[0];
  return localPart ? formatAgencyName(localPart) : null;
}

function isValidClientData(clientName?: string, clientEmail?: string): boolean {
  return Boolean(clientName?.trim() && clientName.trim().length >= 2 && clientEmail?.trim() && EMAIL_REGEX.test(clientEmail.trim()));
}

const initialState: OnboardingState = {
  // Progress
  currentStep: 0,
  completedSteps: new Set<number>(),
  startedAt: Date.now(),

  // Agency profile
  agencyName: '',
  agencySettings: {
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    industry: 'digital_marketing', // Smart default
    logoUrl: '',
    website: '',
  },

  // Client
  clientId: undefined,
  clientEmail: '',
  clientName: '',
  existingClients: [],

  // Platforms
  selectedPlatforms: PRESELECTED_PLATFORMS.reduce<PlatformSelection>((selection, platform) => {
    const group = platform.split('_')[0];
    if (!selection[group]) {
      selection[group] = [];
    }
    selection[group].push(platform);
    return selection;
  }, {}),
  preSelectedPlatforms: PRESELECTED_PLATFORMS,

  // Generated link
  agencyId: undefined,
  accessLink: undefined,
  accessRequestId: undefined,

  // Team invites
  teamInvites: [],

  // Meta
  loading: false,
  error: null,
};

// ============================================================
// PROVIDER
// ============================================================

interface UnifiedOnboardingProviderProps {
  children: ReactNode;
  onComplete?: () => void; // Optional callback when onboarding completes
  enableProgressHydration?: boolean;
}

export function UnifiedOnboardingProvider({
  children,
  onComplete,
  enableProgressHydration = true,
}: UnifiedOnboardingProviderProps) {
  const router = useRouter();
  const { userId, orgId, getToken } = useAuth();
  const { user } = useUser();

  const [state, setState] = useState<OnboardingState>(initialState);
  const hasHydratedProgressRef = useRef(false);

  // ============================================================
  // ANALYTICS TRACKING
  // ============================================================

  useEffect(() => {
    trackOnboardingEvent('onboarding_started', {
      version: 'unified_v1',
      timestamp: Date.now(),
      userId,
    });
  }, [userId]);

  useEffect(() => {
    // Track step completion
    if (state.currentStep > 0) {
      const prevStep = state.currentStep - 1;
      if (!state.completedSteps.has(prevStep)) {
        setState((prev) => {
          const newCompleted = new Set(prev.completedSteps);
          newCompleted.add(prevStep);

          const duration = Date.now() - prev.startedAt;
          trackOnboardingEvent('onboarding_step_completed', {
            step: prevStep,
            durationMs: duration,
            timestamp: Date.now(),
          });

          return { ...prev, completedSteps: newCompleted };
        });
      }
    }
  }, [state.currentStep, state.completedSteps, state.startedAt]);

  const persistOnboardingProgress = useCallback(
    async (agencyId: string | undefined, progress: UnifiedOnboardingProgress) => {
      if (!agencyId) {
        return;
      }

      try {
        await authorizedApiFetch(`/api/agencies/${agencyId}/onboarding-progress`, {
          method: 'PATCH',
          getToken,
          body: JSON.stringify(progress),
        });
      } catch {
        // Non-blocking persistence path. Recovery still works from server-derived defaults.
      }
    },
    [getToken]
  );

  // ============================================================
  // NAVIGATION METHODS
  // ============================================================

  const nextStep = useCallback(() => {
    let progressPayload: UnifiedOnboardingProgress | null = null;
    let agencyIdForPersist: string | undefined;

    setState((prev) => {
      if (prev.currentStep >= ONBOARDING_TOTAL_STEPS) {
        return prev;
      }

      const next = prev.currentStep + 1;
      progressPayload = {
        status: next >= 4 ? 'activated' : 'in_progress',
        startedAt: new Date(prev.startedAt).toISOString(),
        lastCompletedStep: prev.currentStep,
        lastVisitedStep: next,
        accessRequestId: prev.accessRequestId,
      };
      agencyIdForPersist = prev.agencyId;

      return { ...prev, currentStep: next, error: null };
    });

    if (progressPayload) {
      void persistOnboardingProgress(agencyIdForPersist, progressPayload);
    }
  }, [persistOnboardingProgress]);

  const prevStep = useCallback(() => {
    if (state.currentStep > 0) {
      setState((prev) => ({ ...prev, currentStep: prev.currentStep - 1, error: null }));
    }
  }, [state.currentStep]);

  const goToStep = useCallback(
    (step: number) => {
      if (step >= 0 && step <= ONBOARDING_TOTAL_STEPS) {
        setState((prev) => ({ ...prev, currentStep: step, error: null }));
        void persistOnboardingProgress(state.agencyId, {
          status: step >= 4 ? 'activated' : 'in_progress',
          startedAt: new Date(state.startedAt).toISOString(),
          lastVisitedStep: step,
        });
      }
    },
    [persistOnboardingProgress, state.agencyId, state.startedAt]
  );

  const canGoNext = useCallback(() => {
    switch (state.currentStep) {
      case 0: // Welcome screen - always can proceed
        return true;
      case 1: // Agency profile - requires agency name
        return state.agencyName.trim().length > 0;
      case 2: // Client step requires a real client before link generation
        return isValidClientData(state.clientName, state.clientEmail);
      case 3: // Platform step can proceed with the default opinionated selection
        return true;
      case 4: // Success link display - always can proceed
        return true;
      case 5: // Team invite - optional, always can proceed
        return true;
      default:
        return false;
    }
  }, [state]);

  const canGoBack = useCallback(() => {
    // Can't go back from welcome screen
    // Can't go back once access link is generated (Screen 4+)
    return state.currentStep > 0 && state.currentStep < 4;
  }, [state.currentStep]);

  const canSkip = useCallback(() => {
    return state.currentStep === 5;
  }, [state.currentStep]);

  // ============================================================
  // DATA UPDATE METHODS
  // ============================================================

  const updateAgency = useCallback((data: AgencyData) => {
    setState((prev) => ({
      ...prev,
      agencyName: data.name,
      agencySettings: {
        ...prev.agencySettings,
        ...data.settings,
      },
    }));
  }, []);

  const updateClient = useCallback((data: ClientData) => {
    setState((prev) => ({
      ...prev,
      clientId: data.id,
      clientName: data.name,
      clientEmail: data.email,
    }));
  }, []);

  const updatePlatforms = useCallback((platforms: PlatformSelection) => {
    setState((prev) => ({
      ...prev,
      selectedPlatforms: platforms,
    }));
  }, []);

  const addTeamInvite = useCallback((invite: TeamInvite) => {
    setState((prev) => ({
      ...prev,
      teamInvites: [...prev.teamInvites, invite],
    }));
  }, []);

  const removeTeamInvite = useCallback((email: string) => {
    setState((prev) => ({
      ...prev,
      teamInvites: prev.teamInvites.filter((invite) => invite.email !== email),
    }));
  }, []);

  const updateTeamInviteRole = useCallback((email: string, role: AgencyRole) => {
    setState((prev) => ({
      ...prev,
      teamInvites: prev.teamInvites.map((invite) =>
        invite.email === email ? { ...invite, role } : invite
      ),
    }));
  }, []);

  const flattenSelectedPlatforms = useCallback((selection: PlatformSelection) => {
    return Object.values(selection || {}).flat().filter(Boolean);
  }, []);

  // ============================================================
  // API METHODS
  // ============================================================

  const loadExistingClients = useCallback(async () => {
    try {
      setState((prev) => ({ ...prev, loading: true, error: null }));

      const principalClerkId = orgId || userId;
      if (!principalClerkId) {
        setState((prev) => ({
          ...prev,
          existingClients: [],
          loading: false,
        }));
        return;
      }

      const existingAgencyResponse = await authorizedApiFetch<{ data: Array<{ id: string }>; error: null }>(
        `/api/agencies?clerkUserId=${encodeURIComponent(principalClerkId)}`,
        { getToken }
      );

      if (!existingAgencyResponse.data?.length) {
        setState((prev) => ({
          ...prev,
          existingClients: [],
          loading: false,
        }));
        return;
      }

      const json = await authorizedApiFetch<{ data: { data?: Client[] } | Client[]; error: null }>('/api/clients', {
        getToken,
      });

      const resolvedClients = Array.isArray(json.data)
        ? json.data
        : Array.isArray(json.data?.data)
          ? json.data.data
          : [];

      setState((prev) => ({
        ...prev,
        existingClients: resolvedClients,
        loading: false,
      }));
    } catch (err) {
      if (err instanceof AuthorizedApiError && err.code === 'FORBIDDEN') {
        setState((prev) => ({
          ...prev,
          existingClients: [],
          loading: false,
          error: null,
        }));
        return;
      }

      const errorMessage = getApiErrorMessage(err, 'Failed to load clients');

      setState((prev) => ({
        ...prev,
        error: errorMessage,
        loading: false,
      }));
    }
  }, [getToken, orgId, userId]);

  const resolveAgency = useCallback(async () => {
    const userEmail = user?.primaryEmailAddress?.emailAddress || user?.emailAddresses?.[0]?.emailAddress;
    const principalClerkId = orgId || userId;
    const safeAgencyName = state.agencyName.trim().length > 0
      ? state.agencyName.trim()
      : (getAgencyNameFromEmail(userEmail) || 'My Agency');
    const safeAgencyWebsite = state.agencySettings.website?.trim() || undefined;
    const safeAgencyLogoUrl = state.agencySettings.logoUrl?.trim() || undefined;
    const affiliateClickToken = getAffiliateClickTokenFromDocument() || undefined;

    let agencyId = state.agencyId;
    const agencyResolvedFromState = Boolean(agencyId);
    let agencyResolvedFromExisting = false;

    if (!agencyId && principalClerkId) {
      const existingAgencyResponse = await authorizedApiFetch<{ data: Array<{ id: string }>; error: null }>(
        `/api/agencies?clerkUserId=${encodeURIComponent(principalClerkId)}`,
        { getToken }
      );

      if (existingAgencyResponse.data.length > 0) {
        agencyId = existingAgencyResponse.data[0].id;
        agencyResolvedFromExisting = true;
      }
    }

    if (!agencyId) {
      if (!userEmail) {
        throw new Error('Unable to resolve your account email from Clerk.');
      }

      const agencyJson = await authorizedApiFetch<{ data: { id: string }; error: null }>('/api/agencies', {
        method: 'POST',
        getToken,
        body: JSON.stringify({
          clerkUserId: principalClerkId || undefined,
          name: safeAgencyName,
          email: userEmail,
          affiliateClickToken,
          settings: {
            timezone: state.agencySettings.timezone,
            industry: state.agencySettings.industry,
            logoUrl: safeAgencyLogoUrl,
            website: safeAgencyWebsite,
          },
        }),
      });
      agencyId = agencyJson.data.id;

      if (affiliateClickToken) {
        trackAffiliateEvent('affiliate_signup_claimed', {
          source: 'affiliate_cookie',
          surface: 'unified_onboarding',
        });
      }
    }

    if (agencyId && (agencyResolvedFromExisting || agencyResolvedFromState)) {
      await authorizedApiFetch(`/api/agencies/${agencyId}`, {
        method: 'PATCH',
        getToken,
        body: JSON.stringify({
          name: safeAgencyName,
          settings: {
            timezone: state.agencySettings.timezone,
            industry: state.agencySettings.industry,
            logoUrl: safeAgencyLogoUrl || null,
            website: safeAgencyWebsite || null,
          },
        }),
      });
    }

    return {
      agencyId,
      safeAgencyName,
      safeAgencyWebsite,
      safeAgencyLogoUrl,
    };
  }, [getToken, orgId, state.agencyId, state.agencyName, state.agencySettings.industry, state.agencySettings.logoUrl, state.agencySettings.timezone, state.agencySettings.website, user, userId]);

  const createAgencyAndAccessRequest = useCallback(async (): Promise<CreateAgencyAndAccessRequestResult> => {
    if (!isValidClientData(state.clientName, state.clientEmail)) {
      const errorMessage = 'Select or create a client with a valid name and email before generating your first access link.';
      setState((prev) => ({
        ...prev,
        error: errorMessage,
        loading: false,
      }));

      return {
        ok: false,
        error: errorMessage,
      };
    }

    try {
      setState((prev) => ({ ...prev, loading: true, error: null }));
      const {
        agencyId,
        safeAgencyName,
        safeAgencyWebsite,
        safeAgencyLogoUrl,
      } = await resolveAgency();
      const safeClientName = state.clientName?.trim() || '';
      const safeClientEmail = state.clientEmail?.trim() || '';
      const selectedPlatforms = Object.entries(state.selectedPlatforms || {}).reduce<Record<string, string[]>>(
        (acc, [group, platforms]) => {
          const validPlatforms = (platforms || []).filter((platform) => typeof platform === 'string' && platform.trim().length > 0);
          if (validPlatforms.length > 0) {
            acc[group] = validPlatforms;
          }
          return acc;
        },
        {}
      );
      const safeSelectedPlatforms = Object.keys(selectedPlatforms).length > 0
        ? selectedPlatforms
        : { google: ['google'] };

      // Step 2: Create or select client
      let clientId = state.clientId;

      if (!clientId) {
        const clientJson = await authorizedApiFetch<{ data: { id: string }; error: null }>('/api/clients', {
          method: 'POST',
          getToken,
          body: JSON.stringify({
            name: safeClientName,
            company: safeClientName,
            email: safeClientEmail,
            language: 'en',
          }),
        });
        clientId = clientJson.data.id;
      }

      // Step 3: Create access request
      const accessRequestJson = await authorizedApiFetch<{ data: { id: string; uniqueToken: string; agencyId?: string }; error: null }>(
        '/api/access-requests',
        {
          method: 'POST',
          getToken,
          body: JSON.stringify({
            agencyId,
            clientId,
            clientName: safeClientName,
            clientEmail: safeClientEmail,
            platforms: safeSelectedPlatforms,
          }),
        }
      );

      const accessRequest = accessRequestJson.data;
      const resolvedAgencyId = accessRequest.agencyId || agencyId;
      const accessLink = buildAuthorizeUrl(accessRequest.uniqueToken);

      const timeToValue = Date.now() - state.startedAt;
      const requestedPlatforms = flattenSelectedPlatforms(state.selectedPlatforms);
      trackOnboardingEvent('first_access_link_generated', {
        agencyId: resolvedAgencyId,
        clientId,
        accessRequestId: accessRequest.id,
        access_request_token: accessRequest.uniqueToken,
        platformCount: requestedPlatforms.length,
        platforms: requestedPlatforms,
        timeToValueMs: timeToValue,
      });

      // Update state with generated link
      setState((prev) => ({
        ...prev,
        agencyName: safeAgencyName,
        agencySettings: {
          ...prev.agencySettings,
          logoUrl: safeAgencyLogoUrl || '',
          website: safeAgencyWebsite || '',
        },
        clientName: safeClientName,
        clientEmail: safeClientEmail,
        selectedPlatforms: safeSelectedPlatforms,
        agencyId: resolvedAgencyId,
        accessLink,
        accessRequestId: accessRequest.id,
        loading: false,
      }));

      void persistOnboardingProgress(resolvedAgencyId, {
        status: 'activated',
        startedAt: new Date(state.startedAt).toISOString(),
        activatedAt: new Date().toISOString(),
        lastCompletedStep: 3,
        lastVisitedStep: 4,
        accessRequestId: accessRequest.id,
      });

      return {
        ok: true,
        agencyId: resolvedAgencyId,
        accessRequestId: accessRequest.id,
        accessLink,
      };
    } catch (err) {
      const errorMessage = getApiErrorMessage(err, 'Network error. Please try again.');

      trackOnboardingEvent('onboarding_step_failed', {
        step: state.currentStep,
        message: errorMessage,
        timestamp: Date.now(),
      });

      setState((prev) => ({
        ...prev,
        error: errorMessage,
        loading: false,
      }));

      return {
        ok: false,
        error: errorMessage,
      };
    }
  }, [flattenSelectedPlatforms, persistOnboardingProgress, resolveAgency, state]);

  const deferUntilClientReady = useCallback(async () => {
    try {
      setState((prev) => ({ ...prev, loading: true, error: null }));

      const {
        agencyId,
        safeAgencyName,
        safeAgencyWebsite,
        safeAgencyLogoUrl,
      } = await resolveAgency();

      trackOnboardingEvent('onboarding_client_deferred', {
        version: 'unified_v1',
        step: state.currentStep,
        agencyId,
        timestamp: Date.now(),
      });

      setState((prev) => ({
        ...prev,
        agencyId,
        agencyName: safeAgencyName,
        agencySettings: {
          ...prev.agencySettings,
          logoUrl: safeAgencyLogoUrl || '',
          website: safeAgencyWebsite || '',
        },
        loading: false,
      }));

      await persistOnboardingProgress(agencyId, {
        status: 'in_progress',
        startedAt: new Date(state.startedAt).toISOString(),
        lastCompletedStep: 1,
        lastVisitedStep: 2,
      });

      router.push('/dashboard');
    } catch (err) {
      const errorMessage = getApiErrorMessage(err, 'Unable to finish setup right now.');

      setState((prev) => ({
        ...prev,
        error: errorMessage,
        loading: false,
      }));
    }
  }, [persistOnboardingProgress, resolveAgency, router, state.currentStep, state.startedAt]);

  const sendTeamInvites = useCallback(async (): Promise<boolean> => {
    if (state.teamInvites.length === 0) {
      return true;
    }

    if (!state.agencyId) {
      setState((prev) => ({
        ...prev,
        error: 'Agency is missing. Please regenerate your access link before inviting team members.',
      }));
      return false;
    }

    try {
      setState((prev) => ({ ...prev, loading: true, error: null }));

      await authorizedApiFetch(`/api/agencies/${state.agencyId}/members/bulk`, {
        method: 'POST',
        getToken,
        body: JSON.stringify({
          members: state.teamInvites.map((invite) => ({
            email: invite.email,
            role: invite.role,
          })),
        }),
      });

      trackOnboardingEvent('team_invites_sent', {
        count: state.teamInvites.length,
        timestamp: Date.now(),
      });

      setState((prev) => ({ ...prev, loading: false }));
      return true;
    } catch (err) {
      const errorMessage = getApiErrorMessage(err, 'Network error. Please try again.');

      trackOnboardingEvent('onboarding_step_failed', {
        step: state.currentStep,
        message: errorMessage,
        timestamp: Date.now(),
      });

      setState((prev) => ({
        ...prev,
        error: errorMessage,
        loading: false,
      }));
      return false;
    }
  }, [getToken, state.agencyId, state.currentStep, state.teamInvites]);

  // ============================================================
  // COMPLETION METHODS
  // ============================================================

  const completeOnboarding = useCallback(async () => {
    try {
      const {
        agencyId: resolvedAgencyId,
        safeAgencyName,
        safeAgencyWebsite,
        safeAgencyLogoUrl,
      } = await resolveAgency();

      if (!resolvedAgencyId) {
        throw new Error('Unable to complete onboarding because your agency could not be created.');
      }

      setState((prev) => ({
        ...prev,
        agencyId: resolvedAgencyId,
        agencyName: safeAgencyName,
        agencySettings: {
          ...prev.agencySettings,
          logoUrl: safeAgencyLogoUrl || '',
          website: safeAgencyWebsite || '',
        },
      }));

      const totalTime = Date.now() - state.startedAt;
      trackOnboardingEvent('onboarding_completed', {
        version: 'unified_v1',
        totalDurationMs: totalTime,
        stepsSkipped: state.teamInvites.length === 0 ? ['team_invite'] : [],
        accessRequestId: state.accessRequestId,
      });

      await persistOnboardingProgress(resolvedAgencyId, {
        status: 'completed',
        completedAt: new Date().toISOString(),
        lastCompletedStep: 6,
        lastVisitedStep: 6,
        accessRequestId: state.accessRequestId,
      });

      if (onComplete) {
        onComplete();
      } else {
        router.push('/dashboard');
      }
    } catch (err) {
      const errorMessage = getApiErrorMessage(err, 'Unable to complete onboarding.');

      setState((prev) => ({
        ...prev,
        error: errorMessage,
      }));
    }
  }, [onComplete, persistOnboardingProgress, resolveAgency, router, state]);

  const skipOnboarding = useCallback(() => {
    trackOnboardingEvent('onboarding_skipped', {
      version: 'unified_v1',
      step: state.currentStep,
      timestamp: Date.now(),
    });

    void persistOnboardingProgress(state.agencyId, {
      status: 'completed',
      dismissedAt: new Date().toISOString(),
      lastVisitedStep: state.currentStep,
      accessRequestId: state.accessRequestId,
    });

    // Navigate to dashboard
    router.push('/dashboard');
  }, [persistOnboardingProgress, router, state.accessRequestId, state.agencyId, state.currentStep]);

  useEffect(() => {
    if (!enableProgressHydration) {
      return;
    }

    if (hasHydratedProgressRef.current) {
      return;
    }

    const principalClerkId = orgId || userId;
    if (!principalClerkId) {
      return;
    }

    if (state.currentStep > 0 || state.agencyId) {
      return;
    }

    hasHydratedProgressRef.current = true;
    let cancelled = false;

    const hydrateProgress = async () => {
      try {
        const agencyLookup = await authorizedApiFetch<{ data: Array<{ id: string }>; error: null }>(
          `/api/agencies?clerkUserId=${encodeURIComponent(principalClerkId)}`,
          { getToken }
        );

        if (!agencyLookup.data.length) {
          return;
        }

        const resolvedAgencyId = agencyLookup.data[0].id;
        const onboardingStatus = await authorizedApiFetch<{ data: AgencyOnboardingStatusData; error: null }>(
          `/api/agencies/${resolvedAgencyId}/onboarding-status`,
          { getToken }
        );

        if (cancelled) {
          return;
        }

        const resumeStep = resolveOnboardingResumeStep(onboardingStatus.data);
        setState((prev) => ({
          ...prev,
          agencyId: resolvedAgencyId,
          currentStep: prev.currentStep > 0 ? prev.currentStep : resumeStep,
        }));
      } catch {
        // Non-blocking hydration path.
      }
    };

    void hydrateProgress();

    return () => {
      cancelled = true;
    };
  }, [enableProgressHydration, getToken, orgId, state.agencyId, state.currentStep, userId]);

  // ============================================================
  // ERROR HANDLING
  // ============================================================

  const setError = useCallback((error: string | null) => {
    setState((prev) => ({ ...prev, error }));
  }, []);

  const clearError = useCallback(() => {
    setState((prev) => ({ ...prev, error: null }));
  }, []);

  // ============================================================
  // AUTO-FILL FROM CLERK USER DATA
  // ============================================================

  useEffect(() => {
    // Pre-fill agency name from the account email domain.
    if (user && !state.agencyName) {
      const email = user.primaryEmailAddress?.emailAddress || user.emailAddresses?.[0]?.emailAddress;
      const suggestedName = getAgencyNameFromEmail(email) || 'My Agency';

      setState((prev) => ({
        ...prev,
        agencyName: suggestedName,
      }));
    }
  }, [user, state.agencyName]);

  // ============================================================
  // CONTEXT VALUE
  // ============================================================

  const value = useMemo<UnifiedOnboardingContextValue>(() => ({
    state,
    nextStep,
    prevStep,
    goToStep,
    canGoNext,
    canGoBack,
    canSkip,
    updateAgency,
    updateClient,
    updatePlatforms,
    addTeamInvite,
    removeTeamInvite,
    updateTeamInviteRole,
    loadExistingClients,
    createAgencyAndAccessRequest,
    deferUntilClientReady,
    sendTeamInvites,
    completeOnboarding,
    skipOnboarding,
    setError,
    clearError,
  }), [
    state,
    nextStep,
    prevStep,
    goToStep,
    canGoNext,
    canGoBack,
    canSkip,
    updateAgency,
    updateClient,
    updatePlatforms,
    addTeamInvite,
    removeTeamInvite,
    updateTeamInviteRole,
    loadExistingClients,
    createAgencyAndAccessRequest,
    deferUntilClientReady,
    sendTeamInvites,
    completeOnboarding,
    skipOnboarding,
    setError,
    clearError,
  ]);

  return (
    <UnifiedOnboardingContext.Provider value={value}>
      {children}
    </UnifiedOnboardingContext.Provider>
  );
}

// ============================================================
// HOOK
// ============================================================

export function useUnifiedOnboarding() {
  const context = useContext(UnifiedOnboardingContext);
  if (context === undefined) {
    throw new Error('useUnifiedOnboarding must be used within UnifiedOnboardingProvider');
  }
  return context;
}
