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

  it.each(['not_connected', 'needs_portfolio'] as const)(
    'links to create a Business Portfolio in a new tab and offers Check again (%s)',
    (status) => {
      const onRetryMetaCheck = vi.fn();
      render(
        <PlatformSelectionScreen
          {...baseProps}
          selectedPlatforms={{ google: ['google'], meta: ['meta'] }}
          metaReadiness={{ status }}
          onConnectMeta={vi.fn()}
          onRetryMetaCheck={onRetryMetaCheck}
        />
      );

      const link = screen.getByRole('link', { name: /create a business portfolio/i });
      expect(link).toHaveAttribute('href', 'https://business.facebook.com/overview');
      expect(link).toHaveAttribute('target', '_blank');
      expect(link).toHaveAttribute('rel', expect.stringContaining('noopener'));

      fireEvent.click(screen.getByRole('button', { name: /check again/i }));
      expect(onRetryMetaCheck).toHaveBeenCalledTimes(1);
    }
  );

  it('hides the create link and skip once the portfolio is connected', () => {
    render(
      <PlatformSelectionScreen
        {...baseProps}
        selectedPlatforms={{ meta: ['meta'] }}
        metaReadiness={{ status: 'ready', portfolioName: 'Example Portfolio' }}
        onConnectMeta={vi.fn()}
      />
    );
    expect(screen.queryByRole('link', { name: /create a business portfolio/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /skip meta for now/i })).not.toBeInTheDocument();
  });

  it('skips Meta: deselects it, keeps the other platforms and says where to connect later', () => {
    const onUpdate = vi.fn();
    const { rerender } = render(
      <PlatformSelectionScreen
        {...baseProps}
        onUpdate={onUpdate}
        selectedPlatforms={{ google: ['google'], meta: ['meta'] }}
        metaReadiness={{ status: 'needs_portfolio' }}
        onConnectMeta={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /skip meta for now, connect later/i }));
    expect(onUpdate).toHaveBeenCalledWith({ google: ['google'] });

    rerender(
      <PlatformSelectionScreen
        {...baseProps}
        onUpdate={onUpdate}
        selectedPlatforms={{ google: ['google'] }}
        metaReadiness={{ status: 'needs_portfolio' }}
        onConnectMeta={vi.fn()}
      />
    );
    expect(screen.queryByTestId('meta-portfolio-panel')).not.toBeInTheDocument();
    expect(screen.getByTestId('meta-skipped-note')).toHaveTextContent(/connect it later from connections/i);
    expect(screen.getByText(/ready to generate access link/i)).toBeInTheDocument();
  });

  it('skipping when Meta was the only platform falls back to the Google default', () => {
    const onUpdate = vi.fn();
    render(
      <PlatformSelectionScreen
        {...baseProps}
        onUpdate={onUpdate}
        selectedPlatforms={{ meta: ['meta'] }}
        metaReadiness={{ status: 'not_connected' }}
        onConnectMeta={vi.fn()}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: /skip meta for now/i }));
    expect(onUpdate).toHaveBeenCalledWith({ google: ['google'] });
  });

  it('offers skip even when the status check failed', () => {
    render(
      <PlatformSelectionScreen
        {...baseProps}
        selectedPlatforms={{ meta: ['meta'] }}
        metaReadiness={{ status: 'error', message: 'Network error.' }}
        onConnectMeta={vi.fn()}
      />
    );
    expect(screen.getByRole('button', { name: /skip meta for now/i })).toBeInTheDocument();
  });
});
