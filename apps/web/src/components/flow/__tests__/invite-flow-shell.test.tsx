import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { InviteFlowShell } from '../invite-flow-shell';

describe('InviteFlowShell', () => {
  it('renders header, slim progress, then content in one column', () => {
    const { container } = render(
      <InviteFlowShell
        title="Share account access"
        description="Review and continue"
        step={1}
        totalSteps={3}
        steps={['Setup', 'Connect', 'Done']}
      >
        <div>Main content</div>
      </InviteFlowShell>
    );

    expect(screen.getByText('Share account access')).toBeInTheDocument();
    expect(screen.getByText(/step 1 of 3/i)).toBeInTheDocument();
    expect(container.querySelector('[role="progressbar"]')).toBeTruthy();
    expect(screen.getByText('Main content')).toBeInTheDocument();
  });

  it('keeps the current step name in the progress line', () => {
    render(
      <InviteFlowShell
        title="Complete Google access"
        step={2}
        totalSteps={3}
        steps={['Setup', 'Connect', 'Done']}
      >
        <div>Main content</div>
      </InviteFlowShell>
    );

    expect(screen.getByText(/step 2 of 3 · connect/i)).toBeInTheDocument();
  });
});
