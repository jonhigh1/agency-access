import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BillingTab } from '../billing-tab';

const mockUseSubscription = vi.fn();

vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => '/settings',
}));

vi.mock('@clerk/nextjs', () => ({
  useAuth: () => ({ orgId: 'org_123', userId: 'user_123' }),
}));

vi.mock('@/lib/query/billing', () => ({
  useSubscription: () => mockUseSubscription(),
}));
vi.mock('@/lib/analytics/billing', () => ({
  trackPlanSelected: vi.fn(),
  trackPricingViewed: vi.fn(),
  trackSubscriptionStarted: vi.fn(),
  trackTrialStarted: vi.fn(),
  trackBillingCheckoutFailed: vi.fn(),
  buildPlanSelectedProps: vi.fn(),
  buildSubscriptionStartedProps: vi.fn(),
  subscriptionTierToPlanSlug: vi.fn(),
}));

vi.mock('../billing-hero', () => ({ BillingHero: () => <div>Billing Hero</div> }));
vi.mock('../current-plan-card', () => ({ CurrentPlanCard: () => <div>Current Plan Card</div> }));
vi.mock('../manage-subscription-card', () => ({ ManageSubscriptionCard: () => <div>Manage Subscription Card</div> }));
vi.mock('../usage-limits-card', () => ({ UsageLimitsCard: () => <div>Usage Limits Card</div> }));
vi.mock('../plan-comparison', () => ({ PlanComparison: () => <div>Plan Comparison</div> }));
vi.mock('../payment-methods-card', () => ({ PaymentMethodsCard: () => <div>Payment Methods Card</div> }));
vi.mock('../invoices-card', () => ({ InvoicesCard: () => <div>Invoices Card</div> }));
vi.mock('../billing-details-card', () => ({ BillingDetailsCard: () => <div>Billing Details Card</div> }));
vi.mock('../checkout-success-toast', () => ({ CheckoutSuccessToast: () => <div>Checkout Success Toast</div> }));

describe('BillingTab lifecycle layout', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders free/trialing layout without paid-only cards', () => {
    mockUseSubscription.mockReturnValue({
      data: {
        id: 'sub_123',
        tier: 'STARTER',
        status: 'trialing',
        cancelAtPeriodEnd: false,
      },
      isLoading: false,
    });

    render(<BillingTab />);

    expect(screen.getByText('Billing Hero')).toBeInTheDocument();
    expect(screen.getByText('Plan Comparison')).toBeInTheDocument();
    expect(screen.getByText('Usage Limits Card')).toBeInTheDocument();

    expect(screen.queryByText('Manage Subscription Card')).not.toBeInTheDocument();
    expect(screen.queryByText('Payment Methods Card')).not.toBeInTheDocument();
    expect(screen.queryByText('Invoices Card')).not.toBeInTheDocument();
    expect(screen.queryByText('Billing Details Card')).not.toBeInTheDocument();
  });

  it('renders paid layout without plan comparison', () => {
    mockUseSubscription.mockReturnValue({
      data: {
        id: 'sub_456',
        tier: 'STARTER',
        status: 'active',
        cancelAtPeriodEnd: false,
      },
      isLoading: false,
    });

    render(<BillingTab />);

    expect(screen.getByText('Billing Hero')).toBeInTheDocument();
    expect(screen.getByText('Current Plan Card')).toBeInTheDocument();
    expect(screen.getByText('Manage Subscription Card')).toBeInTheDocument();
    expect(screen.getByText('Payment Methods Card')).toBeInTheDocument();
    expect(screen.getByText('Invoices Card')).toBeInTheDocument();
    expect(screen.getByText('Billing Details Card')).toBeInTheDocument();

    expect(screen.queryByText('Plan Comparison')).not.toBeInTheDocument();
  });
});
