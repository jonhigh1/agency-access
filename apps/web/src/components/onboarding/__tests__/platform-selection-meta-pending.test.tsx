import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { PlatformSelectionScreen } from '../screens/platform-selection-screen';

const FLAG = 'NEXT_PUBLIC_META_PENDING_APPROVAL';
const original = process.env[FLAG];

afterEach(() => {
  if (original === undefined) delete process.env[FLAG];
  else process.env[FLAG] = original;
});

function renderScreen(selectedPlatforms: Record<string, string[]>, onUpdate = vi.fn()) {
  render(
    <PlatformSelectionScreen
      selectedPlatforms={selectedPlatforms}
      onUpdate={onUpdate}
      onGenerate={vi.fn()}
      loading={false}
      metaReadiness={{ status: 'not_connected' }}
      onConnectMeta={vi.fn()}
    />
  );
  return onUpdate;
}

describe('PlatformSelectionScreen: Meta pending approval flag', () => {
  it('flag on: Meta is greyed out, labeled, and cannot be selected', () => {
    process.env[FLAG] = 'true';
    const onUpdate = renderScreen({ google: ['google'] });

    const meta = screen.getByTestId('platform-pending-meta');
    expect(meta).toBeDisabled();
    expect(meta).toHaveTextContent('Pending Meta approval (coming soon)');

    fireEvent.click(meta);
    fireEvent.click(screen.getByTestId('platform-group-heading-meta'));
    expect(onUpdate).not.toHaveBeenCalled();
  });

  it('flag on: never renders the Meta Business Portfolio panel', () => {
    process.env[FLAG] = 'true';
    renderScreen({ google: ['google'], meta: ['meta'] });

    expect(screen.queryByTestId('meta-portfolio-panel')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /connect meta business portfolio/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/connect your meta business portfolio above/i)).not.toBeInTheDocument();
  });

  it('flag off: Meta is selectable and the portfolio panel shows as today', () => {
    delete process.env[FLAG];
    const onUpdate = renderScreen({ google: ['google'] });

    expect(screen.queryByTestId('platform-pending-meta')).not.toBeInTheDocument();
    expect(screen.queryByText('Pending Meta approval (coming soon)')).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId('platform-group-heading-meta'));
    expect(onUpdate).toHaveBeenCalledWith({ google: ['google'], meta: ['meta'] });
  });

  it('flag off: Meta selected still shows the portfolio panel', () => {
    process.env[FLAG] = 'false';
    renderScreen({ google: ['google'], meta: ['meta'] });
    expect(screen.getByRole('button', { name: /connect meta business portfolio/i })).toBeInTheDocument();
  });
});
