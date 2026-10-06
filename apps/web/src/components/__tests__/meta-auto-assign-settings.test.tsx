import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MetaAutoAssignSettings } from '../meta-auto-assign-settings';

vi.mock('@clerk/nextjs', () => ({
  useAuth: () => ({ getToken: vi.fn(async () => 'token') }),
}));

vi.mock('@/lib/dev-auth', () => ({
  useAuthOrBypass: () => ({ isDevelopmentBypass: false, isLoaded: true }),
  DEV_BYPASS_TOKEN: 'dev',
}));

function renderWithClient(ui: React.ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

describe('MetaAutoAssignSettings', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    global.fetch = vi.fn(async (input, init) => {
      const url = String(input);
      if (url.includes('auto-assign-preferences') && (!init?.method || init.method === 'GET')) {
        return new Response(JSON.stringify({ data: { enabled: false, recipients: [] } }), { status: 200 });
      }
      if (url.includes('assignees')) {
        return new Response(
          JSON.stringify({
            data: [
              { type: 'human', id: '42', name: 'Alex' },
              { type: 'system_user', id: '99', name: 'Automation' },
            ],
          }),
          { status: 200 },
        );
      }
      if (url.includes('auto-assign-preferences') && init?.method === 'PATCH') {
        return new Response(JSON.stringify({ data: JSON.parse(String(init.body)).preferences }), { status: 200 });
      }
      return new Response('{}', { status: 404 });
    }) as typeof fetch;
  });

  it('loads assignee picker and saves enabled preference', async () => {
    const user = userEvent.setup();
    renderWithClient(<MetaAutoAssignSettings agencyId="agency-1" />);

    await waitFor(() => {
      expect(screen.getByText(/Auto-Assign team access/i)).toBeInTheDocument();
    });

    await user.click(screen.getByRole('checkbox', { name: /Run Auto-Assign after Partner success/i }));

    await waitFor(() => {
      expect(screen.getByText('Auto-Assign targets')).toBeInTheDocument();
      expect(screen.getByText('Alex')).toBeInTheDocument();
    });
  });
});
