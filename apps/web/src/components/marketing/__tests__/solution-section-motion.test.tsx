import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SolutionSectionNew } from '../solution-section-new';

const motion = vi.hoisted(() => ({ reduced: false, inView: true }));
vi.mock('framer-motion', () => ({ useReducedMotion: () => motion.reduced, useInView: () => motion.inView }));
vi.mock('../reveal', () => ({ Reveal: ({ children }: { children: React.ReactNode }) => children }));
vi.mock('@/components/lazy-clerk-auth-buttons', () => ({ SignUpButton: ({ children }: { children: React.ReactNode }) => children }));

beforeEach(() => { vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'requestAnimationFrame', 'cancelAnimationFrame', 'performance'] }); motion.reduced = false; motion.inView = true; });
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.useRealTimers(); });

describe('access comparison playback', () => {
  it('animates one persistent counter per message and holds each total', () => {
    render(<SolutionSectionNew />);
    const counter = screen.getByTestId('agency-time');
    expect(counter.textContent).toBe('0m');
    act(() => vi.advanceTimersByTime(700));
    expect(counter.textContent).toBe('35m');
    act(() => vi.advanceTimersByTime(1000));
    expect(counter.textContent).toBe('35m');
    act(() => vi.advanceTimersByTime(500));
    expect(screen.getByText('Think I added you')).toBeInTheDocument();
    act(() => vi.advanceTimersByTime(300));
    expect(parseInt(counter.textContent ?? '0')).toBeGreaterThan(35);
    expect(parseInt(counter.textContent ?? '0')).toBeLessThan(54);
    act(() => vi.advanceTimersByTime(400));
    expect(counter.textContent).toBe('54m');
    expect(screen.getByTestId('agency-time')).toBe(counter);
  });

  it('shows exactly 2m throughout the AuthHub example', () => {
    render(<SolutionSectionNew />);
    const counter = screen.getByTestId('agency-time');
    for (const duration of [2200, 2200, 2400, 2200, 2200, 2800]) {
      act(() => vi.advanceTimersByTime(duration));
    }
    expect(counter.textContent).toBe('2m');
    act(() => vi.advanceTimersByTime(2800));
    expect(screen.getByText('Selected access confirmed')).toBeInTheDocument();
    expect(screen.getByTestId('agency-time')).toBe(counter);
    expect(counter.textContent).toBe('2m');
  });

  it('holds the outcome, fades out, and automatically starts the next loop', () => {
    const view = render(<SolutionSectionNew />);
    expect(screen.queryByRole('button', { name: /example/i })).not.toBeInTheDocument();
    for (let i = 0; i < 7; i++) act(() => vi.advanceTimersByTime(3000));
    expect(screen.getByText('Selected access confirmed')).toBeInTheDocument();
    act(() => vi.advanceTimersByTime(3000));
    expect(screen.getByText('Selected access confirmed')).toBeInTheDocument();
    expect(view.container.querySelector('[data-resetting="true"]')).toBeInTheDocument();
    act(() => vi.advanceTimersByTime(250));
    expect(screen.getByText('How do we give you access?')).toBeInTheDocument();
    expect(screen.queryByText('Selected access confirmed')).not.toBeInTheDocument();
    expect(view.container.querySelector('[data-resetting="true"]')).not.toBeInTheDocument();
  });

  it('keeps a fourth message for the faded edge of the inbox', () => {
    render(<SolutionSectionNew />);
    for (let i = 0; i < 3; i++) act(() => vi.advanceTimersByTime(3000));
    expect(screen.getByText('Can we jump on a call?')).toBeInTheDocument();
    expect(screen.getByText('How do we give you access?')).toBeInTheDocument();
  });

  it('shows a static outcome for reduced motion and stops timers outside the viewport', () => {
    motion.reduced = true;
    const view = render(<SolutionSectionNew />);
    act(() => vi.advanceTimersByTime(60000));
    expect(screen.getByText('Selected access confirmed')).toBeInTheDocument();
    view.unmount();
    motion.reduced = false; motion.inView = false;
    render(<SolutionSectionNew />);
    act(() => vi.advanceTimersByTime(60000));
    expect(screen.getByText('How do we give you access?')).toBeInTheDocument();
    expect(screen.queryByText('Think I added you')).not.toBeInTheDocument();
  });

  it('pauses while the document is hidden', () => {
    render(<SolutionSectionNew />);
    vi.spyOn(document, 'hidden', 'get').mockReturnValue(true);
    fireEvent(document, new Event('visibilitychange'));
    act(() => vi.advanceTimersByTime(30000));
    expect(screen.queryByText('Think I added you')).not.toBeInTheDocument();
    vi.restoreAllMocks();
    fireEvent(document, new Event('visibilitychange'));
    act(() => vi.advanceTimersByTime(2300));
    expect(screen.getByText('Think I added you')).toBeInTheDocument();
  });
});
