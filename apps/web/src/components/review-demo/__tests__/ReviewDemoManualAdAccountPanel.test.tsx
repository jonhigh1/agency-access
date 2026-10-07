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

  it('renders the agency business ID inline in checklist step 2 with copy control', () => {
    render(
      <ReviewDemoManualAdAccountPanel
        agencyBusinessId="3808519629379919"
        adAccountId="act_557538895783894"
        verified={false}
        permittedTasks={[]}
        checking={false}
        onCheckAccess={vi.fn()}
      />
    );

    const step2Id = screen.getByTestId('review-demo-step2-partner-bm-id');
    expect(step2Id).toHaveTextContent('3808519629379919');
    expect(step2Id.closest('li')).toHaveTextContent(/Partner business ID/i);
  });

  it('shows not configured when agency business ID is missing', () => {
    render(
      <ReviewDemoManualAdAccountPanel
        agencyBusinessId=""
        adAccountId="act_557538895783894"
        verified={false}
        permittedTasks={[]}
        checking={false}
        onCheckAccess={vi.fn()}
      />
    );

    expect(screen.getByTestId('review-demo-step2-partner-bm-not-configured')).toHaveTextContent(
      'Agency Business ID not configured'
    );
  });
});
