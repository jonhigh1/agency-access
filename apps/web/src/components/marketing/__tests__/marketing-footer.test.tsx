import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MarketingFooter } from '../marketing-footer';

const { pathname, push } = vi.hoisted(() => ({ pathname: vi.fn(), push: vi.fn() }));

vi.mock('next/link', () => ({
  default: ({ href, children, onClick }: any) => <a href={href} onClick={onClick}>{children}</a>,
}));
vi.mock('next/navigation', () => ({ usePathname: pathname, useRouter: () => ({ push }) }));
vi.mock('@/lib/docs-url', () => ({ getDocsUrl: () => 'https://docs.example.test' }));
vi.mock('@/components/ui/platform-icon', () => ({
  PlatformIcon: ({ platform }: { platform: string }) => (
    <div data-testid={`platform-icon-${platform}`} />
  ),
}));

describe('MarketingFooter section links', () => {
  beforeEach(() => {
    pathname.mockReturnValue('/pricing');
    push.mockReset();
  });

  it.each([
    ['/pricing', 'Features', 'trusted-by-agencies'],
    ['/blog/example', 'How It Works', 'how-it-works'],
    ['/contact', 'Features', 'trusted-by-agencies'],
  ])('routes %s footer link to homepage section', async (path, label, id) => {
      pathname.mockReturnValue(path);
      render(<MarketingFooter />);

      const link = screen.getByRole('link', { name: label });
      if (path === '/blog/example') {
        link.focus();
        await userEvent.setup().keyboard('{Enter}');
      } else {
        fireEvent.click(link);
      }

      expect(push).toHaveBeenCalledWith(`/#${id}`);
    });

  it('links to the ungated access-level tool', () => {
    render(<MarketingFooter />);
    expect(screen.getByRole('link', { name: 'Access-level tool' })).toHaveAttribute(
      'href',
      '/tools/access-level',
    );
  });

  it('links to the uses cluster', () => {
    render(<MarketingFooter />);
    expect(screen.getByRole('link', { name: 'Uses' })).toHaveAttribute('href', '/uses');
  });

  it('links to the stats roundup', () => {
    render(<MarketingFooter />);
    expect(screen.getByRole('link', { name: 'Stats' })).toHaveAttribute('href', '/stats');
  });
});

describe('MarketingFooter partner badges', () => {
  it('renders official partner badges in the brand column', () => {
    render(<MarketingFooter />);
    expect(screen.getByText('Google Official Partner')).toBeInTheDocument();
    expect(screen.getByText('Meta Official Partner')).toBeInTheDocument();
  });
});
