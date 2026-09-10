/**
 * AccessRequestContext
 *
 * Phase 5: State management for Enhanced Access Request Creation wizard.
 * Manages form state, validation, and API submission across 4 steps.
 */

'use client';

import { createContext, useContext, useState, useCallback, ReactNode, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { QueryClient } from '@tanstack/react-query';
import { Client, AccessLevel, AccessRequestTemplate, IntakeField } from '@agency-platform/shared';
import { transformPlatformsForAPI } from '@/lib/transform-platforms';
import { createAccessRequest, type CreateAccessRequestPayload } from '@/lib/api/access-requests';
import posthog from 'posthog-js';

// ============================================================
// TYPES
// ============================================================

// Re-exported so existing consumers keep importing IntakeField from this module.
export type { IntakeField };

export interface BrandingConfig {
  logoUrl: string;
  primaryColor: string;
  subdomain: string;
}

export interface AccessRequestFormState {
  // Step 0: Template Selection
  selectedTemplate: AccessRequestTemplate | null;

  // Step 1: Client Selection
  client: Client | null;
  externalReference: string;

  // Step 2: Platform & Access Level
  selectedPlatforms: Record<string, string[]>; // { google: ['google_ads', 'ga4'], meta: ['meta_ads'] }
  globalAccessLevel: AccessLevel | null;
  platformAccessLevels: Record<string, AccessLevel>; // Per-platform access level overrides

  // Step 3: Intake Form Builder
  intakeFields: IntakeField[];

  // Step 4: Branding
  branding: BrandingConfig;

  // Meta state
  currentStep: number;
  submitting: boolean;
  error: string | null;
}

interface AccessRequestContextValue {
  state: AccessRequestFormState;
  updateTemplate: (template: AccessRequestTemplate | null) => void;
  updateClient: (client: Client) => void;
  updateExternalReference: (externalReference: string) => void;
  updatePlatforms: (platforms: Record<string, string[]>) => void;
  updateAccessLevel: (level: AccessLevel) => void;
  updatePlatformAccessLevel: (group: string, level: AccessLevel) => void;
  updateIntakeFields: (fields: IntakeField[]) => void;
  updateBranding: (branding: Partial<BrandingConfig>) => void;
  setStep: (step: number) => void;
  setError: (error: string | null) => void;
  submitRequest: () => Promise<void>;
  resetForm: () => void;
  validateStep: (step: number) => { valid: boolean; error?: string };
}

// ============================================================
// CONTEXT
// ============================================================

const AccessRequestContext = createContext<AccessRequestContextValue | undefined>(undefined);

// ============================================================
// INITIAL STATE
// ============================================================

const initialState: AccessRequestFormState = {
  selectedTemplate: null,
  client: null,
  externalReference: '',
  selectedPlatforms: {},
  globalAccessLevel: 'standard', // Smart default: standard access level
  platformAccessLevels: {}, // Per-platform access level overrides
  intakeFields: [
    {
      id: '1',
      label: 'Company Website',
      type: 'url',
      required: true,
      order: 0,
    },
  ],
  branding: {
    logoUrl: '',
    primaryColor: '#FF6B35',
    subdomain: '',
  },
  currentStep: 1, // Start at step 1 for 4-step flow
  submitting: false,
  error: null,
};

// ============================================================
// PROVIDER
// ============================================================

interface AccessRequestProviderProps {
  children: ReactNode;
  agencyId: string;
  queryClient?: QueryClient;
  getToken?: () => Promise<string | null>;
}

export function AccessRequestProvider({
  children,
  agencyId,
  queryClient,
  getToken,
}: AccessRequestProviderProps) {
  const router = useRouter();
  const [state, setState] = useState<AccessRequestFormState>(initialState);

  // ============================================================
  // UPDATE METHODS
  // ============================================================

  const updateTemplate = useCallback((template: AccessRequestTemplate | null) => {
    setState((prev) => {
      const newState = { ...prev, selectedTemplate: template };

      // When template is selected, populate form state with template data
      if (template) {
        newState.selectedPlatforms = template.platforms || {};
        newState.globalAccessLevel = template.globalAccessLevel || 'standard';

        // Initialize platformAccessLevels from globalAccessLevel for all platforms in the template
        const templatePlatformAccessLevels: Record<string, AccessLevel> = {};
        Object.keys(template.platforms || {}).forEach((platformGroup) => {
          templatePlatformAccessLevels[platformGroup] = template.globalAccessLevel || 'standard';
        });
        newState.platformAccessLevels = templatePlatformAccessLevels;

        newState.intakeFields = template.intakeFields || [];
        newState.branding = {
          logoUrl: template.branding?.logoUrl || '',
          primaryColor: template.branding?.primaryColor || '#FF6B35',
          subdomain: template.branding?.subdomain || '',
        };
      }

      return newState;
    });
  }, []);

  const updateClient = useCallback((client: Client) => {
    setState((prev) => ({ ...prev, client }));
  }, []);

  const updateExternalReference = useCallback((externalReference: string) => {
    setState((prev) => ({ ...prev, externalReference }));
  }, []);

  const updatePlatforms = useCallback((platforms: Record<string, string[]>) => {
    setState((prev) => {
      // Identify newly added platform groups
      const newGroups = Object.keys(platforms).filter(
        (group) => !Object.keys(prev.selectedPlatforms).includes(group)
      );

      // Identify removed platform groups
      const removedGroups = Object.keys(prev.selectedPlatforms).filter(
        (group) => !Object.keys(platforms).includes(group)
      );

      // Initialize platformAccessLevels for new groups from globalAccessLevel
      const newPlatformAccessLevels = { ...prev.platformAccessLevels };
      newGroups.forEach((group) => {
        if (!newPlatformAccessLevels[group]) {
          newPlatformAccessLevels[group] = prev.globalAccessLevel || 'standard';
        }
      });

      // Remove platformAccessLevels entries for removed groups
      removedGroups.forEach((group) => {
        delete newPlatformAccessLevels[group];
      });

      return {
        ...prev,
        selectedPlatforms: platforms,
        platformAccessLevels: newPlatformAccessLevels,
      };
    });
  }, []);

  const updateAccessLevel = useCallback((level: AccessLevel) => {
    setState((prev) => {
      // When global access level changes, also update all existing platformAccessLevels entries
      const updatedPlatformAccessLevels = { ...prev.platformAccessLevels };
      Object.keys(prev.selectedPlatforms).forEach((group) => {
        updatedPlatformAccessLevels[group] = level;
      });

      return {
        ...prev,
        globalAccessLevel: level,
        platformAccessLevels: updatedPlatformAccessLevels,
      };
    });
  }, []);

  const updatePlatformAccessLevel = useCallback((group: string, level: AccessLevel) => {
    setState((prev) => ({
      ...prev,
      platformAccessLevels: { ...prev.platformAccessLevels, [group]: level },
    }));
  }, []);

  const updateIntakeFields = useCallback((fields: IntakeField[]) => {
    setState((prev) => ({ ...prev, intakeFields: fields }));
  }, []);

  const updateBranding = useCallback((branding: Partial<BrandingConfig>) => {
    setState((prev) => ({
      ...prev,
      branding: { ...prev.branding, ...branding },
    }));
  }, []);

  const setStep = useCallback((step: number) => {
    setState((prev) => ({ ...prev, currentStep: step, error: null }));
  }, []);

  const setError = useCallback((error: string | null) => {
    setState((prev) => ({ ...prev, error }));
  }, []);

  const resetForm = useCallback(() => {
    setState(initialState);
  }, []);

  // ============================================================
  // VALIDATION
  // ============================================================

  const validateStep = useCallback(
    (step: number): { valid: boolean; error?: string } => {
      switch (step) {
        case 1:
          // Step 1: Fundamentals (Template + Client + Auth Model)
          // Template is optional, but Client is required
          if (!state.client) {
            return { valid: false, error: 'Please select a client' };
          }
          return { valid: true };

        case 2:
          // Step 2: Platforms + Access Level
          // At least one platform product required
          const platformCount = Object.values(state.selectedPlatforms).reduce(
            (sum, products) => sum + products.length,
            0
          );

          if (platformCount === 0) {
            return { valid: false, error: 'Please select at least one platform' };
          }

          // Access level has default value (standard), so always valid
          return { valid: true };

        case 3:
          // Step 3: Customize (Intake Fields + Branding)
          // Intake fields validation - all labels must be filled
          const invalidFields = state.intakeFields.filter((field) => !field.label.trim());
          if (invalidFields.length > 0) {
            return { valid: false, error: 'All intake fields must have a label' };
          }

          // Subdomain validation (optional field)
          if (state.branding.subdomain) {
            // Alphanumeric + hyphen, 3-63 chars, no leading/trailing hyphens
            const subdomainRegex = /^[a-z0-9]([a-z0-9-]{1,61}[a-z0-9])?$/;
            if (!subdomainRegex.test(state.branding.subdomain)) {
              return {
                valid: false,
                error: 'Subdomain must be 3-63 characters, alphanumeric with hyphens',
              };
            }
          }
          return { valid: true };

        case 4:
          // Step 4: Review - No validation needed (summary only)
          return { valid: true };

        default:
          return { valid: true };
      }
    },
    [state]
  );

  // ============================================================
  // SUBMIT
  // ============================================================

  const submitRequest = useCallback(async () => {
    setState((prev) => ({ ...prev, submitting: true, error: null }));

    try {
      // Transform platforms to API format
      const platformsConfig = transformPlatformsForAPI(
        state.selectedPlatforms,
        state.platformAccessLevels,
        state.globalAccessLevel! // Fallback default
      );

      // Build payload
      const payload: CreateAccessRequestPayload = {
        agencyId,
        clientId: state.client?.id,
        clientName: state.client?.name || '',
        clientEmail: state.client?.email || '',
        externalReference: state.externalReference.trim() || undefined,
        platforms: platformsConfig,
        intakeFields: state.intakeFields.filter((field) => field.label.trim()),
        branding: {
          logoUrl: state.branding.logoUrl || undefined,
          primaryColor: state.branding.primaryColor,
          subdomain: state.branding.subdomain || undefined,
        },
      };

      // Submit to API
      const result = await createAccessRequest(payload, getToken);

      if (result.error) {
        // Handle specific error codes
        if (result.error.code === 'SUBDOMAIN_TAKEN') {
          setState((prev) => ({
            ...prev,
            error: 'This subdomain is already taken. Please choose another.',
            currentStep: 4,
            submitting: false,
          }));
          return;
        }

        if (result.error.code === 'PLATFORMS_NOT_CONNECTED') {
          const missingPlatforms = result.error.details?.missingPlatforms || [];
          setState((prev) => ({
            ...prev,
            error: `Please connect these platforms first: ${missingPlatforms.join(', ')}`,
            currentStep: 2,
            submitting: false,
          }));
          return;
        }

        // Generic error
        setState((prev) => ({
          ...prev,
          error: result.error?.message || 'Failed to create access request',
          submitting: false,
        }));
        return;
      }

      // Success! Navigate to success page
      if (result.data) {
        // Reset submitting state before navigation
        setState((prev) => ({ ...prev, submitting: false }));

        // Track access request creation in PostHog
        const platformCount = Object.values(state.selectedPlatforms).reduce(
          (sum, products) => sum + products.length,
          0
        );
        posthog.capture('access_request_created', {
          access_request_id: result.data.id,
          agency_id: agencyId,
          client_id: state.client?.id,
          platform_count: platformCount,
          platforms: Object.keys(state.selectedPlatforms),
          access_level: state.globalAccessLevel,
          intake_fields_count: state.intakeFields.length,
          has_custom_branding: !!state.branding.logoUrl || state.branding.primaryColor !== '#FF6B35',
          used_template: !!state.selectedTemplate,
        });

        // Invalidate dashboard cache so it shows fresh data when user returns
        // We use the wildcard pattern to invalidate all dashboard queries
        queryClient?.invalidateQueries({ queryKey: ['dashboard'] });

        router.push(`/access-requests/${result.data.id}/success`);
      }
    } catch (err) {
      setState((prev) => ({
        ...prev,
        error: err instanceof Error ? err.message : 'Network error. Please try again.',
        submitting: false,
      }));
    }
  }, [state, agencyId, router, queryClient, getToken]);

  // ============================================================
  // CONTEXT VALUE
  // ============================================================

  const value = useMemo<AccessRequestContextValue>(() => ({
    state,
    updateTemplate,
    updateClient,
    updateExternalReference,
    updatePlatforms,
    updateAccessLevel,
    updatePlatformAccessLevel,
    updateIntakeFields,
    updateBranding,
    setStep,
    setError,
    submitRequest,
    resetForm,
    validateStep,
  }), [
    state,
    updateTemplate,
    updateClient,
    updateExternalReference,
    updatePlatforms,
    updateAccessLevel,
    updatePlatformAccessLevel,
    updateIntakeFields,
    updateBranding,
    setStep,
    setError,
    submitRequest,
    resetForm,
    validateStep,
  ]);

  return (
    <AccessRequestContext.Provider value={value}>{children}</AccessRequestContext.Provider>
  );
}

// ============================================================
// HOOK
// ============================================================

export function useAccessRequest() {
  const context = useContext(AccessRequestContext);
  if (context === undefined) {
    throw new Error('useAccessRequest must be used within AccessRequestProvider');
  }
  return context;
}
