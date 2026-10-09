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
import { setAgencyViewerAnalyticsContext } from '@/lib/analytics/invite-funnel-properties';
import { getAffiliateClickTokenFromDocument } from '@/lib/affiliate-cookie';
import {
  resolveOnboardingResumeStep,
  type AgencyOnboardingStatusData,
} from '@/lib/query/onboarding';
import { ONBOARDING_TOTAL_STEPS } from '@/lib/onboarding-steps';
import { startAgencyMetaOAuth } from '@/lib/agency-meta-oauth';
import {
  META_DESTINATION_NOT_READY,
  isMetaGateBlocking,
  metaGateMessage,
  resolveMetaReadinessFromPlatforms,
  selectionIncludesMeta,
  type MetaPortfolioReadiness,
} from '@/lib/onboarding/meta-readiness';
import { isMetaPendingApproval, withoutMetaPlatforms } from '@/lib/meta-pending-approval';
import {
  MAX_RESTORABLE_STEP,
  clearOnboardingDraft,
  clearOnboardingReturnIntent,
  getSessionDraftStorage,
  isOnboardingMetaOutcome,
  loadOnboardingDraft,
  resolveRestoredStep,
  saveOnboardingDraft,
  setOnboardingReturnIntent,
} from '@/lib/onboarding/onboarding-draft';

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
  agencyNameError: string | null;
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
  requestProgressPersisted: boolean;

  // Team invites (Screen 4 - Optional)
  teamInvites: TeamInvite[];
  teamInvitesSent: number;

  // Agency Meta Business Portfolio readiness (gates Meta on the platform step)
  metaReadiness: MetaPortfolioReadiness;
  metaJustConnected: boolean;

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
  connectMetaPortfolio: () => Promise<void>;
  refreshMetaReadiness: () => Promise<void>;

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

/**
 * Google-first mode (NEXT_PUBLIC_META_PENDING_APPROVAL=true): Meta can't be in the
 * selection (restored drafts included), and an empty result falls back to Google so
 * the platform step never dead-ends. Flag off: the selection is returned unchanged.
 */
function applyMetaPendingSelection(selection: PlatformSelection): PlatformSelection {
  if (!isMetaPendingApproval()) return selection;
  const withoutMeta = withoutMetaPlatforms(selection);
  return Object.keys(withoutMeta).length > 0 ? withoutMeta : { google: ['google'] };
}
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
  agencyNameError: null,
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
  requestProgressPersisted: false,

  // Team invites
  teamInvites: [],
  teamInvitesSent: 0,

  // Agency Meta readiness
  metaReadiness: { status: 'idle' },
  metaJustConnected: false,

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
  /** Persist the pre-link draft in sessionStorage (reload / Meta OAuth round-trip). Defaults to enableProgressHydration. */
  enableDraftPersistence?: boolean;
}

export function UnifiedOnboardingProvider({
  children,
  onComplete,
  enableProgressHydration = true,
  enableDraftPersistence,
}: UnifiedOnboardingProviderProps) {
  const draftPersistenceEnabled = enableDraftPersistence ?? enableProgressHydration;
  const router = useRouter();
  const { userId, orgId, getToken } = useAuth();
  const { user } = useUser();

  const [state, setState] = useState<OnboardingState>(initialState);
  const hasHydratedProgressRef = useRef(false);
  const completionInFlightRef = useRef(false);
  const completionSucceededRef = useRef(false);
  const navigationInFlightRef = useRef(false);
  const draftRestoredRef = useRef(false);
  // True once we know whether the agency already exists (progress hydration finished or isn't running),
  // so the Meta check doesn't flash "not connected" before the agency id arrives.
  const [agencyLookupSettled, setAgencyLookupSettled] = useState(!enableProgressHydration);
  const [draftReady, setDraftReady] = useState(false);
  const principalClerkIdForDraft = orgId || userId || null;

  // ============================================================
  // DRAFT RESTORE (reload / OAuth round-trip)
  // ============================================================

  // Declared before progress hydration so both run in the same commit and the
  // hydration result keeps the restored step (it only fills step 0).
  useEffect(() => {
    if (!draftPersistenceEnabled || draftReady || !principalClerkIdForDraft) return;
    const storage = getSessionDraftStorage();
    const draft = loadOnboardingDraft(storage, principalClerkIdForDraft);

    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const metaOutcome = params.get('meta');
      if (isOnboardingMetaOutcome(metaOutcome)) {
        clearOnboardingReturnIntent(storage);
        params.delete('meta');
        const query = params.toString();
        window.history.replaceState(window.history.state, '', `${window.location.pathname}${query ? `?${query}` : ''}`);
        setState((prev) => ({
          ...prev,
          metaJustConnected: metaOutcome === 'connected',
          error: metaOutcome === 'error'
            ? 'The Meta connection did not finish. Try connecting your Business Portfolio again.'
            : prev.error,
        }));
      }
    }

    if (draft) {
      draftRestoredRef.current = true;
      const restoredStep = resolveRestoredStep(draft);
      setState((prev) => ({
        ...prev,
        currentStep: prev.currentStep > 0 ? prev.currentStep : restoredStep,
        agencyName: draft.agencyName?.trim() ? draft.agencyName : prev.agencyName,
        agencySettings: {
          ...prev.agencySettings,
          ...(draft.agencySettings?.timezone ? { timezone: draft.agencySettings.timezone } : {}),
          ...(draft.agencySettings?.industry ? { industry: draft.agencySettings.industry } : {}),
          ...(draft.agencySettings?.website !== undefined ? { website: draft.agencySettings.website } : {}),
        },
        clientId: draft.clientId || undefined,
        clientName: draft.clientName ?? prev.clientName,
        clientEmail: draft.clientEmail ?? prev.clientEmail,
        selectedPlatforms: applyMetaPendingSelection(draft.selectedPlatforms),
      }));
    }
    setDraftReady(true);
  }, [draftPersistenceEnabled, draftReady, principalClerkIdForDraft]);

  // Save the draft while the agency is on a pre-link step; drop it once the link exists.
  useEffect(() => {
    if (!draftPersistenceEnabled || !draftReady || !principalClerkIdForDraft) return;
    const storage = getSessionDraftStorage();
    if (state.accessRequestId) {
      clearOnboardingDraft(storage, principalClerkIdForDraft);
      return;
    }
    if (state.currentStep < 1 || state.currentStep > MAX_RESTORABLE_STEP) return;
    saveOnboardingDraft(storage, principalClerkIdForDraft, {
      currentStep: state.currentStep,
      agencyName: state.agencyName,
      agencySettings: {
        timezone: state.agencySettings.timezone,
        industry: state.agencySettings.industry,
        website: state.agencySettings.website,
      },
      clientId: state.clientId,
      clientName: state.clientName,
      clientEmail: state.clientEmail,
      selectedPlatforms: state.selectedPlatforms,
    });
  }, [
    draftPersistenceEnabled,
    draftReady,
    principalClerkIdForDraft,
    state.accessRequestId,
    state.currentStep,
    state.agencyName,
    state.agencySettings.timezone,
    state.agencySettings.industry,
    state.agencySettings.website,
    state.clientId,
    state.clientName,
    state.clientEmail,
    state.selectedPlatforms,
  ]);

  // ============================================================
  // ANALYTICS TRACKING
  // ============================================================

  // Analytics only: tag the onboarding invite copy/send events with the acting
  // Clerk user and agency so they join the invite funnel.
  useEffect(() => {
    if (!userId) return;
    setAgencyViewerAnalyticsContext({
      agencyId: state.agencyId ?? null,
      clerkUserId: userId,
      isInternal: null,
    });
  }, [state.agencyId, userId]);

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
        return false;
      }

      try {
        await authorizedApiFetch(`/api/agencies/${agencyId}/onboarding-progress`, {
          method: 'PATCH',
          getToken,
          body: JSON.stringify(progress),
        });
        return true;
      } catch {
        return false;
      }
    },
    [getToken]
  );

  // ============================================================
  // NAVIGATION METHODS
  // ============================================================

  const nextStep = useCallback(() => {
    if (navigationInFlightRef.current || state.currentStep >= ONBOARDING_TOTAL_STEPS - 1) return;
    const next = state.currentStep + 1;
    const advance = () => setState((prev) => ({ ...prev, currentStep: Math.min(prev.currentStep + 1, ONBOARDING_TOTAL_STEPS - 1), loading: false, error: null }));
    if (state.agencyId && state.accessRequestId) {
      navigationInFlightRef.current = true;
      setState((prev) => ({ ...prev, loading: true, error: null }));
      void persistOnboardingProgress(state.agencyId, {
          status: next >= 4 ? 'activated' : 'in_progress',
          startedAt: new Date(state.startedAt).toISOString(),
          lastCompletedStep: state.currentStep,
          lastVisitedStep: next,
          accessRequestId: state.accessRequestId,
        }).then((persisted) => {
          if (persisted) {
            advance();
          } else {
            setState((prev) => ({ ...prev, loading: false, error: 'Setup progress could not be saved. Please try again.' }));
          }
        }).finally(() => {
          navigationInFlightRef.current = false;
        });
      return;
    }
    advance();
  }, [persistOnboardingProgress, state.accessRequestId, state.agencyId, state.currentStep, state.startedAt]);

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
        return state.agencyName.trim().length >= 2;
      case 2: // Client step requires a real client before link generation
        return isValidClientData(state.clientName, state.clientEmail);
      case 3: // Platform step: Meta needs a connected agency Business Portfolio first
        return !isMetaGateBlocking(state.selectedPlatforms, state.metaReadiness);
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
      agencyNameError: null,
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
      selectedPlatforms: applyMetaPendingSelection(platforms),
    }));
  }, []);

  const addTeamInvite = useCallback((invite: TeamInvite) => {
    const email = invite.email.trim();
    setState((prev) => {
      if (prev.teamInvites.some((existing) => existing.email.trim().toLowerCase() === email.toLowerCase())) {
        return { ...prev, error: 'This email already has an invitation.' };
      }
      return { ...prev, error: null, teamInvites: [...prev.teamInvites, { ...invite, email }] };
    });
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
        agencyNameError: /already exists|duplicate/i.test(errorMessage) ? errorMessage : prev.agencyNameError,
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

    if (!state.accessRequestId && isMetaGateBlocking(state.selectedPlatforms, state.metaReadiness)) {
      const errorMessage = metaGateMessage(state.metaReadiness);
      setState((prev) => ({ ...prev, error: errorMessage, loading: false }));
      return { ok: false, error: errorMessage };
    }

    try {
      setState((prev) => ({ ...prev, loading: true, error: null }));
      if (state.agencyId && state.accessRequestId && state.accessLink) {
        const persisted = state.requestProgressPersisted || await persistOnboardingProgress(state.agencyId, {
          status: 'activated',
          startedAt: new Date(state.startedAt).toISOString(),
          activatedAt: new Date().toISOString(),
          lastCompletedStep: 3,
          lastVisitedStep: 4,
          accessRequestId: state.accessRequestId,
        });
        if (!persisted) throw new Error('Your access request is saved, but setup progress could not be saved. Please try again.');
        setState((prev) => ({ ...prev, requestProgressPersisted: true, loading: false }));
        return { ok: true, agencyId: state.agencyId, accessRequestId: state.accessRequestId, accessLink: state.accessLink };
      }
      const {
        agencyId,
        safeAgencyName,
        safeAgencyWebsite,
        safeAgencyLogoUrl,
      } = await resolveAgency();
      const safeClientName = state.clientName?.trim() || '';
      const safeClientEmail = state.clientEmail?.trim() || '';
      const selectedPlatforms = Object.entries(applyMetaPendingSelection(state.selectedPlatforms)).reduce<Record<string, string[]>>(
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
        loading: true,
      }));

      const progressPersisted = await persistOnboardingProgress(resolvedAgencyId, {
        status: 'activated',
        startedAt: new Date(state.startedAt).toISOString(),
        activatedAt: new Date().toISOString(),
        lastCompletedStep: 3,
        lastVisitedStep: 4,
        accessRequestId: accessRequest.id,
      });
      if (!progressPersisted) throw new Error('Your access request is saved, but setup progress could not be saved. Please try again.');
      setState((prev) => ({ ...prev, requestProgressPersisted: true, loading: false }));

      return {
        ok: true,
        agencyId: resolvedAgencyId,
        accessRequestId: accessRequest.id,
        accessLink,
      };
    } catch (err) {
      const metaNotReady = err instanceof AuthorizedApiError && err.code === META_DESTINATION_NOT_READY;
      const errorMessage = metaNotReady
        ? metaGateMessage({ status: 'not_connected' })
        : getApiErrorMessage(err, 'Network error. Please try again.');

      trackOnboardingEvent('onboarding_step_failed', {
        step: state.currentStep,
        message: errorMessage,
        timestamp: Date.now(),
      });

      setState((prev) => ({
        ...prev,
        error: errorMessage,
        loading: false,
        // The API disagrees with our cached readiness: re-check so the inline panel shows the fix.
        ...(metaNotReady ? { metaReadiness: { status: 'idle' as const } } : {}),
      }));

      return {
        ok: false,
        error: errorMessage,
      };
    }
  }, [flattenSelectedPlatforms, persistOnboardingProgress, resolveAgency, state]);

  // ============================================================
  // AGENCY META BUSINESS PORTFOLIO (platform step gate)
  // ============================================================

  const metaSelected = selectionIncludesMeta(state.selectedPlatforms);
  const metaReadinessRequestRef = useRef(0);

  const refreshMetaReadiness = useCallback(async () => {
    const requestId = ++metaReadinessRequestRef.current;
    if (!state.agencyId) {
      setState((prev) => ({ ...prev, metaReadiness: { status: 'not_connected' } }));
      return;
    }
    setState((prev) => ({ ...prev, metaReadiness: { status: 'loading' } }));
    try {
      const json = await authorizedApiFetch<{ data: unknown }>(
        `/agency-platforms/available?agencyId=${encodeURIComponent(state.agencyId)}`,
        { getToken }
      );
      if (requestId !== metaReadinessRequestRef.current) return;
      setState((prev) => ({ ...prev, metaReadiness: resolveMetaReadinessFromPlatforms(json.data) }));
    } catch (err) {
      if (requestId !== metaReadinessRequestRef.current) return;
      setState((prev) => ({
        ...prev,
        metaReadiness: {
          status: 'error',
          message: getApiErrorMessage(err, 'Could not check your Meta connection.'),
        },
      }));
    }
  }, [getToken, state.agencyId]);

  // Check readiness whenever Meta is selected on the platform step (and again
  // after the agency id resolves or the API reported it not ready).
  useEffect(() => {
    if (state.currentStep !== 3 || !metaSelected) return;
    if (state.metaReadiness.status !== 'idle') return;
    if (!state.agencyId && !agencyLookupSettled) return; // stays "Checking…" until the agency lookup finishes
    void refreshMetaReadiness();
  }, [agencyLookupSettled, metaSelected, refreshMetaReadiness, state.agencyId, state.currentStep, state.metaReadiness.status]);

  useEffect(() => {
    // A newly resolved agency id invalidates a "no agency, so not connected" verdict.
    setState((prev) => (prev.metaReadiness.status === 'idle' ? prev : { ...prev, metaReadiness: { status: 'idle' } }));
  }, [state.agencyId]);

  const connectMetaPortfolio = useCallback(async () => {
    const userEmail = user?.primaryEmailAddress?.emailAddress || user?.emailAddresses?.[0]?.emailAddress;
    if (!userEmail) {
      setState((prev) => ({ ...prev, error: 'Unable to resolve your account email from Clerk.' }));
      return;
    }

    const storage = getSessionDraftStorage();
    try {
      setState((prev) => ({ ...prev, loading: true, error: null }));
      const { agencyId } = await resolveAgency();
      if (!agencyId) throw new Error('Unable to set up your agency. Please try again.');

      // Persist everything first: the OAuth redirect leaves the page.
      const selectedPlatforms = selectionIncludesMeta(state.selectedPlatforms)
        ? state.selectedPlatforms
        : { ...state.selectedPlatforms, meta: ['meta'] };
      saveOnboardingDraft(storage, principalClerkIdForDraft, {
        currentStep: 3,
        agencyName: state.agencyName,
        agencySettings: {
          timezone: state.agencySettings.timezone,
          industry: state.agencySettings.industry,
          website: state.agencySettings.website,
        },
        clientId: state.clientId,
        clientName: state.clientName,
        clientEmail: state.clientEmail,
        selectedPlatforms,
      });
      setOnboardingReturnIntent(storage, { step: 3, platform: 'meta' });
      setState((prev) => ({ ...prev, agencyId }));

      trackOnboardingEvent('onboarding_meta_connect_started', {
        version: 'unified_v1',
        step: state.currentStep,
        agencyId,
        timestamp: Date.now(),
      });

      await startAgencyMetaOAuth({ agencyId, userEmail, getToken });
    } catch (err) {
      clearOnboardingReturnIntent(storage);
      setState((prev) => ({
        ...prev,
        loading: false,
        error: getApiErrorMessage(err, 'Could not start the Meta connection. Please try again.'),
      }));
    }
  }, [getToken, principalClerkIdForDraft, resolveAgency, state.agencyName, state.agencySettings.industry, state.agencySettings.timezone, state.agencySettings.website, state.clientEmail, state.clientId, state.clientName, state.currentStep, state.selectedPlatforms, user]);

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

      clearOnboardingDraft(getSessionDraftStorage(), principalClerkIdForDraft);
      router.push('/dashboard');
    } catch (err) {
      const errorMessage = getApiErrorMessage(err, 'Unable to finish setup right now.');

      setState((prev) => ({
        ...prev,
        error: errorMessage,
        loading: false,
      }));
    }
  }, [persistOnboardingProgress, principalClerkIdForDraft, resolveAgency, router, state.currentStep, state.startedAt]);

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

      const response = await authorizedApiFetch<{ data: Array<unknown> | { invited?: number } }>(`/api/agencies/${state.agencyId}/members/bulk`, {
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
        count: Array.isArray(response.data)
          ? response.data.length
          : typeof response.data?.invited === 'number' ? response.data.invited : 0,
        timestamp: Date.now(),
      });

      const confirmedCount = Array.isArray(response.data)
        ? response.data.length
        : typeof response.data?.invited === 'number' ? response.data.invited : 0;
      setState((prev) => ({ ...prev, teamInvitesSent: confirmedCount, loading: false }));
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
    if (completionInFlightRef.current || completionSucceededRef.current) return;
    completionInFlightRef.current = true;
    setState((prev) => ({ ...prev, loading: true, error: null }));

    try {
      if (!state.agencyId || !state.accessRequestId) {
        throw new Error('Your saved request is unavailable. Open the dashboard to continue.');
      }

      const persisted = await persistOnboardingProgress(state.agencyId, {
        status: 'completed',
        completedAt: new Date().toISOString(),
        lastCompletedStep: 6,
        lastVisitedStep: 6,
        accessRequestId: state.accessRequestId,
      });
      if (!persisted) throw new Error('Setup could not be saved. Please try again.');
      completionSucceededRef.current = true;

      const totalTime = Date.now() - state.startedAt;
      trackOnboardingEvent('onboarding_completed', {
        version: 'unified_v1',
        totalDurationMs: totalTime,
        stepsSkipped: state.teamInvitesSent === 0 ? ['team_invite'] : [],
        accessRequestId: state.accessRequestId,
      });

      setState((prev) => ({ ...prev, loading: false, completedSteps: new Set([...prev.completedSteps, 6]) }));

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
        loading: false,
      }));
    } finally {
      completionInFlightRef.current = false;
    }
  }, [onComplete, persistOnboardingProgress, router, state]);

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
      setAgencyLookupSettled(true);
      return;
    }

    hasHydratedProgressRef.current = true;
    let cancelled = false;

    const hydrateProgress = async () => {
      try {
        const agencyLookup = await authorizedApiFetch<{ data: Array<{ id: string; name?: string; settings?: Partial<AgencySettings> }>; error: null }>(
          `/api/agencies?clerkUserId=${encodeURIComponent(principalClerkId)}`,
          { getToken }
        );

        if (!agencyLookup.data.length) {
          return;
        }

        const agency = agencyLookup.data[0];
        const resolvedAgencyId = agency.id;
        setState((prev) => ({
          ...prev,
          agencyId: resolvedAgencyId,
          // A restored draft holds what the agency typed before reloading; keep it.
          agencyName: draftRestoredRef.current && prev.agencyName ? prev.agencyName : agency.name || prev.agencyName,
          agencySettings: draftRestoredRef.current
            ? { ...prev.agencySettings, ...agency.settings, ...prev.agencySettings }
            : { ...prev.agencySettings, ...agency.settings },
        }));
        const onboardingStatus = await authorizedApiFetch<{ data: AgencyOnboardingStatusData; error: null }>(
          `/api/agencies/${resolvedAgencyId}/onboarding-status`,
          { getToken }
        );

        if (cancelled) {
          return;
        }

        const resumeStep = resolveOnboardingResumeStep(onboardingStatus.data);
        if (onboardingStatus.data.step.firstRequest || resumeStep >= 4) {
          clearOnboardingDraft(getSessionDraftStorage(), principalClerkId);
          router.replace('/dashboard');
          return;
        }
        setState((prev) => ({
          ...prev,
          currentStep: prev.currentStep > 0 ? prev.currentStep : Math.min(resumeStep, 2),
        }));
      } catch {
        // Non-blocking hydration path.
      } finally {
        setAgencyLookupSettled(true);
      }
    };

    void hydrateProgress();

    return () => {
      cancelled = true;
    };
  }, [enableProgressHydration, getToken, orgId, userId]);

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

      // Functional check: a draft restored in the same commit must win over the suggestion.
      setState((prev) => (prev.agencyName ? prev : { ...prev, agencyName: suggestedName }));
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
    connectMetaPortfolio,
    refreshMetaReadiness,
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
    connectMetaPortfolio,
    refreshMetaReadiness,
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
