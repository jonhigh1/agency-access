/**
 * Provider-boundary smoke for /invite (plan:
 * docs/plans/2026-10-09-fix-queryclient-provider-boundary-gates-plan.md U1).
 *
 * Does NOT mock useUserAgency — that mock is what let #155 ship without
 * AppProviders. Mock auth + network one layer down instead.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { AppProviders } from '@/app/app-providers';
import InvitePage from '../client-invite-page';

vi.mock('next/navigation', () => ({
  useParams: vi.fn(() => ({ token: 'token-boundary' })),
  useSearchParams: vi.fn(() => ({
    get: () => null,
    toString: () => '',
  })),
  useRouter: vi.fn(() => ({ replace: vi.fn(), push: vi.fn(), prefetch: vi.fn() })),
  usePathname: vi.fn(() => '/invite/token-boundary'),
}));

vi.mock('@clerk/nextjs', () => ({
  useAuth: vi.fn(() => ({
    isLoaded: true,
    userId: null,
    orgId: null,
    getToken: async () => null,
  })),
}));

vi.mock('@/lib/analytics/capture-posthog', () => ({
  capturePosthogEvent: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/lib/analytics/invite-events', () => ({
  trackInviteOpenedOncePerSession: vi.fn(),
  trackInviteProgressCheckRequested: vi.fn(),
  trackClientChecklistResumed: vi.fn(),
}));

vi.mock('@/components/client-auth/PlatformAuthWizard', () => ({
  PlatformAuthWizard: () => <div data-testid="wizard-stub" />,
}));

vi.mock('@/components/theme-provider', () => ({
  ThemeProvider: ({ children }: { children: React.ReactNode }) => children,
}));

describe('invite QueryClient provider boundary', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: false,
        status: 404,
        json: async () => ({ error: { message: 'Access request not found', code: 'NOT_FOUND' } }),
        text: async () =>
          JSON.stringify({ error: { message: 'Access request not found', code: 'NOT_FOUND' } }),
      }))
    );
  });

  it('throws without a QueryClient provider (the #155 failure mode)', () => {
    // React 19 / Testing Library may report the error via console; assert throw.
    expect(() => render(<InvitePage />)).toThrow(/No QueryClient set/i);
  });

  it('renders under AppProviders without throwing', async () => {
    expect(() =>
      render(
        <AppProviders>
          <InvitePage />
        </AppProviders>
      )
    ).not.toThrow();

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /this link is not working/i })).toBeTruthy();
    });
  });

  it('keeps AppProviders on the invite layout (layout pin)', () => {
    const layoutPath = join(__dirname, '..', '..', 'layout.tsx');
    const source = readFileSync(layoutPath, 'utf8');
    expect(source).toMatch(/AppProviders/);
    expect(source).toMatch(/from ['"]\.\.\/app-providers['"]/);
  });
});
