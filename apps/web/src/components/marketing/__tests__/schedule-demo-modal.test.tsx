import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { ScheduleDemoModal } from '../schedule-demo-modal';

vi.mock('framer-motion', () => ({
  AnimatePresence: ({ children }: any) => <>{children}</>,
  useReducedMotion: () => true,
  m: {
    div: ({ children, animate, initial, exit, transition, ...props }: any) => <div {...props}>{children}</div>,
    dialog: ({ children, animate, initial, exit, transition, ...props }: any) => <dialog {...props}>{children}</dialog>,
  },
}));

beforeEach(() => {
  Object.defineProperty(HTMLDialogElement.prototype, 'showModal', {
    configurable: true,
    value() { this.setAttribute('open', ''); },
  });
  Object.defineProperty(HTMLDialogElement.prototype, 'close', {
    configurable: true,
    value() { this.removeAttribute('open'); },
  });
});

describe('ScheduleDemoModal', () => {
  it('opens a named native modal and handles keyboard cancellation', () => {
    const onClose = vi.fn();
    render(<ScheduleDemoModal isOpen onClose={onClose} />);

    const dialog = screen.getByRole('dialog', { name: 'Schedule a Demo' });
    expect(dialog.tagName).toBe('DIALOG');
    expect(dialog).toHaveAttribute('open');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    fireEvent(dialog, new Event('cancel', { cancelable: true }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
