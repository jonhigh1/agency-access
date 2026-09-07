/**
 * New Access Request Page - Phase 5 Enhanced
 *
 * Complete rewrite integrating:
 * - AccessRequestContext for state management
 * - ClientSelector for Step 1
 * - HierarchicalPlatformSelector + AccessLevelSelector for Step 2
 * - Framer Motion animations
 * - Enhanced progress indicator
 * - Platform count animations
 * - Save as Template modal on final step
 */

'use client';

import { FormEvent, useMemo, useState } from 'react';
import { useAuth } from '@clerk/nextjs';
import { useQueryClient, useQuery } from '@tanstack/react-query';
import { Plus, Trash2, Check, Loader2, AlertCircle, Save, Shield, ChevronDown } from 'lucide-react';
import { m, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';

// Phase 5 Components
import { ClientSelector } from '@/components/client-selector';
import { HierarchicalPlatformSelector } from '@/components/hierarchical-platform-selector';
import { AccessLevelSelector } from '@/components/access-level-selector';
import { SaveAsTemplateModal } from '@/components/save-as-template-modal';
import { FlowShell } from '@/components/flow/flow-shell';
import { SingleSelect } from '@/components/ui/single-select';

// Context & Utilities
import { AccessRequestProvider, useAccessRequest } from '@/contexts/access-request-context';
import type { IntakeField } from '@/contexts/access-request-context';
import { getPlatformCount } from '@/lib/transform-platforms';
import { useAuthOrBypass } from '@/lib/dev-auth';
import { useUserAgency, fetchActiveAgencyPlatformConnections } from '@/hooks/use-user-agency';
import { ACCESS_LEVEL_DESCRIPTIONS, PLATFORM_NAMES } from '@agency-platform/shared';

// ============================================================
// WIZARD CONTENT (Inner Component)
// ============================================================

function AccessRequestWizardContent() {
  const clerkAuth = useAuth();
  const { userId, orgId } = useAuthOrBypass(clerkAuth);
  const { getToken } = clerkAuth;
  const router = useRouter();
  const {
    state,
    updateClient,
    updateExternalReference,
    updatePlatforms,
    updateAccessLevel,
    updatePlatformAccessLevel,
    updateIntakeFields,
    updateBranding,
    setStep,
    submitRequest,
    validateStep,
  } = useAccessRequest();

  // Save as Template modal state
  const [isSaveTemplateModalOpen, setIsSaveTemplateModalOpen] = useState(false);

  // Customize tab state (for Step 3: Form Fields | Branding)
  const [customizeTab, setCustomizeTab] = useState<'fields' | 'branding'>('fields');

  // Advanced settings state (for Step 1: Optional downstream configuration)
  const [advancedSettingsExpanded, setAdvancedSettingsExpanded] = useState(false);

  const principalClerkId = orgId || userId;

  // Fetch agency by clerkUserId - shared hook with the connections page
  const { data: agencyData } = useUserAgency();

  // Use the agency's UUID id
  const agencyId = agencyData?.id;

  // Fetch active platform connections from an uncached source for real-time auth model status
  const {
    data: platformConnections = [],
  } = useQuery<
    Array<{
      platform: string;
      name: string;
      connected: boolean;
      status?: string;
      connectedEmail?: string;
      connectedAt?: string;
      expiresAt?: string;
      metadata?: Record<string, unknown>;
    }>
  >({
    queryKey: ['active-agency-platform-connections', agencyId],
    queryFn: async () => {
      if (!agencyId) return [];
      const activeConnections = await fetchActiveAgencyPlatformConnections(agencyId, getToken);

      return activeConnections.map((connection) => ({
        platform: connection.platform,
        name: PLATFORM_NAMES[connection.platform as keyof typeof PLATFORM_NAMES] || connection.platform,
        connected: true,
        status: connection.status || 'active',
        connectedEmail:
          connection.agencyEmail ||
          connection.connectedBy ||
          (connection.metadata?.email as string | undefined) ||
          (connection.metadata?.userEmail as string | undefined),
        connectedAt: connection.connectedAt,
        expiresAt: connection.expiresAt,
        metadata: connection.metadata,
      }));
    },
    enabled: !!agencyId,
  });

  // Calculate platform counts
  const platformCount = useMemo(
    () => getPlatformCount(state.selectedPlatforms),
    [state.selectedPlatforms]
  );

  // Validation for current step
  const currentStepValid = useMemo(() => {
    return validateStep(state.currentStep).valid;
  }, [state.currentStep, validateStep]);

  // Intake field handlers
  const addIntakeField = () => {
    const newField: IntakeField = {
      id: String(state.intakeFields.length + 1),
      label: '',
      type: 'text',
      required: false,
      order: state.intakeFields.length,
    };
    updateIntakeFields([...state.intakeFields, newField]);
  };

  const removeIntakeField = (id: string) => {
    updateIntakeFields(state.intakeFields.filter((f) => f.id !== id));
  };

  const updateIntakeField = (id: string, updates: Partial<IntakeField>) => {
    updateIntakeFields(state.intakeFields.map((f) => (f.id === id ? { ...f, ...updates } : f)));
  };

  // Submit handler
  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    await submitRequest();
  };

  // Step labels (1-4 with new streamlined flow)
  const steps = [
    { number: 1, label: 'Fundamentals' },
    { number: 2, label: 'Platforms' },
    { number: 3, label: 'Customize' },
    { number: 4, label: 'Review' },
  ];

  return (
    <FlowShell
      title="New Access Request"
      description="Create a request for client authorization"
      step={state.currentStep}
      totalSteps={steps.length}
      steps={steps.map((step) => step.label)}
    >
      <form id="access-request-form" onSubmit={handleSubmit}>
        <AnimatePresence mode="wait">
          {/* Step 1: Fundamentals */}
          {state.currentStep === 1 && (
            <m.div
            key="step-1"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.3 }}
            className="space-y-6"
            >
            {/* Main Card */}
            <div className="bg-card rounded-lg shadow-sm border border-border p-6">
              <h2 className="text-xl font-semibold text-ink mb-1">Fundamentals</h2>
              <p className="text-base text-muted-foreground mb-6">
                Set up the basics for your access request
              </p>

              {/* Vertical Flow with Clear Sections */}
              <div className="relative space-y-10 pl-5">
                {/* Connecting line - runs through all sections */}
                <div className="absolute left-[18px] top-3 bottom-3 w-px bg-muted/40 pointer-events-none" />

                {/* Section 1: Client (Primary, Required) */}
                <div className="relative">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="relative z-10 h-9 w-9 rounded-full bg-coral/20 border-4 border-white flex items-center justify-center">
                      <span className="text-sm font-semibold text-danger-ink/90">1</span>
                    </div>
                    <div>
                      <label className="block text-base font-semibold text-ink">
                        Select Client <span className="text-danger-ink">*</span>
                      </label>
                      <p className="text-sm text-muted-foreground">Who is this access request for?</p>
                    </div>
                  </div>
                  <div className="ml-10">
                    <ClientSelector
                      agencyId={agencyId!}
                      value={state.client?.id}
                      onSelect={updateClient}
                    />
                  </div>
                </div>

                {/* Section 2: Advanced Settings (Optional) */}
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setAdvancedSettingsExpanded(!advancedSettingsExpanded)}
                    aria-expanded={advancedSettingsExpanded}
                    className="flex w-full items-center gap-3 text-left group"
                  >
                    <div className="relative z-10 h-9 w-9 rounded-full bg-muted/30 border-4 border-white flex items-center justify-center">
                      <span className="text-sm font-semibold text-muted-foreground">2</span>
                    </div>
                    <div className="flex-1">
                      <span className="block text-base font-semibold text-ink hover:text-danger-ink transition-colors">
                        Advanced Settings <span className="text-muted-foreground font-normal">(Optional)</span>
                      </span>
                      <p className="text-sm text-muted-foreground">
                        {advancedSettingsExpanded
                          ? 'Hide optional fields for CRM matching and downstream automation'
                          : 'Reveal optional fields for CRM matching and downstream automation'}
                      </p>
                    </div>
                    <ChevronDown className={`h-5 w-5 text-muted-foreground transition-transform ${
                      advancedSettingsExpanded ? 'rotate-180' : ''
                    }`} />
                  </button>

                  {advancedSettingsExpanded && (
                    <m.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="ml-10 mt-4"
                    >
                      <label htmlFor="external-reference" className="block text-base font-semibold text-ink">
                        External Reference
                      </label>
                      <p className="mt-1 text-sm text-muted-foreground">
                        Optional CRM or internal ID for downstream matching
                      </p>
                      <input
                        id="external-reference"
                        type="text"
                        value={state.externalReference}
                        onChange={(event) => updateExternalReference(event.target.value)}
                        placeholder="crm-123"
                        maxLength={255}
                        className="mt-4 w-full rounded-lg border border-border bg-card px-4 py-2.5 text-base text-foreground focus:outline-none focus:ring-2 focus:ring-coral focus:border-transparent"
                      />
                      <p className="mt-2 text-xs text-muted-foreground">
                        Included in outbound webhook payloads to correlate events with your CRM or automation system.
                      </p>
                    </m.div>
                  )}
                </div>
              </div>
            </div>

            {/* Platform Quick Actions */}
            <div className="mt-4 p-4 bg-background border border-border rounded-lg flex items-center justify-between">
              <div>
                <p className="text-base font-medium text-ink">Need to connect platforms?</p>
                <p className="text-sm text-muted-foreground">Connect your agency's platform accounts to use delegated access</p>
              </div>
              <button
                type="button"
                onClick={() => router.push('/connections')}
                className="px-4 py-2.5 bg-accent hover:bg-accent text-foreground text-base rounded-lg transition-colors flex items-center gap-2"
              >
                <Plus className="h-4 w-4" />
                Manage Platform Connections
              </button>
            </div>

            {state.error && (
              <m.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-6 p-4 bg-coral/10 border border-coral/30 rounded-lg flex items-start gap-3"
              >
                <AlertCircle className="h-5 w-5 text-danger-ink flex-shrink-0 mt-0.5" />
                <p className="text-base text-danger-ink">{state.error}</p>
              </m.div>
            )}

            {/* Navigation */}
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setStep(2)}
                disabled={!state.client}
                className="px-8 py-3 bg-coral text-white text-base rounded-lg hover:bg-coral/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-95 shadow-brutalist hover:shadow-none hover:translate-y-[2px] font-medium"
              >
                Continue to Platforms
              </button>
            </div>
          </m.div>
          )}

          {/* Step 2: Platforms & Access Level */}
          {state.currentStep === 2 && (
            <m.div
            key="step-2"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.3 }}
            className="bg-card rounded-lg shadow-sm border border-border p-6"
            >
            <h2 className="text-lg font-semibold text-ink mb-1">Platforms & Access</h2>
            <p className="text-sm text-muted-foreground mb-6">
              Select which platforms to include in this access request
            </p>

            <div className="space-y-6">
              {/* Access Level Section - Prominent at top */}
              <AccessLevelSelector
                selectedAccessLevel={state.globalAccessLevel ?? undefined}
                onSelectionChange={updateAccessLevel}
              />

              {/* Platform Selection Section */}
              <div>
              <div className="flex items-baseline justify-between mb-3">
                <label className="block text-sm font-medium text-foreground">
                  Select Platforms
                </label>
                {platformCount > 0 && (
                  <span className="text-sm text-danger-ink font-medium">
                    {platformCount} selected
                  </span>
                )}
              </div>

              <HierarchicalPlatformSelector
                selectedPlatforms={state.selectedPlatforms}
                onSelectionChange={updatePlatforms}
                connectedPlatforms={platformConnections}
                agencyId={agencyId}
                platformAccessLevels={state.platformAccessLevels}
                onPlatformAccessLevelChange={updatePlatformAccessLevel}
              />

              {/* Info about connecting more platforms */}
              {platformConnections.filter((p: any) => p.connected).length > 0 && (
                <p className="mt-3 text-xs text-muted-foreground">
                  Only your connected platforms are shown.{' '}
                  <a href="/connections" className="text-danger-ink hover:text-danger-ink font-medium">
                    Connect more platforms
                  </a>{' '}
                  to include them in access requests.
                </p>
              )}
              </div>
            </div>

            {state.error && (
              <m.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-6 p-3 bg-coral/10 border border-coral/30 rounded-lg flex items-start gap-2"
              >
              <AlertCircle className="h-5 w-5 text-danger-ink flex-shrink-0 mt-0.5" />
              <p className="text-sm text-danger-ink">{state.error}</p>
              </m.div>
            )}

            <div className="mt-6 flex justify-between">
              <button
              type="button"
              onClick={() => setStep(1)}
              className="px-6 py-2.5 text-foreground hover:text-ink hover:bg-muted/30 rounded-lg transition-colors"
              >
              Back
              </button>
              <button
              type="button"
              onClick={() => setStep(3)}
              disabled={!currentStepValid}
              className="px-6 py-2.5 bg-coral text-white rounded-lg hover:bg-coral/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-95 shadow-brutalist hover:shadow-none hover:translate-y-[2px]"
              >
              Continue to Customize
              </button>
            </div>
            </m.div>
          )}

          {/* Step 3: Customize (Intake Fields + Branding with tabs) */}
          {state.currentStep === 3 && (
            <m.div
            key="step-3"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.3 }}
            className="bg-card rounded-lg shadow-sm border border-border p-6"
            >
            <h2 className="text-lg font-semibold text-ink mb-1">Customize</h2>
            <p className="text-sm text-muted-foreground mb-6">
              Add form fields and customize branding <span className="text-muted-foreground">(optional)</span>
            </p>

            {/* Simple Tabs - Form Fields | Branding */}
            <div className="mb-6">
              <div className="flex gap-4 border-b border-border">
                <button
                  type="button"
                  onClick={() => setCustomizeTab('fields')}
                  className={`pb-3 px-1 text-sm font-medium transition-colors ${
                    customizeTab === 'fields'
                      ? 'text-danger-ink border-b-2 border-coral'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  Form Fields ({state.intakeFields.length})
                </button>
                <button
                  type="button"
                  onClick={() => setCustomizeTab('branding')}
                  className={`pb-3 px-1 text-sm font-medium transition-colors ${
                    customizeTab === 'branding'
                      ? 'text-danger-ink border-b-2 border-coral'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  Branding
                </button>
              </div>
            </div>

            {/* Form Fields Tab */}
            {customizeTab === 'fields' && (
              <div className="space-y-3">
                <AnimatePresence mode="popLayout">
              {state.intakeFields.map((field, index) => (
                <m.div
                key={field.id}
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.2 }}
                className="flex items-start gap-3 p-4 border border-border rounded-lg hover:border-border transition-colors"
                >
                <div className="flex-1 space-y-3">
                  <input
                type="text"
                value={field.label}
                onChange={(e) => updateIntakeField(field.id, { label: e.target.value })}
                placeholder="Field label (e.g., Company Website)"
                className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:ring-2 focus:ring-ring focus:border-coral"
                  />
                  <div className="flex items-center gap-3">
                <SingleSelect
                  options={[
                    { value: 'text', label: 'Text' },
                    { value: 'email', label: 'Email' },
                    { value: 'phone', label: 'Phone' },
                    { value: 'url', label: 'URL' },
                    { value: 'textarea', label: 'Text Area' },
                  ]}
                  value={field.type}
                  onChange={(v) => updateIntakeField(field.id, { type: v as IntakeField['type'] })}
                  placeholder="Field type"
                  ariaLabel="Field type"
                  triggerClassName="flex-1 px-3 py-2 border border-border rounded-lg text-sm min-h-auto"
                />
                <label className="flex items-center gap-2 text-sm text-foreground cursor-pointer">
                  <input
                    type="checkbox"
                    checked={field.required}
                    onChange={(e) =>
              updateIntakeField(field.id, { required: e.target.checked })
                    }
                    className="h-4 w-4 rounded border-border text-danger-ink focus:ring-ring"
                  />
                  Required
                </label>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => removeIntakeField(field.id)}
                  className="p-2 text-danger-ink hover:bg-coral/10 rounded-lg transition-colors"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
                </m.div>
              ))}
              </AnimatePresence>

              <button
                type="button"
                onClick={addIntakeField}
                className="w-full flex items-center justify-center gap-2 p-4 border-2 border-dashed border-border rounded-lg text-muted-foreground hover:border-coral/40 hover:text-danger-ink hover:bg-coral/10 transition-all"
              >
                <Plus className="h-4 w-4" />
                Add Field
              </button>
              </div>
            )}

            {/* Branding Tab */}
            {customizeTab === 'branding' && (
              <div className="space-y-4">
                <div>
                  <label htmlFor="logoUrl" className="block text-sm font-medium text-foreground mb-1">
                    Logo URL
                  </label>
                  <input
                    type="url"
                    id="logoUrl"
                    value={state.branding.logoUrl}
                    onChange={(e) => updateBranding({ logoUrl: e.target.value })}
                    className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-ring focus:border-coral"
                    placeholder="https://your-agency.com/logo.png"
                  />
                </div>

                <div>
                  <label htmlFor="primaryColor" className="block text-sm font-medium text-foreground mb-1">
                    Primary Color
                  </label>
                  <div className="flex items-center gap-3">
                    <input
                      type="color"
                      id="primaryColor"
                      value={state.branding.primaryColor}
                      onChange={(e) => updateBranding({ primaryColor: e.target.value })}
                      className="h-11 w-20 rounded-lg cursor-pointer border border-border"
                    />
                    <input
                      type="text"
                      value={state.branding.primaryColor}
                      onChange={(e) => updateBranding({ primaryColor: e.target.value })}
                      className="flex-1 px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-ring focus:border-coral font-mono text-sm"
                      placeholder="#FF6B35"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="subdomain" className="block text-sm font-medium text-foreground mb-1">
                    Subdomain
                  </label>
                  <div className="flex items-center">
                    <input
                      type="text"
                      id="subdomain"
                      value={state.branding.subdomain}
                      onChange={(e) => updateBranding({ subdomain: e.target.value.toLowerCase() })}
                      className="flex-1 px-3 py-2 border border-border rounded-l-lg focus:ring-2 focus:ring-ring focus:border-coral"
                      placeholder="my-agency"
                      pattern="[a-z0-9]([a-z0-9-]{1,61}[a-z0-9])?"
                    />
                    <span className="px-4 py-2 bg-muted/30 border border-l-0 border-border rounded-r-lg text-muted-foreground text-sm">
                      .agencyplatform.com
                    </span>
                  </div>
                </div>

                {/* Preview */}
                {(state.branding.logoUrl || state.branding.primaryColor !== '#FF6B35') && (
                  <m.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    className="p-4 border border-border rounded-lg overflow-hidden"
                  >
                    <p className="text-sm font-medium text-foreground mb-3">Preview</p>
                    <div
                      className="p-6 rounded-lg text-center transition-colors"
                      style={{ backgroundColor: state.branding.primaryColor + '15' }}
                    >
                      {state.branding.logoUrl && (
                        <img
                          src={state.branding.logoUrl}
                          alt="Logo"
                          className="h-10 mx-auto mb-3 object-contain"
                          onError={(e) => {
                            e.currentTarget.style.display = 'none';
                          }}
                        />
                      )}
                      <h3 className="mb-1.5 text-lg font-semibold text-ink">
                        {state.client?.name || 'Your Client'}
                      </h3>
                      <span
                        aria-hidden
                        className="mx-auto mb-2 block h-1 w-10"
                        style={{ backgroundColor: state.branding.primaryColor }}
                      />
                      <p className="text-sm text-muted-foreground">
                        Authorize access to {platformCount} platform{platformCount !== 1 ? 's' : ''}
                      </p>
                    </div>
                  </m.div>
                )}
              </div>
            )}

            {state.error && (
              <m.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-6 p-3 bg-coral/10 border border-coral/30 rounded-lg flex items-start gap-2"
              >
                <AlertCircle className="h-5 w-5 text-danger-ink flex-shrink-0 mt-0.5" />
                <p className="text-sm text-danger-ink">{state.error}</p>
              </m.div>
            )}

            <div className="mt-6 flex justify-between">
              <button
                type="button"
                onClick={() => setStep(2)}
                className="px-6 py-2.5 text-foreground hover:text-ink hover:bg-muted/30 rounded-lg transition-colors"
              >
                Back
              </button>
              <button
                type="button"
                onClick={() => setStep(4)}
                className="px-6 py-2.5 bg-coral text-white rounded-lg hover:bg-coral/90 transition-all active:scale-95 shadow-brutalist hover:shadow-none hover:translate-y-[2px]"
              >
                Review & Create
              </button>
            </div>
            </m.div>
          )}

            {/* Step 4: Review & Create */}
            {state.currentStep === 4 && (
              <m.div
                key="step-4"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.3 }}
                className="space-y-6"
              >
                <div>
                  <h2 className="text-lg font-semibold text-ink mb-1">Review & Create</h2>
                  <p className="text-sm text-muted-foreground">
                    Review your access request settings before creating
                  </p>
                </div>

                {/* Summary Card */}
                <div className="bg-card rounded-lg shadow-sm border border-border divide-y divide-border">
                  {/* Client Section */}
                  <div className="p-4 flex items-start justify-between">
                    <div className="flex items-start gap-3">
                      <div className="h-10 w-10 rounded-full bg-muted/30 flex items-center justify-center flex-shrink-0">
                        <span className="text-lg font-semibold text-muted-foreground">
                          {state.client?.name?.charAt(0)?.toUpperCase() || '?'}
                        </span>
                      </div>
                      <div>
                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Client</p>
                        <p className="text-base font-semibold text-ink">{state.client?.name || 'Not selected'}</p>
                        {state.client?.email && (
                          <p className="text-sm text-muted-foreground">{state.client.email}</p>
                        )}
                        {state.externalReference && (
                          <p className="mt-2 text-xs font-mono text-muted-foreground">
                            External ref: {state.externalReference}
                          </p>
                        )}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setStep(1)}
                      className="text-xs font-semibold uppercase tracking-wide text-danger-ink hover:text-danger-ink"
                    >
                      Edit
                    </button>
                  </div>

                  {/* Platforms Section */}
                  <div className="p-4 flex items-start justify-between">
                    <div className="flex items-start gap-3">
                      <div className="h-10 w-10 rounded-full bg-teal/10 flex items-center justify-center flex-shrink-0">
                        <Check className="h-5 w-5 text-success-ink" />
                      </div>
                      <div className="flex-1">
                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Platforms</p>
                        <div className="flex items-center gap-2 flex-wrap mt-1">
                          {Object.entries(state.selectedPlatforms).map(([platform, products]) => (
                            <span
                              key={platform}
                              className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium bg-muted/30 text-foreground"
                            >
                              {platform} ({products.length})
                            </span>
                          ))}
                          {platformCount === 0 && (
                            <span className="text-sm text-muted-foreground italic">No platforms selected</span>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">{platformCount} product{platformCount !== 1 ? 's' : ''} selected</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setStep(2)}
                      className="text-xs font-semibold uppercase tracking-wide text-danger-ink hover:text-danger-ink"
                    >
                      Edit
                    </button>
                  </div>

                  {/* Access Level Section - Per-platform levels */}
                  <div className="p-4 flex items-start justify-between">
                    <div className="flex items-start gap-3">
                      <div className="h-10 w-10 rounded-full bg-accent flex items-center justify-center flex-shrink-0">
                        <Shield className="h-5 w-5 text-foreground" />
                      </div>
                      <div className="flex-1">
                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Access Level</p>
                        {Object.keys(state.selectedPlatforms).length === 0 ? (
                          <span className="text-sm text-muted-foreground italic">No platforms selected</span>
                        ) : (
                          <div className="flex flex-wrap gap-x-3 gap-y-1">
                            {Object.entries(state.selectedPlatforms).map(([platformGroup, products]) => {
                              if (products.length === 0) return null;
                              const level = state.platformAccessLevels[platformGroup] || state.globalAccessLevel;
                              return (
                                <span key={platformGroup} className="flex items-center gap-1.5">
                                  <span className="text-sm text-foreground">{PLATFORM_NAMES[platformGroup as keyof typeof PLATFORM_NAMES] || platformGroup}:</span>
                                  <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                                    level === 'admin'
                                      ? 'bg-coral/20 text-danger-ink'
                                      : level === 'standard'
                                      ? 'bg-muted/30 text-foreground'
                                      : level === 'read_only'
                                      ? 'bg-teal/20 text-success-ink'
                                      : 'bg-accent text-foreground'
                                  }`}>
                                    {ACCESS_LEVEL_DESCRIPTIONS[level]?.title.replace(' Access', '') ?? level}
                                  </span>
                                </span>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setStep(2)}
                      className="text-xs font-semibold uppercase tracking-wide text-danger-ink hover:text-danger-ink"
                    >
                      Edit
                    </button>
                  </div>

                  {/* Intake Fields Section */}
                  <div className="p-4 flex items-start justify-between">
                    <div className="flex items-start gap-3">
                      <div className="h-10 w-10 rounded-full bg-accent flex items-center justify-center flex-shrink-0">
                        <Plus className="h-5 w-5 text-foreground" />
                      </div>
                      <div>
                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Form Fields</p>
                        <p className="text-base font-semibold text-ink">
                          {state.intakeFields.length} field{state.intakeFields.length !== 1 ? 's' : ''}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {state.intakeFields.filter(f => f.required).length} required, {state.intakeFields.filter(f => !f.required).length} optional
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setStep(3)}
                      className="text-xs font-semibold uppercase tracking-wide text-danger-ink hover:text-danger-ink"
                    >
                      Edit
                    </button>
                  </div>

                  {/* Branding Section (if configured) */}
                  {(state.branding.logoUrl || state.branding.primaryColor !== '#FF6B35' || state.branding.subdomain) && (
                    <div className="p-4 flex items-start justify-between">
                      <div className="flex items-start gap-3">
                        <div className="h-10 w-10 rounded-full bg-accent flex items-center justify-center flex-shrink-0">
                          {state.branding.logoUrl ? (
                            <img src={state.branding.logoUrl} alt="" className="h-5 w-5 object-contain" />
                          ) : (
                            <span className="text-xs font-bold text-foreground">B</span>
                          )}
                        </div>
                        <div className="flex-1">
                          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Branding</p>
                          <div className="flex items-center gap-2 mt-1">
                            {state.branding.logoUrl && (
                              <span className="text-sm text-foreground">Custom logo</span>
                            )}
                            {state.branding.primaryColor !== '#FF6B35' && (
                              <span className="text-sm text-foreground">Custom color</span>
                            )}
                            {state.branding.subdomain && (
                              <span className="text-sm text-foreground">{state.branding.subdomain}.agencyplatform.com</span>
                            )}
                          </div>
                        </div>
                        {/* Preview */}
                        {(state.branding.logoUrl || state.branding.primaryColor !== '#FF6B35') && (
                          <div
                            className="w-24 h-12 rounded-md flex items-center justify-center text-xs font-medium text-center px-2"
                            style={{
                              backgroundColor: state.branding.primaryColor + '15',
                              color: state.branding.primaryColor,
                            }}
                          >
                            {state.branding.logoUrl ? (
                              <img src={state.branding.logoUrl} alt="" className="h-6 w-6 object-contain" />
                            ) : (
                              <span className="truncate">Preview</span>
                            )}
                          </div>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => setStep(3)}
                        className="text-xs font-semibold uppercase tracking-wide text-danger-ink hover:text-danger-ink"
                      >
                        Edit
                      </button>
                    </div>
                  )}
                </div>

                {/* Error Display */}
                {state.error && (
                  <m.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="p-3 bg-coral/10 border border-coral/30 rounded-lg flex items-start gap-2"
                  >
                    <AlertCircle className="h-5 w-5 text-danger-ink flex-shrink-0 mt-0.5" />
                    <p className="text-sm text-danger-ink">{state.error}</p>
                  </m.div>
                )}

                {/* Action Buttons */}
                <div className="flex justify-between items-center">
                  <button
                    type="button"
                    onClick={() => setStep(3)}
                    className="px-6 py-2.5 text-foreground hover:text-ink hover:bg-muted/30 rounded-lg transition-colors"
                    disabled={state.submitting}
                  >
                    Back
                  </button>

                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={() => setIsSaveTemplateModalOpen(true)}
                      className="px-4 py-2.5 text-danger-ink bg-coral/10 hover:bg-coral/20 rounded-lg transition-colors flex items-center gap-2"
                      disabled={state.submitting}
                    >
                      <Save className="h-4 w-4" />
                      Save as Template
                    </button>
                    <button
                      type="submit"
                      disabled={state.submitting}
                      className="px-6 py-2.5 bg-coral text-white rounded-lg hover:bg-coral/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-95 shadow-brutalist hover:shadow-none hover:translate-y-[2px] flex items-center gap-2"
                    >
                      {state.submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                      {state.submitting ? 'Creating Request...' : 'Create Access Request'}
                    </button>
                  </div>
                </div>

                {/* Save as Template Modal */}
                <SaveAsTemplateModal
                  agencyId={agencyId!}
                  createdBy={userId!}
                  isOpen={isSaveTemplateModalOpen}
                  onClose={() => setIsSaveTemplateModalOpen(false)}
                  onSave={() => {
                    setIsSaveTemplateModalOpen(false);
                    // Optionally show success message
                  }}
                />
              </m.div>
            )}
          </AnimatePresence>
        </form>
    </FlowShell>
  );
}

// ============================================================
// PAGE (Wrapper with Provider)
// ============================================================

export default function NewAccessRequestPage() {
  const clerkAuth = useAuth();
  const { userId, orgId } = useAuthOrBypass(clerkAuth);
  const queryClient = useQueryClient();

  if (!userId) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  // Use orgId if available (matches onboarding flow), otherwise fall back to userId
  const agencyId = orgId || userId;

  return (
    <AccessRequestProvider agencyId={agencyId} queryClient={queryClient} getToken={clerkAuth.getToken}>
      <AccessRequestWizardContent />
    </AccessRequestProvider>
  );
}
