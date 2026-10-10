import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

// framer-motion per-file mock (house idiom, mirrors social-proof-motion.test.tsx)
vi.mock('framer-motion', () => ({
  m: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
    path: ({ children, ...props }: any) => <path {...props}>{children}</path>,
    button: ({ children, onClick, className, 'aria-label': label }: any) => (
      <button onClick={onClick} className={className} aria-label={label}>{children}</button>
    ),
  },
  AnimatePresence: ({ children }: any) => <div>{children}</div>,
}));

import { SuccessStoriesSection } from '../success-stories-section';

describe('SuccessStoriesSection with a single case study', () => {
  it('hides carousel controls when there is only one story', () => {
    render(<SuccessStoriesSection />);
    expect(screen.queryByRole('button', { name: /previous case study/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /case study/i })).toBeNull();
  });

  it('renders the active case study content', () => {
    render(<SuccessStoriesSection />);
    expect(screen.getByText('Pillar AI Agency')).toBeInTheDocument();
    expect(screen.getByText('AJ S.')).toBeInTheDocument();
  });
});
