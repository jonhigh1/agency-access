import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AgentsSettingsTab } from '../agents-settings-tab';

const mockAuthorizedApiFetch = vi.fn();
const mockListGrants = vi.fn();
const mockRevoke = vi.fn();
const mockUpdate = vi.fn();
const mockGetToken = vi.fn().mockResolvedValue('token');

vi.mock('@clerk/nextjs', () => ({ useAuth: () => ({ userId: 'user-1', orgId: null, getToken: mockGetToken }) }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ replace: vi.fn() }), useSearchParams: () => new URLSearchParams() }));
vi.mock('@/lib/api/authorized-api-fetch', () => ({ authorizedApiFetch: (...args: any[]) => mockAuthorizedApiFetch(...args) }));
vi.mock('@/lib/api/api-env', () => ({ getApiBaseUrl: () => 'https://api.example.com' }));
vi.mock('@/lib/api/agents', () => ({
  createAgentGrant: vi.fn(),
  listAgentGrants: (...args: any[]) => mockListGrants(...args),
  revokeAgentGrant: (...args: any[]) => mockRevoke(...args),
  updateAgentGrant: (...args: any[]) => mockUpdate(...args),
}));

function renderTab(queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })) {
  queryClient.setQueryData(['user-agency', 'user-1'], { id: 'agency-1', name: 'Agency' });
  return render(<QueryClientProvider client={queryClient}><AgentsSettingsTab /></QueryClientProvider>);
}

describe('AgentsSettingsTab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthorizedApiFetch.mockResolvedValue({ data: [{ id: 'agency-1', name: 'Agency' }] });
    mockListGrants.mockResolvedValue([{ id: 'grant-1', agencyId: 'agency-1', displayName: 'Chief of Staff', oauthClientId: 'oauth-1', permissions: ['workspace:read'], state: 'active', lastUsedAt: '2026-07-16T12:00:00.000Z', createdAt: '2026-07-15T12:00:00.000Z', updatedAt: '2026-07-15T12:00:00.000Z' }]);
    mockRevoke.mockResolvedValue({ id: 'grant-1', state: 'revoked' });
    mockUpdate.mockResolvedValue({ id: 'grant-1', state: 'active' });
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: vi.fn().mockResolvedValue(undefined) },
    });
  });

  it('shows the MCP endpoint, grant permissions, activity, and explicit revoke confirmation', async () => {
    const user = userEvent.setup();
    renderTab();
    expect(await screen.findByText('Chief of Staff')).toBeInTheDocument();
    expect(screen.getByText('workspace:read')).toBeInTheDocument();
    expect(screen.getByText('https://api.example.com/mcp')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Revoke access' }));
    expect(screen.getByText('Revoke this agent immediately?')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Confirm revoke' }));
    expect(mockRevoke).toHaveBeenCalledWith('agency-1', 'grant-1', mockGetToken);
  });

  it('lets the owner name and constrain the agent capability set', async () => {
    const user = userEvent.setup();
    renderTab();
    await user.click(await screen.findByRole('button', { name: 'Manage access' }));
    await user.clear(screen.getByLabelText('Agent name'));
    await user.type(screen.getByLabelText('Agent name'), 'Onboarding operator');
    await user.click(screen.getByRole('checkbox', { name: /Create and update clients/ }));
    await user.click(screen.getByRole('button', { name: 'Save access' }));

    expect(mockUpdate).toHaveBeenCalledWith('agency-1', 'grant-1', expect.objectContaining({
      displayName: 'Onboarding operator',
      permissions: expect.arrayContaining(['workspace:read', 'clients:write']),
    }), mockGetToken);
  });

  it('reuses the shared user-agency cache instead of fetching agencies again', async () => {
    const fetchSpy = vi.fn();
    global.fetch = fetchSpy;
    renderTab();
    expect(await screen.findByText('Chief of Staff')).toBeInTheDocument();
    expect(mockAuthorizedApiFetch).not.toHaveBeenCalled();
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
