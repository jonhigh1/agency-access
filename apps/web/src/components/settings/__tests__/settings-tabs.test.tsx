import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SettingsTabs } from '../settings-tabs';

const mockReplace = vi.fn();
const mockPrefetchBilling = vi.fn();
const mockUseUserAgency = vi.fn();
const mockUseSubscription = vi.fn();
let searchParamsState = new URLSearchParams();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: mockReplace, push: vi.fn() }),
  useSearchParams: () => searchParamsState,
  usePathname: () => '/settings',
}));

vi.mock('@/lib/query/billing', () => ({
  usePrefetchBillingData: () => mockPrefetchBilling,
  useSubscription: () => mockUseSubscription(),
}));

vi.mock('@/hooks/use-user-agency', () => ({
  useUserAgency: () => mockUseUserAgency(),
}));

function renderTabs() {
  return render(
    <SettingsTabs
      generalContent={<p>general body</p>}
      billingContent={<p>billing body</p>}
      webhooksContent={<p>webhooks body</p>}
      agentsContent={<p>agents body</p>}
    />
  );
}

describe('SettingsTabs', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    searchParamsState = new URLSearchParams();
    mockUseUserAgency.mockReturnValue({ data: { id: 'ag_123', name: 'Acme' }, isLoading: false });
    mockUseSubscription.mockReturnValue({ data: { tier: 'GROWTH', status: 'active' }, isLoading: false });
  });

  describe('URL model', () => {
    it('renders General for an unknown ?tab= value without rewriting the URL', () => {
      searchParamsState = new URLSearchParams('tab=foo');
      renderTabs();

      expect(screen.getByText('general body')).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: 'General' })).toHaveAttribute('aria-selected', 'true');
      expect(mockReplace).not.toHaveBeenCalled();
    });

    it('renders General when ?tab= is absent', () => {
      renderTabs();
      expect(screen.getByText('general body')).toBeInTheDocument();
    });

    it('activates Billing from ?tab=billing&checkout=success and keeps checkout on tab change', () => {
      searchParamsState = new URLSearchParams('tab=billing&checkout=success');
      renderTabs();

      expect(screen.getByText('billing body')).toBeInTheDocument();
      fireEvent.click(screen.getByRole('tab', { name: 'General' }));
      expect(mockReplace).toHaveBeenCalledWith('?tab=general&checkout=success', { scroll: false });
    });
  });

  describe('tab rail accessibility', () => {
    it('exposes a tablist with four text-only tabs and aria-selected', () => {
      renderTabs();

      const tablist = screen.getByRole('tablist');
      const tabs = screen.getAllByRole('tab');
      expect(tabs).toHaveLength(4);
      expect(tabs.map((tab) => tab.textContent?.trim())).toEqual(['General', 'Billing', 'Webhooks', 'Agents']);
      expect(tablist.querySelector('svg')).toBeNull();
      expect(tabs[0]).toHaveAttribute('aria-selected', 'true');
      expect(tabs[1]).toHaveAttribute('aria-selected', 'false');
    });

    it('moves focus with ArrowRight, ArrowLeft, Home, and End', () => {
      renderTabs();
      const [general, billing, , agents] = screen.getAllByRole('tab');

      general.focus();
      fireEvent.keyDown(general, { key: 'ArrowRight' });
      expect(document.activeElement).toBe(billing);

      fireEvent.keyDown(billing, { key: 'ArrowLeft' });
      expect(document.activeElement).toBe(general);

      fireEvent.keyDown(general, { key: 'ArrowLeft' });
      expect(document.activeElement).toBe(agents);

      fireEvent.keyDown(agents, { key: 'Home' });
      expect(document.activeElement).toBe(general);

      fireEvent.keyDown(general, { key: 'End' });
      expect(document.activeElement).toBe(agents);
    });

    it('carries the two-ring focus classes on each tab', () => {
      renderTabs();
      for (const tab of screen.getAllByRole('tab')) {
        expect(tab.className).toContain('focus-visible:outline-[3px]');
        expect(tab.className).toContain('focus-visible:outline-coral/25');
      }
    });

    it('prefetches billing data on hover and on focus of the Billing tab', () => {
      renderTabs();
      const billing = screen.getByRole('tab', { name: 'Billing' });

      fireEvent.mouseEnter(billing);
      expect(mockPrefetchBilling).toHaveBeenCalledTimes(1);

      fireEvent.focus(billing);
      expect(mockPrefetchBilling).toHaveBeenCalledTimes(2);
    });
  });

  describe('header and identity line', () => {
    it('renders the loaded identity line: name · plan · id', () => {
      renderTabs();
      expect(screen.getByTestId('settings-identity')).toHaveTextContent('Acme · Growth · ag_123');
    });

    it('renders dashes while the agency is loading and Free for a FREE lifecycle', () => {
      mockUseUserAgency.mockReturnValue({ data: undefined, isLoading: true });
      mockUseSubscription.mockReturnValue({ data: null, isLoading: false });
      renderTabs();
      expect(screen.getByTestId('settings-identity')).toHaveTextContent('— · Free · —');
    });

    it('reads Free for an expired subscription even when a tier is set', () => {
      mockUseSubscription.mockReturnValue({ data: { tier: 'GROWTH', status: 'expired' }, isLoading: false });
      renderTabs();
      expect(screen.getByTestId('settings-identity')).toHaveTextContent('Acme · Free · ag_123');
    });

    it('drops the generic subtitle', () => {
      renderTabs();
      expect(screen.queryByText(/Manage your agency settings and preferences/i)).toBeNull();
    });

    it('uses the wide container shared by the other authenticated pages', () => {
      renderTabs();
      const shell = screen.getByTestId('settings-shell');
      expect(shell.className).toContain('max-w-7xl');
      expect(shell.className).not.toMatch(/max-w-(4|5)xl/);
    });
  });

  describe('identity line while the subscription is unresolved', () => {
    it('renders — for the plan while useSubscription is loading', () => {
      mockUseSubscription.mockReturnValue({ data: undefined, isLoading: true });
      renderTabs();
      expect(screen.getByTestId('settings-identity')).toHaveTextContent('Acme · — · ag_123');
    });

    it('renders — for the plan when useSubscription errors', () => {
      mockUseSubscription.mockReturnValue({ data: undefined, isLoading: false, isError: true });
      renderTabs();
      expect(screen.getByTestId('settings-identity')).toHaveTextContent('Acme · — · ag_123');
    });
  });
});
