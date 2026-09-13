import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { useEffect } from 'react';
import UnifiedOnboardingPage from '../page';

const mockPush = vi.fn();
const mockNextStep = vi.fn();
const mockCreateAgencyAndAccessRequest = vi.fn();
const mockLoadExistingClients = vi.fn();
const mockDeferUntilClientReady = vi.fn();
let mockCurrentStep = 3;
let mockCanSkip = false;
let shouldThrowPlatformScreen = false;

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
  }),
}));

vi.mock('@clerk/nextjs', () => ({
  useAuth: () => ({
    isLoaded: true,
    userId: 'user_123',
  }),
}));

vi.mock('@/contexts/unified-onboarding-context', () => ({
  UnifiedOnboardingProvider: ({ children }: any) => children,
  useUnifiedOnboarding: () => ({
    state: {
      currentStep: mockCurrentStep,
      selectedPlatforms: { google: ['google_ads'] },
      loading: false,
      teamInvites: [],
      existingClients: [],
      agencyName: 'Acme',
      agencySettings: { timezone: 'America/New_York', industry: 'digital_marketing' },
      completedSteps: new Set<number>(),
      startedAt: Date.now(),
      stepDurations: {},
      error: null,
    },
    nextStep: mockNextStep,
    prevStep: vi.fn(),
    canGoNext: () => true,
    canGoBack: () => true,
    canSkip: () => mockCanSkip,
    updateAgency: vi.fn(),
    updateClient: vi.fn(),
    updatePlatforms: vi.fn(),
    loadExistingClients: mockLoadExistingClients,
    createAgencyAndAccessRequest: mockCreateAgencyAndAccessRequest,
    addTeamInvite: vi.fn(),
    removeTeamInvite: vi.fn(),
    updateTeamInviteRole: vi.fn(),
    sendTeamInvites: vi.fn(),
    completeOnboarding: vi.fn(),
    deferUntilClientReady: mockDeferUntilClientReady,
    setError: vi.fn(),
  }),
}));

vi.mock('@/components/onboarding/unified-wizard', () => ({
  UnifiedWizard: ({ onNext, onSkip, canSkip, children }: any) => {
    return (
      <div>
        {children}
        <button onClick={() => onNext()}>Run Next</button>
        {canSkip && <button onClick={() => onSkip()}>Run Skip</button>}
      </div>
    );
  },
}));

vi.mock('@/components/onboarding/screens/welcome-screen', () => ({
  WelcomeScreen: () => <div>Welcome screen</div>,
}));
vi.mock('@/components/onboarding/screens/agency-profile-screen', () => ({
  AgencyProfileScreen: () => <div>Agency profile screen</div>,
}));
vi.mock('@/components/onboarding/screens/client-selection-screen', () => ({
  ClientSelectionScreen: ({ onDefer, onLoadClients }: any) => {
    useEffect(() => {
      void onLoadClients?.();
    }, [onLoadClients]);

    return (
      <div>
        <p>Client selection screen</p>
        <button onClick={onDefer}>No client yet</button>
      </div>
    );
  },
}));
vi.mock('@/components/onboarding/screens/platform-selection-screen', () => ({
  PlatformSelectionScreen: () => {
    if (shouldThrowPlatformScreen) {
      throw new Error('platform step exploded');
    }
    return <div>Platform selection screen</div>;
  },
}));
vi.mock('@/components/onboarding/screens/success-link-screen', () => ({
  SuccessLinkScreen: () => <div>Success link screen</div>,
}));
vi.mock('@/components/onboarding/screens/team-invite-screen', () => ({
  TeamInviteScreen: () => <div>Team invite screen</div>,
}));
vi.mock('@/components/onboarding/screens/final-success-screen', () => ({
  FinalSuccessScreen: () => <div>Final success screen</div>,
}));

describe('UnifiedOnboardingPage step progression', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCurrentStep = 3;
    mockCanSkip = false;
    shouldThrowPlatformScreen = false;
  });

  it('does not advance when access-request creation fails', async () => {
    mockCreateAgencyAndAccessRequest.mockResolvedValue({ ok: false, error: 'failed' });

    render(<UnifiedOnboardingPage />);

    fireEvent.click(screen.getByRole('button', { name: 'Run Next' }));

    await waitFor(() => {
      expect(mockCreateAgencyAndAccessRequest).toHaveBeenCalled();
    });

    expect(mockNextStep).not.toHaveBeenCalled();
  });

  it('advances immediately when access-request creation succeeds', async () => {
    mockCreateAgencyAndAccessRequest.mockResolvedValue({ ok: true, accessRequestId: 'req-1' });

    render(<UnifiedOnboardingPage />);

    fireEvent.click(screen.getByRole('button', { name: 'Run Next' }));

    await waitFor(() => {
      expect(mockCreateAgencyAndAccessRequest).toHaveBeenCalled();
      expect(mockNextStep).toHaveBeenCalledTimes(1);
    });
  });

  it('renders an in-flow fallback instead of crashing the page when step rendering throws', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    shouldThrowPlatformScreen = true;

    render(<UnifiedOnboardingPage />);

    expect(await screen.findByText(/something went wrong in onboarding/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /go to dashboard/i }));
    expect(mockPush).toHaveBeenCalledWith('/dashboard?onboardingRecovery=1');

    consoleErrorSpy.mockRestore();
  });

  it.each([
    [0, 'Welcome screen'],
    [1, 'Agency profile screen'],
    [2, 'Client selection screen'],
    [3, 'Platform selection screen'],
    [4, 'Success link screen'],
    [5, 'Team invite screen'],
    [6, 'Final success screen'],
  ] as const)('loads onboarding screen for step %s', async (step, label) => {
    mockCurrentStep = step;

    render(<UnifiedOnboardingPage />);

    expect(await screen.findByText(label)).toBeInTheDocument();
  });

  it('loads existing clients when the client step is shown', async () => {
    mockCurrentStep = 2;

    render(<UnifiedOnboardingPage />);

    await waitFor(() => {
      expect(mockLoadExistingClients).toHaveBeenCalledTimes(1);
    });
  });

  it('supports the deferred client exit from the client step', async () => {
    mockCurrentStep = 2;

    render(<UnifiedOnboardingPage />);

    fireEvent.click(screen.getByRole('button', { name: /no client yet/i }));

    await waitFor(() => {
      expect(mockDeferUntilClientReady).toHaveBeenCalledTimes(1);
    });
  });

  it('only exposes skip controls on optional post-activation steps', () => {
    mockCurrentStep = 5;
    mockCanSkip = true;

    render(<UnifiedOnboardingPage />);

    expect(screen.getByRole('button', { name: 'Run Skip' })).toBeInTheDocument();
  });
});
