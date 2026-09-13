import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AgentsSettingsTab } from '../agents-settings-tab';
import { isBrutalistButton } from '@/test/utils/design-system';

const mockAuthorizedApiFetch = vi.fn();
const mockListGrants = vi.fn();
const mockRevoke = vi.fn();
const mockUpdate = vi.fn();
const mockCreate = vi.fn();
const mockGetToken = vi.fn().mockResolvedValue('token');
const { navigation } = vi.hoisted(() => ({
  navigation: { searchParams: new URLSearchParams(), replace: vi.fn() },
}));

vi.mock('@clerk/nextjs', () => ({ useAuth: () => ({ userId: 'user-1', orgId: null, getToken: mockGetToken }) }));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: navigation.replace }),
  useSearchParams: () => navigation.searchParams,
}));
vi.mock('@/lib/api/authorized-api-fetch', () => ({ authorizedApiFetch: (...args: any[]) => mockAuthorizedApiFetch(...args) }));
vi.mock('@/lib/api/api-env', () => ({ getApiBaseUrl: () => 'https://api.example.com' }));
vi.mock('@/lib/api/agents', () => ({
  createAgentGrant: (...args: any[]) => mockCreate(...args),
  listAgentGrants: (...args: any[]) => mockListGrants(...args),
  revokeAgentGrant: (...args: any[]) => mockRevoke(...args),
  updateAgentGrant: (...args: any[]) => mockUpdate(...args),
}));

function brutalistButtons(container: HTMLElement) {
  return Array.from(container.querySelectorAll('button, a')).filter(isBrutalistButton);
}

function renderTab() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  queryClient.setQueryData(['user-agency', 'user-1'], { id: 'agency-1', name: 'Agency' });
  const utils = render(<QueryClientProvider client={queryClient}><AgentsSettingsTab /></QueryClientProvider>);
  return { ...utils, queryClient };
}

describe('AgentsSettingsTab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    navigation.searchParams = new URLSearchParams();
    navigation.replace.mockImplementation((href: string) => {
      navigation.searchParams = new URLSearchParams(href.replace(/^\?/, ''));
    });
    mockCreate.mockResolvedValue({ id: 'grant-2', state: 'active' });
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

  it('renders one ink-panel with "Copy endpoint" as a button inside it and no brutalist button', async () => {
    const { container } = renderTab();
    await screen.findByText('Chief of Staff');
    const panels = container.querySelectorAll('.ink-panel');
    expect(panels).toHaveLength(1);
    const copyLink = screen.getByRole('button', { name: 'Copy endpoint' });
    expect(panels[0].contains(copyLink)).toBe(true);
    expect(panels[0].querySelector('button[class*="bg-coral"]')).toBeNull();
    expect(brutalistButtons(container)).toHaveLength(0);
  });

  it('copies the MCP endpoint to the clipboard from the panel link', async () => {
    // userEvent.setup() installs its own clipboard stub; spy on that instance.
    const user = userEvent.setup();
    const writeText = vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue(undefined);
    renderTab();
    await screen.findByText('Chief of Staff');
    await user.click(screen.getByRole('button', { name: 'Copy endpoint' }));
    expect(writeText).toHaveBeenCalledWith('https://api.example.com/mcp');
    expect(await screen.findByRole('button', { name: 'Copied' })).toBeInTheDocument();
  });

  it('with connect=abc renders the approval group first with the only brutalist button "Approve agent"', async () => {
    navigation.searchParams = new URLSearchParams('tab=agents&connect=abc');
    const { container } = renderTab();
    const approveHeading = await screen.findByRole('heading', { name: 'Approve this personal agent?' });
    const buttons = brutalistButtons(container);
    expect(buttons).toHaveLength(1);
    expect(buttons[0].textContent).toMatch(/approve agent/i);
    expect(container.querySelector('.ink-panel')?.contains(buttons[0])).toBe(false);
    const grantsHeading = screen.getByRole('heading', { name: 'Connected agents' });
    expect(approveHeading.compareDocumentPosition(grantsHeading) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('after approval succeeds it strips connect from the URL and no brutalist button remains', async () => {
    const user = userEvent.setup();
    navigation.searchParams = new URLSearchParams('tab=agents&connect=abc');
    const { container, rerender, queryClient } = renderTab();
    await user.click(await screen.findByRole('button', { name: 'Approve agent' }));
    await waitFor(() => expect(navigation.replace).toHaveBeenCalledWith('?tab=agents', { scroll: false }));
    expect(mockCreate).toHaveBeenCalledWith('agency-1', expect.objectContaining({ oauthClientId: 'abc' }), mockGetToken);
    rerender(<QueryClientProvider client={queryClient}><AgentsSettingsTab /></QueryClientProvider>);
    expect(brutalistButtons(container)).toHaveLength(0);
    expect(screen.queryByRole('heading', { name: 'Approve this personal agent?' })).not.toBeInTheDocument();
  });

  it('renders a three-beat empty state without a dashed box when no grants exist', async () => {
    mockListGrants.mockResolvedValue([]);
    const { container } = renderTab();
    expect(await screen.findByText('No agents connected')).toBeInTheDocument();
    expect(screen.getByText(/no agent can/i)).toBeInTheDocument();
    const docsLink = screen.getByRole('link', { name: 'How to connect an agent' });
    expect(docsLink).toHaveAttribute('href', expect.stringMatching(/\/agentic-workflows\/connect-an-agent$/));
    expect(screen.getAllByText(/copy endpoint/i)).toHaveLength(1);
    expect(container.querySelector('[class*="border-dashed"]')).toBeNull();
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
