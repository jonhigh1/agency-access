/**
 * Unified Onboarding Page
 *
 * Main entry point for the PLG onboarding flow.
 * Implements the "Zero-to-One" flow that gets founders to their first real client access link quickly.
 *
 * Flow:
 * Screen 0: Welcome & Value Hook
 * Screen 1: Quick Agency Profile
 * Screen 2: Client Selection + Platform Selection
 * Screen 3: Success Link Display (The "Aha! Moment")
 * Screen 4: Optional Team Invite
 * Screen 5: Final Success & Dashboard Tease
 *
 * Design Principles:
 * - Opinionated: Smart defaults, guide users down best path
 * - Interruptive: Full-screen experiences for key moments
 * - Interactive: Users CREATE value immediately
 */

'use client';

import { Component, type ErrorInfo, type ReactNode, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@clerk/nextjs';
import { AlertCircle } from 'lucide-react';
import { UnifiedWizard } from '@/components/onboarding/unified-wizard';
import { UnifiedOnboardingProvider, useUnifiedOnboarding } from '@/contexts/unified-onboarding-context';
import { WelcomeScreen } from '@/components/onboarding/screens/welcome-screen';
import { AgencyProfileScreen } from '@/components/onboarding/screens/agency-profile-screen';
import { ClientSelectionScreen } from '@/components/onboarding/screens/client-selection-screen';
import { PlatformSelectionScreen } from '@/components/onboarding/screens/platform-selection-screen';
import { SuccessLinkScreen } from '@/components/onboarding/screens/success-link-screen';
import { TeamInviteScreen } from '@/components/onboarding/screens/team-invite-screen';
import { FinalSuccessScreen } from '@/components/onboarding/screens/final-success-screen';
import { ONBOARDING_TOTAL_STEPS } from '@/lib/onboarding-steps';

const DASHBOARD_ONBOARDING_RECOVERY_URL = '/dashboard?onboardingRecovery=1';

// ============================================================
// ONBOARDING FLOW COMPONENT
// ============================================================

interface OnboardingStepErrorBoundaryProps {
  children: ReactNode;
  onExit: () => void;
}

interface OnboardingStepErrorBoundaryState {
  hasError: boolean;
}

class OnboardingStepErrorBoundary extends Component<
  OnboardingStepErrorBoundaryProps,
  OnboardingStepErrorBoundaryState
> {
  state: OnboardingStepErrorBoundaryState = {
    hasError: false,
  };

  static getDerivedStateFromError(): OnboardingStepErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Unified onboarding step render failed', {
      message: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
    });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="mx-8 my-10 rounded-xl border border-red-300 bg-red-50 p-6 text-red-900">
          <h2 className="text-xl font-semibold">Something went wrong in onboarding</h2>
          <p className="mt-2 text-sm">
            We hit an unexpected issue while loading this step. Please return to your dashboard and try onboarding again.
          </p>
          <button
            type="button"
            onClick={this.props.onExit}
            className="mt-4 rounded-lg bg-red-700 px-4 py-2 text-sm font-semibold text-white hover:bg-red-800"
          >
            Go to dashboard
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

function OnboardingFlow() {
  const { state, nextStep, prevStep, canGoNext, canGoBack, canSkip, updateAgency, updateClient, updatePlatforms, loadExistingClients, createAgencyAndAccessRequest, deferUntilClientReady, addTeamInvite, removeTeamInvite, updateTeamInviteRole, sendTeamInvites, completeOnboarding, setError } = useUnifiedOnboarding();
  const router = useRouter();

  const handleNext = async () => {
    try {
      if (state.currentStep === 3) {
        const createResult = await createAgencyAndAccessRequest();
        if (createResult.ok) {
          nextStep();
        }
        return;
      }

      if (state.currentStep === 5 && state.teamInvites.length > 0) {
        const invitesSent = await sendTeamInvites();
        if (invitesSent) {
          nextStep();
        }
        return;
      }

      if (canGoNext()) {
        nextStep();
      }
    } catch (error) {
      const message = error instanceof Error
        ? error.message
        : 'Unexpected onboarding error. Please try again.';
      setError(message);
    }
  };

  // Handle skip (team invite screen)
  const handleSkip = () => {
    nextStep(); // Skip to final screen
  };

  // Render current screen
  const renderScreen = () => {
    switch (state.currentStep) {
      case 0:
        return <WelcomeScreen onNext={nextStep} agencyName={state.agencyName} />;

      case 1:
        return (
          <AgencyProfileScreen
            agencyName={state.agencyName}
            timezone={state.agencySettings.timezone}
            industry={state.agencySettings.industry}
            onUpdate={(data) => updateAgency({ name: data.name, settings: { timezone: data.timezone, industry: data.industry } })}
          />
        );

      case 2:
        return (
          <ClientSelectionScreen
            clientName={state.clientName || ''}
            clientEmail={state.clientEmail || ''}
            websiteUrl={state.agencySettings.website || ''}
            existingClients={state.existingClients}
            loading={state.loading}
            onUpdate={(data) => updateClient(data)}
            onWebsiteUrlChange={(website) => updateAgency({ name: state.agencyName, settings: { website } })}
            onLoadClients={loadExistingClients}
            onDefer={deferUntilClientReady}
          />
        );

      case 3:
        return (
          <PlatformSelectionScreen
            selectedPlatforms={state.selectedPlatforms}
            onUpdate={updatePlatforms}
            onGenerate={handleNext}
            loading={state.loading}
          />
        );

      case 4:
        return (
          <SuccessLinkScreen
            accessLink={state.accessLink || ''}
            clientName={state.clientName || ''}
            clientEmail={state.clientEmail}
            accessRequestId={state.accessRequestId}
            selectedPlatforms={Object.values(state.selectedPlatforms).flat() as any}
          />
        );

      case 5:
        return (
          <TeamInviteScreen
            teamInvites={state.teamInvites}
            onAddInvite={addTeamInvite}
            onRemoveInvite={removeTeamInvite}
            onUpdateInviteRole={updateTeamInviteRole}
            canSendInvites={state.teamInvites.length > 0}
          />
        );

      case 6:
        return (
          <FinalSuccessScreen
            agencyName={state.agencyName}
            clientName={state.clientName || 'your client'}
            accessRequestId={state.accessRequestId || ''}
            teamInvitesSent={state.teamInvites.length}
            onComplete={completeOnboarding}
          />
        );

      default:
        return null;
    }
  };

  return (
    <UnifiedWizard
      currentStep={state.currentStep}
      totalSteps={ONBOARDING_TOTAL_STEPS}
      onNext={handleNext}
      onBack={prevStep}
      canGoNext={canGoNext()}
      canGoBack={canGoBack()}
      canSkip={canSkip()}
      onSkip={handleSkip}
      loading={state.loading}
      showClose={state.currentStep >= 4} // Can close after value is delivered
      onClose={() => router.push('/dashboard')}
    >
      <OnboardingStepErrorBoundary onExit={() => router.push(DASHBOARD_ONBOARDING_RECOVERY_URL)}>
        {state.error && (
          <div className="mx-8 mt-8 mb-0 rounded-lg border border-red-300 bg-red-50 p-4 text-sm text-red-900">
            <div className="flex items-start gap-2">
              <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
              <span>{state.error}</span>
            </div>
          </div>
        )}
        {renderScreen()}
      </OnboardingStepErrorBoundary>
    </UnifiedWizard>
  );
}

// ============================================================
// PAGE COMPONENT (WITH PROVIDER)
// ============================================================

export default function UnifiedOnboardingPage() {
  const { isLoaded, userId } = useAuth();
  const router = useRouter();

  // Redirect if not authenticated
  useEffect(() => {
    if (isLoaded && !userId) {
      router.push('/sign-in' as any);
    }
  }, [isLoaded, userId, router]);

  if (!isLoaded || !userId) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <UnifiedOnboardingProvider
      onComplete={() => {
        // Navigate to dashboard after completion
        router.push('/dashboard');
      }}
    >
      <OnboardingFlow />
    </UnifiedOnboardingProvider>
  );
}

// ============================================================
// LAYOUT CONFIGURATION
// ============================================================

// Hide navbar/footer during onboarding for full-screen experience
export const dynamic = 'force-dynamic';
