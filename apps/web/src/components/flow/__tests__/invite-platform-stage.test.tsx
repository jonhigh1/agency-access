import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { Platform } from '@agency-platform/shared';
import { InvitePlatformStage } from '../invite-platform-stage';

describe('InvitePlatformStage', () => {
  it('shows what to connect, who is asking, and the exit promise before the wizard', () => {
    render(
      <InvitePlatformStage
        platform={'meta' as Platform}
        platformName="Meta"
        description="Complete this step."
        exitNote="You will leave for Meta and come right back here."
        identities={[{ label: 'Agency email', value: 'ops@demo.co' }]}
      >
        <div>Active connect task</div>
      </InvitePlatformStage>
    );

    expect(screen.getByText(/verify before you approve/i)).toBeInTheDocument();
    expect(screen.getByText(/ops@demo\.co/i)).toBeInTheDocument();
    expect(screen.getByText(/come right back/i)).toBeInTheDocument();
    expect(screen.getByText('Active connect task')).toBeInTheDocument();
  });

  it('carries no step-count label and derives its chip from the checklist status', () => {
    const { container, rerender } = render(
      <InvitePlatformStage
        platform={'meta' as Platform}
        platformName="Meta"
        description="Complete this step."
        exitNote="You will leave for Meta and come right back here."
      >
        <div>Active connect task</div>
      </InvitePlatformStage>
    );

    // Connect-first (default) reads as the live step: "In progress".
    expect(screen.getByText('In progress')).toBeInTheDocument();
    expect(container.textContent).not.toMatch(/step \d+ of \d+/i);

    rerender(
      <InvitePlatformStage
        platform={'meta' as Platform}
        platformName="Meta"
        status="waiting-on-agency"
        description="Complete this step."
        exitNote="You will leave for Meta and come right back here."
      >
        <div>Active connect task</div>
      </InvitePlatformStage>
    );

    expect(screen.getByText('Waiting')).toBeInTheDocument();
    expect(screen.queryByText('In progress')).toBeNull();
  });
});
