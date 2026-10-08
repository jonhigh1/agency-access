import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { PlatformSelectionScreen } from '../screens/platform-selection-screen';

const baseProps = {
  onUpdate: vi.fn(),
  onGenerate: vi.fn(),
  loading: false,
};

describe('PlatformSelectionScreen Meta portfolio panel', () => {
  it('stays hidden when Meta is not selected', () => {
    render(
      <PlatformSelectionScreen
        {...baseProps}
        selectedPlatforms={{ google: ['google'] }}
        metaReadiness={{ status: 'not_connected' }}
        onConnectMeta={vi.fn()}
      />
    );
    expect(screen.queryByTestId('meta-portfolio-panel')).not.toBeInTheDocument();
  });

  it('lets the agency connect Meta inline when it is not connected', () => {
    const onConnectMeta = vi.fn();
    render(
      <PlatformSelectionScreen
        {...baseProps}
        selectedPlatforms={{ google: ['google'], meta: ['meta'] }}
        metaReadiness={{ status: 'not_connected' }}
        onConnectMeta={onConnectMeta}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /connect meta business portfolio/i }));
    expect(onConnectMeta).toHaveBeenCalledTimes(1);
    expect(screen.getByText(/connect your meta business portfolio above/i)).toBeInTheDocument();
  });

  it('asks for a portfolio when Meta is connected without one', () => {
    render(
      <PlatformSelectionScreen
        {...baseProps}
        selectedPlatforms={{ meta: ['meta'] }}
        metaReadiness={{ status: 'needs_portfolio' }}
        onConnectMeta={vi.fn()}
      />
    );
    expect(screen.getByRole('button', { name: /choose business portfolio/i })).toBeInTheDocument();
  });

  it('shows the connected portfolio and the ready summary', () => {
    render(
      <PlatformSelectionScreen
        {...baseProps}
        selectedPlatforms={{ google: ['google'], meta: ['meta'] }}
        metaReadiness={{ status: 'ready', portfolioName: 'Example Portfolio' }}
        onConnectMeta={vi.fn()}
      />
    );
    expect(screen.getByText('Example Portfolio')).toBeInTheDocument();
    expect(screen.getByText(/ready to generate access link/i)).toBeInTheDocument();
  });

  it('offers a re-check when the status could not be loaded', () => {
    const onRetryMetaCheck = vi.fn();
    render(
      <PlatformSelectionScreen
        {...baseProps}
        selectedPlatforms={{ meta: ['meta'] }}
        metaReadiness={{ status: 'error', message: 'Network error.' }}
        onConnectMeta={vi.fn()}
        onRetryMetaCheck={onRetryMetaCheck}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: /check again/i }));
    expect(onRetryMetaCheck).toHaveBeenCalledTimes(1);
  });
});
