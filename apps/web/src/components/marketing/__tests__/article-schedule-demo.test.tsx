import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ArticleScheduleDemo } from '../article-schedule-demo';

vi.mock('../schedule-demo-modal', () => ({
  ScheduleDemoModal: ({ isOpen }: { isOpen: boolean }) => isOpen ? <div role="dialog" aria-label="Schedule a Demo" /> : null,
}));

describe('ArticleScheduleDemo', () => {
  it('opens the existing scheduling modal on button activation', () => {
    render(<ArticleScheduleDemo />);

    fireEvent.click(screen.getByRole('button', { name: 'Schedule Demo' }));

    expect(screen.getByRole('dialog', { name: 'Schedule a Demo' })).toBeInTheDocument();
  });
});
