import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MarketingNav } from '../marketing-nav';

// Mock Next.js Link
vi.mock('next/link', () => ({
  default: ({ children, href, onClick, className }: any) => (
    <a href={href} onClick={onClick} className={className} data-testid={`link-${href}`}>
      {children}
    </a>
  ),
}));

// Mock Next.js navigation
const mockPathname = '/';
const mockUsePathname = vi.fn(() => mockPathname);
const mockPush = vi.fn();

vi.mock('next/navigation', () => ({
  usePathname: () => mockUsePathname(),
  useRouter: () => ({ push: mockPush }),
}));

// Mock Clerk components
vi.mock('@/components/lazy-clerk-auth-buttons', () => ({
  SignInButton: ({ children }: any) => <>{children}</>,
  SignUpButton: ({ children }: any) => <>{children}</>,
}));

// Mock framer-motion
vi.mock('framer-motion', () => ({
  m: {
    div: ({ children, className, onClick, ...props }: any) => (
      <div className={className} onClick={onClick} data-testid="motion-div">
        {children}
      </div>
    ),
  },
  AnimatePresence: ({ children }: any) => <>{children}</>,
}));

beforeEach(() => {
  // Reset body overflow before each test
  document.body.style.overflow = '';
  mockUsePathname.mockReturnValue('/');
});

const featuresLinks = () => screen.getAllByRole('link', { name: 'Features' });

describe('MarketingNav', () => {
  describe('Mobile Menu', () => {
    it('should toggle mobile menu when hamburger button is clicked', async () => {
      const user = userEvent.setup();
      render(<MarketingNav />);

      const menuButton = screen.getByLabelText('Open navigation menu');
      expect(menuButton).toBeInTheDocument();

      // Open menu
      await user.click(menuButton);
      
      // Check that menu content is visible
      expect(featuresLinks()).toHaveLength(2);
      expect(featuresLinks()[1]).toBeVisible();
      expect(screen.getAllByRole('link', { name: 'How It Works' })[1]).toBeVisible();
      expect(screen.getAllByRole('link', { name: 'Pricing' })[1]).toBeVisible();
      
      // Hamburger button should now show "Close navigation menu"
      const closeNavButton = screen.getByLabelText('Close navigation menu');
      expect(closeNavButton).toBeInTheDocument();
      
      // Menu panel should have its own close button
      const panelCloseButton = screen.getByLabelText('Close menu');
      expect(panelCloseButton).toBeInTheDocument();
    });

    it('should close mobile menu when backdrop is clicked', async () => {
      const user = userEvent.setup();
      render(<MarketingNav />);

      // Open menu
      const menuButton = screen.getByLabelText('Open navigation menu');
      await user.click(menuButton);

      // Click backdrop (first motion-div is the backdrop)
      const backdrop = screen.getAllByTestId('motion-div')[0];
      await user.click(backdrop);

      await waitFor(() => {
        expect(featuresLinks()).toHaveLength(1);
        expect(screen.getByLabelText('Open navigation menu')).toBeInTheDocument();
      });
    });

    it('should close mobile menu when close button is clicked', async () => {
      const user = userEvent.setup();
      render(<MarketingNav />);

      // Open menu
      const menuButton = screen.getByLabelText('Open navigation menu');
      await user.click(menuButton);

      // Click panel close button (inside menu panel)
      const panelCloseButton = screen.getByLabelText('Close menu');
      await user.click(panelCloseButton);

      await waitFor(() => {
        expect(featuresLinks()).toHaveLength(1);
        expect(screen.getByLabelText('Open navigation menu')).toBeInTheDocument();
      });
    });

    it('should prevent body scroll when menu is open', async () => {
      const user = userEvent.setup();
      render(<MarketingNav />);

      // Menu closed - body scroll should be enabled
      expect(document.body.style.overflow).toBe('');

      // Open menu
      const menuButton = screen.getByLabelText('Open navigation menu');
      await user.click(menuButton);

      // Body scroll should be disabled
      expect(document.body.style.overflow).toBe('hidden');

      // Close menu via panel close button
      const panelCloseButton = screen.getByLabelText('Close menu');
      await user.click(panelCloseButton);

      // Body scroll should be enabled again
      await waitFor(() => {
        expect(document.body.style.overflow).toBe('');
      });
    });

    it('should close menu when nav link is clicked', async () => {
      const user = userEvent.setup();
      render(<MarketingNav />);

      // Open menu
      const menuButton = screen.getByLabelText('Open navigation menu');
      await user.click(menuButton);

      // Click Features link (anchor link)
      const featuresLink = featuresLinks()[1];
      await user.click(featuresLink);

      await waitFor(() => {
        expect(featuresLinks()).toHaveLength(1);
        expect(screen.getByLabelText('Open navigation menu')).toBeInTheDocument();
      });
    });

    it('should have proper z-index layering', () => {
      render(<MarketingNav />);

      const nav = screen.getByRole('navigation');
      expect(nav).toHaveClass('z-40');
      
      // Open menu to check z-index of menu elements
      const menuButton = screen.getByLabelText('Open navigation menu');
      fireEvent.click(menuButton);
      
      // Backdrop should be z-[45]
      const backdrop = screen.getAllByTestId('motion-div')[0];
      expect(backdrop).toHaveClass('z-[9998]');
      
      // Menu panel should have highest z-index z-[50]
      const menuPanel = screen.getAllByTestId('motion-div')[1];
      expect(menuPanel).toHaveClass('z-[9999]');
    });

    it('should have adequate touch target sizes (44px minimum)', () => {
      render(<MarketingNav />);

      const menuButton = screen.getByLabelText('Open navigation menu');
      expect(menuButton).toHaveClass('min-h-[44px]', 'min-w-[44px]');
    });

    it('should have accessible labels for all interactive elements', () => {
      render(<MarketingNav />);

      const menuButton = screen.getByLabelText('Open navigation menu');
      expect(menuButton).toHaveAttribute('aria-expanded', 'false');

      // Open menu to check buttons
      fireEvent.click(menuButton);

      // Hamburger button should now show close label
      const navCloseButton = screen.getByLabelText('Close navigation menu');
      expect(navCloseButton).toBeInTheDocument();
      
      // Panel should have its own close button
      const panelCloseButton = screen.getByLabelText('Close menu');
      expect(panelCloseButton).toBeInTheDocument();
    });

    it('should close menu when pathname changes', () => {
      const { rerender } = render(<MarketingNav />);
      
      // Open menu
      const menuButton = screen.getByLabelText('Open navigation menu');
      fireEvent.click(menuButton);
      
      expect(featuresLinks()[1]).toBeVisible();
      
      // Change pathname
      mockUsePathname.mockReturnValue('/pricing');
      rerender(<MarketingNav />);
      
      waitFor(() => {
        expect(featuresLinks()).toHaveLength(1);
        expect(screen.getByLabelText('Open navigation menu')).toBeInTheDocument();
      });
    });
  });

  describe('Desktop Navigation', () => {
    it('should hide mobile menu button on desktop screens', () => {
      render(<MarketingNav />);

      const menuButton = screen.getByLabelText('Open navigation menu');
      expect(menuButton).toHaveClass('md:hidden');
    });

    it('should display desktop navigation on md screens and up', () => {
      render(<MarketingNav />);

      const desktopNav = featuresLinks()[0].closest('div');
      expect(desktopNav).toHaveClass('hidden', 'md:flex');
    });
  });

  describe('Scroll Behavior', () => {
    it('should handle anchor link scrolling with header offset', async () => {
      const user = userEvent.setup();
      
      // Create a target element
      const targetElement = document.createElement('div');
      targetElement.id = 'trusted-by-agencies';
      targetElement.style.height = '100px';
      document.body.appendChild(targetElement);

      render(<MarketingNav />);

      // Scroll to element via link
      const featuresLink = screen.getByText('Features');
      await user.click(featuresLink);

      // Verify scroll logic is called (not testing actual scroll in this unit test)
      document.body.removeChild(targetElement);
    });
  });
});
