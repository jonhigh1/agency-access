import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { SavingsCalculator } from '../savings-calculator';

vi.mock('framer-motion', () => ({ m: { div: ({ children, initial, whileInView }: any) => <div data-initial={JSON.stringify(initial)} data-while={JSON.stringify(whileInView)}>{children}</div>, span: 'span' } }));
vi.mock('@/components/lazy-clerk-auth-buttons', () => ({ SignUpButton: ({ children }: any) => children }));
vi.mock('@/hooks/use-animation-orchestrator', () => ({ useAnimationOrchestrator: () => ({ shouldAnimate: false, isHydrated: true }) }));
vi.mock('../../reveal', () => ({ Reveal: ({ children }: any) => <div>{children}</div> }));

describe('SavingsCalculator motion preference', () => {
  it('names the hours slider and updates its value', () => {
    render(<SavingsCalculator />);
    const slider = screen.getByRole('slider', { name: 'Avg. hours spent per client onboarding?' });
    fireEvent.change(slider, { target: { value: '8' } });
    expect(slider).toHaveValue('8');
    expect(screen.getAllByText('8 hours').length).toBeGreaterThan(0);
  });

  it('keeps calculator panels at rest when animations are disabled', () => {
    const { container } = render(<SavingsCalculator />);
    const panels = Array.from(container.querySelectorAll('[data-initial]')).slice(0, 2);

    expect(panels).toHaveLength(2);
    expect(panels.every((panel) => panel.getAttribute('data-initial') === 'false')).toBe(true);
    expect(panels.every((panel) => panel.getAttribute('data-while') === null)).toBe(true);
  });
});
