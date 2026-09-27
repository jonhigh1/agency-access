import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { MetaFulfillmentResult } from '@agency-platform/shared';
import { MetaFulfillmentCard } from '../meta-fulfillment-card';

const results: MetaFulfillmentResult[] = [
  {
    id: 'grant-1', assetKind: 'page', assetId: 'page-1', assetName: 'Main Page',
    recipientType: 'human', recipientId: 'person-1', recipientName: 'Agency Owner',
    requestedTasks: ['ADVERTISE'], verifiedTasks: [], status: 'manual_action_required',
    nextActor: 'client_admin', nextAction: 'Share the Page, then verify.', updatedAt: '2026-09-22T00:00:00.000Z',
  },
  {
    id: 'grant-2', assetKind: 'ad_account', assetId: 'act-2', assetName: 'Second account',
    recipientType: 'human', recipientId: 'person-1', recipientName: 'Agency Owner',
    requestedTasks: ['ANALYZE'], verifiedTasks: [], status: 'selected',
    updatedAt: '2026-09-22T00:00:00.000Z',
  },
];

describe('MetaFulfillmentCard', () => {
  it('clears confirmation and reason when an exclusion is cancelled before another grant is opened', () => {
    render(<MetaFulfillmentCard results={results} onExclude={vi.fn()} />);

    fireEvent.click(screen.getAllByRole('button', { name: 'Exclude requirement' })[0]);
    fireEvent.change(screen.getByLabelText('Reason'), { target: { value: 'Client no longer uses this Page.' } });
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(screen.getByRole('button', { name: 'Keep requirement' }));
    fireEvent.click(screen.getAllByRole('button', { name: 'Exclude requirement' })[1]);

    expect(screen.getByLabelText('Reason')).toHaveValue('');
    expect(screen.getByRole('checkbox')).not.toBeChecked();
  });

  it('reports a thrown exclusion failure and re-enables retry', async () => {
    const onExclude = vi.fn().mockRejectedValue(new Error('network failed'));
    render(<MetaFulfillmentCard results={[results[0]]} onExclude={onExclude} />);

    fireEvent.click(screen.getByRole('button', { name: 'Exclude requirement' }));
    fireEvent.change(screen.getByLabelText('Reason'), { target: { value: 'Client no longer uses this Page.' } });
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(screen.getByRole('button', { name: 'Confirm exclusion' }));

    expect(await screen.findByRole('status')).toHaveTextContent('Could not save exclusion. Try again.');
    expect(screen.getByRole('button', { name: 'Confirm exclusion' })).toBeEnabled();
    expect(onExclude).toHaveBeenCalledWith('grant-1', 'Client no longer uses this Page.');
  });

  it('announces a successful exclusion and restores focus to its result row', async () => {
    render(<MetaFulfillmentCard results={[results[0]]} onExclude={vi.fn().mockResolvedValue(null)} />);

    fireEvent.click(screen.getByRole('button', { name: 'Exclude requirement' }));
    fireEvent.change(screen.getByLabelText('Reason'), { target: { value: 'Client no longer uses this Page.' } });
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(screen.getByRole('button', { name: 'Confirm exclusion' }));

    expect(await screen.findByRole('status')).toHaveTextContent('Request status was recalculated.');
    expect(document.activeElement).toHaveTextContent('Main Page');
  });
});
