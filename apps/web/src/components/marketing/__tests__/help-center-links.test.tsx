import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MarketingNav } from '../marketing-nav';
import { MarketingFooter } from '../marketing-footer';
import { ContactInfoCard } from '../contact/contact-info-card';

vi.mock('next/link', () => ({
  default: ({ children, href, onClick, className }: any) => (
    <a href={href} onClick={onClick} className={className}>
      {children}
    </a>
  ),
}));

vi.mock('next/navigation', () => ({
  usePathname: () => '/',
  useRouter: () => ({
    push: vi.fn(),
  }),
}));

vi.mock('@/components/lazy-clerk-auth-buttons', () => ({
  SignInButton: ({ children }: any) => <div>{children}</div>,
  SignUpButton: ({ children }: any) => <div>{children}</div>,
}));

vi.mock('framer-motion', () => ({
  m: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  },
  AnimatePresence: ({ children }: any) => <>{children}</>,
}));

vi.mock('@/components/marketing/schedule-demo-modal', () => ({
  ScheduleDemoModal: () => null,
}));

describe('help center links', () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_DOCS_URL = 'https://docs.authhub.co';
  });

  it('renders the marketing footer help center and affiliate links', () => {
    const { container } = render(
      <>
        <MarketingNav />
        <MarketingFooter />
      </>,
    );

    expect(screen.getByRole('link', { name: 'Help Center' })).toHaveAttribute('href', 'https://docs.authhub.co');
    expect(screen.getByRole('link', { name: 'Affiliates' })).toHaveAttribute('href', '/affiliate');
    expect(container).toHaveTextContent('Help Center');
  });

  it('sends quick-help contact traffic to the docs site instead of pricing faq', () => {
    render(<ContactInfoCard />);

    const quickHelpLink = screen.getByRole('link', { name: /help center/i });
    expect(quickHelpLink).toHaveAttribute('href', 'https://docs.authhub.co');
  });
});
