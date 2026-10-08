import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useAuth, useUser } from '@clerk/nextjs';
import { MetaAssigneeSelector } from '../MetaAssigneeSelector';

vi.mock('@clerk/nextjs', () => ({ useAuth: vi.fn(), useUser: vi.fn() }));

describe('MetaAssigneeSelector', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useAuth).mockReturnValue({
      getToken: vi.fn().mockResolvedValue('token-1'),
      userId: 'user-1',
      orgId: 'org-1',
      isLoaded: true,
    } as any);
    vi.mocked(useUser).mockReturnValue({
      user: {
        primaryEmailAddress: { emailAddress: 'jon@example.com' },
      },
    } as any);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: [
          { type: 'human', id: 'person-1', name: 'Jon High', email: 'jon@example.com' },
          { type: 'system_user', id: 'system-1', name: 'Automation', role: 'ADMIN' },
        ],
      }),
    } as Response));
  });

  it('defaults to the agency owner human and supports keyboard task selection', async () => {
    const onChange = vi.fn();
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={queryClient}>
        <MetaAssigneeSelector
          agencyId="agency-1"
          products={['meta_ads']}
          value={{
            recipients: [],
            pageTasks: ['MANAGE', 'CREATE_CONTENT', 'MODERATE', 'ADVERTISE'],
            adAccountTasks: ['MANAGE', 'ADVERTISE', 'ANALYZE'],
          }}
          onChange={onChange}
        />
      </QueryClientProvider>
    );

    await waitFor(() => expect(onChange).toHaveBeenCalledWith(expect.objectContaining({
      recipients: [{ type: 'human', id: 'person-1', name: 'Jon High' }],
    })));
    expect(screen.getByRole('checkbox', { name: /Jon High/i })).toBeInTheDocument();
    const manageLeads = within(screen.getByRole('group', { name: 'Page tasks' })).getByLabelText('Manage Leads Access');
    expect(manageLeads).not.toBeChecked();
    manageLeads.focus();
    await userEvent.keyboard(' ');
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({
      pageTasks: ['MANAGE', 'CREATE_CONTENT', 'MODERATE', 'ADVERTISE', 'MANAGE_LEADS'],
    }));

    const advertise = within(screen.getByRole('group', { name: 'Page tasks' })).getByLabelText('Advertise');
    advertise.focus();
    await userEvent.keyboard(' ');
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({
      pageTasks: ['MANAGE', 'CREATE_CONTENT', 'MODERATE'],
    }));
  });

  it('derives least-privilege tasks and requires an explicit Full control choice', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={queryClient}>
        <MetaAssigneeSelector
          agencyId="agency-1"
          products={['meta_ads']}
          value={{ recipients: [], pageTasks: [], adAccountTasks: [], catalogTasks: ['MANAGE'] }}
          onChange={onChange}
        />
      </QueryClientProvider>
    );

    await waitFor(() => expect(onChange).toHaveBeenCalledWith(expect.objectContaining({
      pageTasks: ['ADVERTISE', 'ANALYZE'],
      adAccountTasks: ['ADVERTISE', 'ANALYZE'],
      datasetTasks: ['ADVERTISE', 'ANALYZE'],
    })));
    await screen.findByRole('checkbox', { name: /Jon High/i });
    await user.click(screen.getByRole('checkbox', { name: /Full control for selected Meta assets/i }));
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({
      pageTasks: ['MANAGE', 'CREATE_CONTENT', 'MODERATE', 'ADVERTISE', 'ANALYZE', 'MANAGE_LEADS'],
      adAccountTasks: ['MANAGE', 'ADVERTISE', 'ANALYZE'],
      datasetTasks: ['AA_ANALYZE', 'ADVERTISE', 'ANALYZE', 'EDIT', 'UPLOAD'],
    }));
  });

  it('shows a retry state when Clerk token acquisition hangs', async () => {
    const getToken = vi.fn(() => new Promise<string | null>(() => {}));
    vi.mocked(useAuth).mockReturnValue({ getToken } as any);
    vi.useFakeTimers();
    let rendered: ReturnType<typeof render> | undefined;

    try {
      rendered = render(
        <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
          <MetaAssigneeSelector
            agencyId="agency-1"
            products={['meta_ads']}
            value={{ recipients: [], pageTasks: [], adAccountTasks: [] }}
            onChange={vi.fn()}
          />
        </QueryClientProvider>
      );
      await act(async () => {
        await vi.advanceTimersByTimeAsync(15_250);
      });

      expect(screen.getByText('Request timed out. Please try again.')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
      expect(screen.queryByText('Loading Meta people and system users…')).not.toBeInTheDocument();

      getToken.mockResolvedValue('token-1');
      vi.useRealTimers();
      fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
      expect(await screen.findByText('Jon High')).toBeInTheDocument();
    } finally {
      rendered?.unmount();
      vi.useRealTimers();
    }
  });
});
