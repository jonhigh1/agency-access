import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { SocialProofSection } from '../social-proof-section';

vi.mock('framer-motion', () => ({ m: { div: ({ children, animate, ...props }: any) => <div {...props} data-animate-x={animate?.x}>{children}</div> }, useReducedMotion: () => true }));
vi.mock('@/hooks/use-mobile', () => ({ useMobile: () => false }));

describe('SocialProofSection motion preference', () => {
  it('renders a static readable list when reduced motion is requested', () => {
    const { container } = render(<SocialProofSection />);

    expect(screen.getAllByText('One Link')).toHaveLength(3);
    expect(container.querySelector('.marketing-marquee')).toHaveAttribute('data-animate-x', '0');
    expect(container.querySelector('.marketing-marquee > [data-marquee-duplicate]')).toBeInTheDocument();
  });
});
