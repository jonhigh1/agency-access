import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ReviewDemoManualAdAccountPanel } from '../ReviewDemoManualAdAccountPanel';

describe('ReviewDemoManualAdAccountPanel', () => {
  it('renders verified partner readback with the full permitted task list', () => {
    render(
      <ReviewDemoManualAdAccountPanel
        agencyBusinessId="3808519629379919"
        agencyBusinessName="AuthHub Agency BM"
        adAccountId="act_557538895783894"
        adAccountName="Review Ad Account"
        verified
        permittedTasks={['DRAFT', 'ANALYZE', 'ADVERTISE', 'MANAGE']}
        checking={false}
        onCheckAccess={vi.fn()}
      />
    );

    expect(screen.getByTestId('review-demo-partner-status')).toHaveTextContent(
      'Partner access verified — tasks: DRAFT, ANALYZE, ADVERTISE, MANAGE'
    );
    expect(screen.getByTestId('review-demo-check-ad-access')).toBeDisabled();
  });
});
