import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
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
  const originalFlag = process.env.NEXT_PUBLIC_BILLING_V2_ENABLED;

  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.NEXT_PUBLIC_BILLING_V2_ENABLED;
  });

  afterEach(() => {
    if (originalFlag === undefined) delete process.env.NEXT_PUBLIC_BILLING_V2_ENABLED;
    else process.env.NEXT_PUBLIC_BILLING_V2_ENABLED = originalFlag;
  });

  it('legacy branch renders the seven groups in order and no hero (KTD6)', () => {
    process.env.NEXT_PUBLIC_BILLING_V2_ENABLED = 'false';
    mockUseSubscription.mockReturnValue({
      data: { id: 'sub_legacy', tier: 'GROWTH', status: 'active', cancelAtPeriodEnd: false },
      isLoading: false,
    });

    const { container } = render(<BillingTab />);

    expect(screen.queryByText('Billing Hero')).not.toBeInTheDocument();
    expect(container.querySelectorAll('.ink-panel')).toHaveLength(0);

    const expectedOrder = [
      'Current Plan Card',
      'Manage Subscription Card',
      'Usage Limits Card',
      'Plan Comparison',
      'Payment Methods Card',
      'Invoices Card',
      'Billing Details Card',
    ];
    const rendered = Array.from(container.querySelectorAll('div'))
      .map((node) => node.textContent)
      .filter((text) => expectedOrder.includes(text ?? ''));
    expect(rendered).toEqual(expectedOrder);
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
