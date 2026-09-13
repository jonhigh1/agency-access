import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import SettingsPage from '../page';

const searchParamsState = vi.hoisted(() => ({
  tab: null as string | null,
}));

vi.mock('next/dynamic', async () => {
  const React = await vi.importActual<typeof import('react')>('react');

  return {
    default: (
      loader: () => Promise<{ default: React.ComponentType }>,
      options?: { loading?: React.ComponentType }
    ) => {
      const LazyComponent = React.lazy(loader);
      return function DynamicComponent(props: Record<string, unknown>) {
        return React.createElement(
          React.Suspense,
          { fallback: options?.loading ? React.createElement(options.loading) : null },
          React.createElement(LazyComponent, props)
        );
      };
    },
  };
});

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    replace: vi.fn(),
    push: vi.fn(),
  }),
  useSearchParams: () => ({
    get: (key: string) => (key === 'tab' ? searchParamsState.tab : null),
    toString: () => (searchParamsState.tab ? `tab=${searchParamsState.tab}` : ''),
  }),
}));

vi.mock('@/lib/query/billing', () => ({
  usePrefetchBillingData: () => vi.fn(),
}));

vi.mock('@/components/marketing/reveal', () => ({
  Reveal: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('@/components/settings/usage-overview-card', () => ({
  UsageOverviewCard: () => <div>Usage overview</div>,
}));

vi.mock('@/components/settings/general', () => ({
  AgencyProfileCard: () => <div>Agency profile</div>,
  TeamMembersCard: () => <div>Team members</div>,
  NotificationsCard: () => <div>Notifications</div>,
}));

vi.mock('@/components/settings/billing/billing-tab', () => ({
  BillingTab: () => <div>Billing settings panel</div>,
}));

vi.mock('@/components/settings/webhooks/webhook-settings-tab', () => ({
  WebhookSettingsTab: () => <div>Webhook settings panel</div>,
}));

vi.mock('@/components/settings/agents/agents-settings-tab', () => ({
  AgentsSettingsTab: () => <div>Agents settings panel</div>,
}));

describe('SettingsPage gated tabs', () => {
  beforeEach(() => {
    searchParamsState.tab = null;
  });

  it('loads general settings and keeps other tabs unmounted', async () => {
    render(<SettingsPage />);

    expect(await screen.findByText('Agency profile')).toBeInTheDocument();
    expect(screen.getByText('Team members')).toBeInTheDocument();
    expect(screen.queryByText('Billing settings panel')).not.toBeInTheDocument();
    expect(screen.queryByText('Webhook settings panel')).not.toBeInTheDocument();
    expect(screen.queryByText('Agents settings panel')).not.toBeInTheDocument();
  });

  it('loads billing settings when the billing tab is selected', async () => {
    searchParamsState.tab = 'billing';

    render(<SettingsPage />);

    expect(await screen.findByText('Billing settings panel')).toBeInTheDocument();
    expect(screen.queryByText('Agency profile')).not.toBeInTheDocument();
  });

  it('loads webhook settings when the webhooks tab is selected', async () => {
    searchParamsState.tab = 'webhooks';

    render(<SettingsPage />);

    expect(await screen.findByText('Webhook settings panel')).toBeInTheDocument();
  });

  it('loads agent settings when the agents tab is selected', async () => {
    searchParamsState.tab = 'agents';

    render(<SettingsPage />);

    expect(await screen.findByText('Agents settings panel')).toBeInTheDocument();
  });
});
