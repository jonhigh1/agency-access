import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ClientTabs } from '../ClientTabs';

describe('ClientTabs keyboard behavior', () => {
  it('roves focus with arrow, home, and end keys and exposes selected panel', () => {
    render(<ClientTabs platformGroups={[]} accessRequests={[]} activity={[]} clientId="client-1" />);
    const overview = screen.getByRole('tab', { name: 'Overview' });
    const activity = screen.getByRole('tab', { name: 'Activity' });

    overview.focus();
    fireEvent.keyDown(overview, { key: 'ArrowRight' });
    expect(activity).toHaveFocus();
    expect(activity).toHaveAttribute('tabIndex', '-1');

    fireEvent.keyDown(activity, { key: 'End' });
    expect(activity).toHaveFocus();
    expect(screen.getByRole('tabpanel')).toHaveAttribute('aria-labelledby', 'client-tab-overview');
  });
});
