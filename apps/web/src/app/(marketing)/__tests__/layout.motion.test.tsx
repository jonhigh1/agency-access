import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import MarketingLayout from '../layout';

const { renderAnimationGate } = vi.hoisted(() => ({ renderAnimationGate: vi.fn() }));

vi.mock('@/components/animation-gate', () => ({
  AnimationGate: () => {
    renderAnimationGate();
    return null;
  },
}));

vi.mock('framer-motion', () => ({
  LazyMotion: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="marketing-motion-provider">{children}</div>
  ),
  domAnimation: {},
}));

vi.mock('@/components/marketing/marketing-nav', () => ({
  MarketingNav: () => <div data-testid="marketing-nav" />,
}));

vi.mock('@/components/marketing/marketing-footer', () => ({
  MarketingFooter: () => <div data-testid="marketing-footer" />,
}));

describe('MarketingLayout', () => {
  it('provides a framer-motion feature boundary for marketing sections that use `m` and viewport animations', () => {
    render(
      <MarketingLayout>
        <div>Content</div>
      </MarketingLayout>
    );

    expect(screen.getByTestId('marketing-motion-provider')).toBeInTheDocument();
    expect(screen.getByText('Content')).toBeInTheDocument();
  });

  it('uses the animation gate mounted by the root layout only', () => {
    renderAnimationGate.mockClear();
    render(<MarketingLayout>Content</MarketingLayout>);
    expect(renderAnimationGate).not.toHaveBeenCalled();
  });
});
