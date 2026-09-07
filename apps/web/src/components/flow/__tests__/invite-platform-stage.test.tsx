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
        stepNumber={2}
        totalCount={3}
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
    expect(screen.getByText(/now · step 2 of 3/i)).toBeInTheDocument();
  });
});
