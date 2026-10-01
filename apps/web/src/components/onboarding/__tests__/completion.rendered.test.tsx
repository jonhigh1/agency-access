import { useState } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { UnifiedOnboardingProvider, useUnifiedOnboarding } from '@/contexts/unified-onboarding-context';
import { FinalSuccessScreen } from '../screens/final-success-screen';

const pushMock = vi.fn();
const fetchMock = vi.fn();

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: pushMock }) }));
vi.mock('@clerk/nextjs', () => ({
  useAuth: () => ({ userId: 'user_1', orgId: null, getToken: async () => 'token' }),
  useUser: () => ({ user: { primaryEmailAddress: { emailAddress: 'owner@example.com' } } }),
}));

function response(data: unknown, status = 200) {
  return { ok: true, status, json: async () => ({ data, error: null }) };
}

function RenderedCompletion() {
  const onboarding = useUnifiedOnboarding();
  const [configured, setConfigured] = useState(false);

  return (
    <>
      {!configured ? (
        <button
          type="button"
          onClick={() => {
            onboarding.updateAgency({ name: 'Acme Agency' });
            onboarding.updateClient({ name: 'Acme Client', email: 'client@example.com' });
            setConfigured(true);
          }}
        >
          Enter setup details
        </button>
      ) : !onboarding.state.accessRequestId ? (
        <button type="button" onClick={() => void onboarding.createAgencyAndAccessRequest()}>
          Create access link
        </button>
      ) : (
        <>
          {onboarding.state.error && <p role="alert">{onboarding.state.error}</p>}
          <FinalSuccessScreen
            agencyName={onboarding.state.agencyName}
            clientName={onboarding.state.clientName || ''}
            accessRequestId={onboarding.state.accessRequestId}
            teamInvitesSent={onboarding.state.teamInvitesSent}
            platforms={['meta']}
            loading={onboarding.state.loading}
            onComplete={() => void onboarding.completeOnboarding()}
          />
        </>
      )}
    </>
  );
}

function renderFlow() {
  return render(
    <UnifiedOnboardingProvider enableProgressHydration={false}>
      <RenderedCompletion />
    </UnifiedOnboardingProvider>
  );
}

describe('onboarding completion behavior', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = fetchMock;
    process.env.NEXT_PUBLIC_API_URL = 'https://api.example.com';
    process.env.NEXT_PUBLIC_APP_URL = 'https://authhub.co';
    fetchMock
      .mockResolvedValueOnce(response([]))
      .mockResolvedValueOnce(response({ id: 'agency-1' }, 201))
      .mockResolvedValueOnce(response({ id: 'client-1' }, 201))
      .mockResolvedValueOnce(response({ id: 'request-1', uniqueToken: 'token-1' }, 201))
      .mockResolvedValueOnce(response({ agencyId: 'agency-1' }));
  });

  it('finishes from saved IDs once and does not mutate the agency again', async () => {
    fetchMock.mockResolvedValueOnce(response({ agencyId: 'agency-1' }));
    renderFlow();
    fireEvent.click(screen.getByRole('button', { name: 'Enter setup details' }));
    fireEvent.click(screen.getByRole('button', { name: 'Create access link' }));

    const finalAction = await screen.findByRole('button', { name: 'Go to Dashboard' });
    fireEvent.click(finalAction);
    fireEvent.click(finalAction);

    await waitFor(() => {
      expect(pushMock).toHaveBeenCalledWith('/dashboard');
      expect(fetchMock.mock.calls.filter(([url, init]) =>
        String(url).endsWith('/api/agencies') && init?.method === 'POST'
      )).toHaveLength(1);
      expect(fetchMock.mock.calls.filter(([url, init]) =>
        String(url).endsWith('/api/agencies/agency-1') && init?.method === 'PATCH'
      )).toHaveLength(0);
    });
  });

  it('keeps setup pending and shows an error when completion persistence fails', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 503,
      json: async () => ({ error: { code: 'SERVICE_UNAVAILABLE', message: 'Setup could not be saved.' } }),
    });
    renderFlow();
    fireEvent.click(screen.getByRole('button', { name: 'Enter setup details' }));
    fireEvent.click(screen.getByRole('button', { name: 'Create access link' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Go to Dashboard' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Setup could not be saved.');
    expect(pushMock).not.toHaveBeenCalledWith('/dashboard');
    expect(screen.getByRole('button', { name: 'Go to Dashboard' })).toBeEnabled();
  });
});
