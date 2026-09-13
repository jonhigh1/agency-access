import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import { CheckoutSuccessToast } from '../checkout-success-toast';

const replaceMock = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: replaceMock }),
  useSearchParams: () => new URLSearchParams('tab=billing&checkout=success'),
}));

describe('CheckoutSuccessToast', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders the success message and clears the checkout param after the timer', () => {
    render(<CheckoutSuccessToast />);

    expect(screen.getByText('Subscription updated')).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(5000);
    });

    expect(replaceMock).toHaveBeenCalledWith('?tab=billing', { scroll: false });
    expect(screen.queryByText('Subscription updated')).not.toBeInTheDocument();
  });

  it('reveals with a plain opacity transition — no slide-in, no soft shadow', () => {
    const { container } = render(<CheckoutSuccessToast />);

    const root = container.firstElementChild as HTMLElement;
    expect(root.className).toContain('transition-opacity');
    expect(root.className).not.toContain('animate-in');
    expect(root.className).not.toContain('slide-in');
    expect(container.querySelector('[class*="shadow-lg"]')).toBeNull();
  });
});
