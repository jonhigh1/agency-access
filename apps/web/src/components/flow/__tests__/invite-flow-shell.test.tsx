import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { InviteFlowShell } from '../invite-flow-shell';
import type { InvitePlatformChecklistEntry } from '@/lib/invite/platform-status';

const { trackInviteProgressCheckRequestedMock } = vi.hoisted(() => ({
  trackInviteProgressCheckRequestedMock: vi.fn(),
}));

vi.mock('@/lib/analytics/invite-events', () => ({
  trackInviteProgressCheckRequested: trackInviteProgressCheckRequestedMock,
}));

const entry = (overrides: Partial<InvitePlatformChecklistEntry>): InvitePlatformChecklistEntry => ({
  platform: 'meta' as InvitePlatformChecklistEntry['platform'],
  platformName: 'Meta',
  status: 'connect-first',
  copy: 'Connect Meta to continue.',
  ...overrides,
});

const doneEntry: InvitePlatformChecklistEntry = entry({
  platform: 'google' as InvitePlatformChecklistEntry['platform'],
  platformName: 'Google',
  status: 'done',
  copy: 'Access confirmed.',
});

const actionNeededEntry: InvitePlatformChecklistEntry = entry({
  status: 'action-needed',
  copy: 'Finish sharing your Meta accounts to complete this step.',
});

describe('InviteFlowShell', () => {
  it('renders the named-platform checklist as the one progress surface', () => {
    render(
      <InviteFlowShell title="Share account access" checklist={[doneEntry, actionNeededEntry]}>
        <div>Main content</div>
      </InviteFlowShell>
    );

    expect(screen.getByText('Share account access')).toBeInTheDocument();
    expect(screen.getByRole('list', { name: /request progress/i })).toBeInTheDocument();
    expect(screen.getByText('Google')).toBeInTheDocument();
    expect(screen.getByText('Access confirmed.')).toBeInTheDocument();
    expect(screen.getByText('Meta')).toBeInTheDocument();
    expect(screen.getByText('Finish sharing your Meta accounts to complete this step.')).toBeInTheDocument();
    expect(screen.getByText('Main content')).toBeInTheDocument();
  });

  it('never renders a percentage, progressbar, or legacy step counter', () => {
    const { container } = render(
      <InviteFlowShell title="Share account access" checklist={[doneEntry, actionNeededEntry]}>
        <div>Main content</div>
      </InviteFlowShell>
    );

    expect(container.querySelector('[role="progressbar"]')).toBeNull();
    expect(container.textContent).not.toContain('%');
    expect(container.textContent).not.toMatch(/step \d+ of \d+/i);
  });

  it('shows the check icon only on done entries', () => {
    const { container } = render(
      <InviteFlowShell title="Share account access" checklist={[doneEntry, actionNeededEntry]}>
        <div>Main content</div>
      </InviteFlowShell>
    );

    const rows = screen.getAllByRole('listitem');
    const doneRow = rows.find((row) => row.textContent?.includes('Access confirmed.'));
    const actionRow = rows.find((row) => row.textContent?.includes('Finish sharing'));
    expect(doneRow?.querySelectorAll('svg.lucide-check')).toHaveLength(1);
    expect(actionRow?.querySelectorAll('svg.lucide-check')).toHaveLength(0);
    expect(screen.getByText('Done')).toBeInTheDocument();
    expect(screen.getByText('Needs you')).toBeInTheDocument();
  });

  it('renders a single-platform checklist with no step-count noise at all', () => {
    const { container } = render(
      <InviteFlowShell title="Complete Google access" checklist={[actionNeededEntry]}>
        <div>Main content</div>
      </InviteFlowShell>
    );

    expect(screen.getByRole('list', { name: /request progress/i })).toBeInTheDocument();
    expect(container.textContent).not.toMatch(/step 1 of 1/i);
    expect(container.textContent).not.toMatch(/step \d+ of \d+/i);
    expect(container.textContent).not.toContain('%');
    expect(container.querySelectorAll('svg.lucide-check')).toHaveLength(0);
  });

  it('offers check again, disabled with a checking label while the refresh is in flight', async () => {
    const onRefresh = vi.fn();
    const { rerender } = render(
      <InviteFlowShell
        title="Share account access"
        checklist={[actionNeededEntry]}
        onRefresh={onRefresh}
      >
        <div>Main content</div>
      </InviteFlowShell>
    );

    await userEvent.click(screen.getByRole('button', { name: /check again/i }));
    expect(onRefresh).toHaveBeenCalledTimes(1);
    expect(trackInviteProgressCheckRequestedMock).toHaveBeenCalledTimes(1);
    expect(trackInviteProgressCheckRequestedMock).toHaveBeenCalledWith();

    rerender(
      <InviteFlowShell
        title="Share account access"
        checklist={[actionNeededEntry]}
        onRefresh={onRefresh}
        isRefreshing
      >
        <div>Main content</div>
      </InviteFlowShell>
    );

    const checking = screen.getByRole('button', { name: /checking/i });
    expect(checking).toBeDisabled();
    expect(screen.queryByRole('button', { name: /^check again$/i })).toBeNull();
  });

  it('shows a refresh failure note without presenting stale entries as fresh', () => {
    render(
      <InviteFlowShell
        title="Share account access"
        checklist={[actionNeededEntry]}
        onRefresh={() => {}}
        refreshError="We couldn't check just now. Try again."
      >
        <div>Main content</div>
      </InviteFlowShell>
    );

    expect(screen.getByText("We couldn't check just now. Try again.")).toBeInTheDocument();
  });

  it('renders header and content only when no checklist is supplied', () => {
    render(
      <InviteFlowShell title="Confirming your authorization">
        <div>Main content</div>
      </InviteFlowShell>
    );

    expect(screen.queryByRole('list', { name: /request progress/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /check again/i })).toBeNull();
    expect(screen.getByText('Main content')).toBeInTheDocument();
  });

  it('uses a valid brand color only for the decorative frame accent', () => {
    const { rerender } = render(
      <InviteFlowShell title="Share account access" primaryColor="#0A7CFF">
        <div>Main content</div>
      </InviteFlowShell>
    );

    expect(screen.getByTestId('invite-brand-accent')).toHaveStyle({ borderTopColor: '#0A7CFF' });

    rerender(
      <InviteFlowShell title="Share account access" primaryColor="blue">
        <div>Main content</div>
      </InviteFlowShell>
    );

    expect(screen.getByTestId('invite-brand-accent')).toHaveStyle({ borderTopColor: '#FF6B35' });
  });
});
