import React, { useState } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Sidebar, SidebarBody, SidebarLink } from '../sidebar';

const mockUsePathname = vi.fn();

vi.mock('next/navigation', () => ({
  usePathname: () => mockUsePathname(),
}));

vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: any) => (
    <a href={typeof href === 'string' ? href : href?.pathname} {...props}>
      {children}
    </a>
  ),
}));

vi.mock('framer-motion', () => ({
  AnimatePresence: ({ children }: any) => <>{children}</>,
  useReducedMotion: () => false,
  m: {
    div: ({ children, animate, initial, exit, transition, ...props }: any) => (
      <div {...props}>{children}</div>
    ),
    dialog: ({ children, ...props }: any) => <dialog {...props}>{children}</dialog>,
    span: ({ children, animate, initial, exit, transition, ...props }: any) => (
      <span {...props}>{children}</span>
    ),
  },
}));

function StatefulMobileSidebar() {
  const [open, setOpen] = useState(false);

  return (
    <Sidebar open={open} setOpen={setOpen}>
      <SidebarBody>
        <div>Navigation content</div>
      </SidebarBody>
    </Sidebar>
  );
}

describe('Sidebar', () => {
  beforeEach(() => {
    mockUsePathname.mockReturnValue('/dashboard');
    Object.defineProperty(HTMLDialogElement.prototype, 'showModal', {
      configurable: true,
      value() { this.setAttribute('open', ''); },
    });
    Object.defineProperty(HTMLDialogElement.prototype, 'close', {
      configurable: true,
      value() { this.removeAttribute('open'); },
    });
  });

  it('renders mobile menu controls as accessible buttons with proper labels and state', async () => {
    const user = userEvent.setup();
    render(<StatefulMobileSidebar />);

    const openButton = screen.getByRole('button', { name: 'Open navigation menu' });
    expect(openButton).toHaveAttribute('aria-expanded', 'false');
    expect(openButton).toHaveClass('min-h-[44px]', 'min-w-[44px]');
    expect(screen.queryByRole('dialog', { name: 'Sidebar navigation' })).not.toBeInTheDocument();

    await user.click(openButton);

    const closeButtons = screen.getAllByRole('button', { name: 'Close navigation menu' });
    expect(closeButtons.length).toBeGreaterThan(0);
    closeButtons.forEach((closeButton) => {
      expect(closeButton).toHaveClass('min-h-[44px]', 'min-w-[44px]');
    });

    const panel = screen.getByRole('dialog', { name: 'Sidebar navigation' });
    fireEvent(panel, new Event('cancel', { cancelable: true }));
    expect(screen.queryByRole('dialog', { name: 'Sidebar navigation' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Open navigation menu' })).toHaveFocus();
  });

  it('marks parent navigation link as active on nested routes', () => {
    mockUsePathname.mockReturnValue('/settings/platforms');

    render(
      <Sidebar>
        <SidebarBody>
          <SidebarLink
            link={{
              label: 'Settings',
              href: '/settings',
              icon: <span aria-hidden>⚙</span>,
            }}
          />
        </SidebarBody>
      </Sidebar>
    );

    const settingsLinks = screen.getAllByRole('link', { name: 'Settings' });
    expect(settingsLinks.length).toBeGreaterThan(0);
    settingsLinks.forEach((settingsLink) => {
      expect(settingsLink).toHaveAttribute('aria-current', 'page');
    });
  });

  it('keeps open nav labels visible during hover animation', () => {
    render(
      <Sidebar>
        <SidebarBody>
          <SidebarLink
            link={{
              label: 'Settings',
              href: '/settings',
              icon: <span aria-hidden>⚙</span>,
            }}
          />
        </SidebarBody>
      </Sidebar>
    );

    const labels = screen.getAllByText('Settings');

    labels.forEach((label) => {
      const labelWrapper = label.parentElement;
      expect(labelWrapper).toBeInTheDocument();
      expect(labelWrapper).toHaveClass('overflow-visible');
      expect(labelWrapper).not.toHaveClass('overflow-hidden');
    });
  });
});
