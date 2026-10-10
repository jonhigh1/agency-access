import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ValueMarqueeSection } from '../value-marquee-section';

vi.mock('framer-motion', () => ({ m: { div: ({ children, animate, ...props }: any) => <div {...props} data-animate-x={animate?.x}>{children}</div> }, useReducedMotion: () => true }));
vi.mock('@/hooks/use-mobile', () => ({ useMobile: () => false }));

describe('ValueMarqueeSection motion preference', () => {
  it('renders a static readable list when reduced motion is requested', () => {
    const { container } = render(<ValueMarqueeSection />);

    expect(screen.getAllByText('One Link')).toHaveLength(3);
    expect(container.querySelector('.marketing-marquee')).toHaveAttribute('data-animate-x', '0');
    expect(container.querySelector('.marketing-marquee > [data-marquee-duplicate]')).toBeInTheDocument();
  });
});

describe('ValueMarqueeSection usage counters', () => {
  const STATS = {
    agencies: 12,
    activeClientConnections: 140,
    activePlatformAuthorizations: 380,
    completedAccessRequests: 309,
    tokenRefreshes: 5100,
  };

  it('shows production counters when stats are provided', () => {
    render(<ValueMarqueeSection stats={STATS} />);
    expect(screen.getByText('Active Platform Connections')).toBeInTheDocument();
    expect(screen.getByText('Completed Access Requests')).toBeInTheDocument();
    expect(screen.getByText('Tokens Auto-Refreshed')).toBeInTheDocument();
    expect(screen.getByText('380')).toBeInTheDocument();
    expect(screen.getByText('5,100')).toBeInTheDocument();
  });

  it('hides counters when stats are unavailable', () => {
    render(<ValueMarqueeSection />);
    expect(screen.queryByText('Active Platform Connections')).toBeNull();
  });
});
