import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { HierarchicalPlatformSelector } from '../hierarchical-platform-selector';

const FLAG = 'NEXT_PUBLIC_META_PENDING_APPROVAL';
const original = process.env[FLAG];

afterEach(() => {
  if (original === undefined) delete process.env[FLAG];
  else process.env[FLAG] = original;
});

describe('HierarchicalPlatformSelector: Meta pending approval flag', () => {
  it('flag on: Meta shows as pending with no toggle or expand control', () => {
    process.env[FLAG] = 'true';
    const onSelectionChange = vi.fn();
    render(
      <HierarchicalPlatformSelector selectedPlatforms={{}} onSelectionChange={onSelectionChange} showAllPlatforms />
    );

    const meta = screen.getByTestId('platform-group-pending-meta');
    expect(meta).toHaveTextContent('Pending Meta approval (coming soon)');
    expect(meta).toHaveAttribute('aria-disabled', 'true');
    expect(screen.queryByRole('button', { name: /Toggle all Meta products/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Meta platform group/i })).not.toBeInTheDocument();

    fireEvent.click(meta);
    expect(onSelectionChange).not.toHaveBeenCalled();

    // Google still works.
    fireEvent.click(screen.getByRole('button', { name: /Toggle all Google products/i }));
    expect(onSelectionChange).toHaveBeenCalledWith(expect.objectContaining({ google: expect.arrayContaining(['google_ads']) }));
  });

  it('flag on: a connected Meta is still shown as pending, not selectable', () => {
    process.env[FLAG] = 'true';
    render(
      <HierarchicalPlatformSelector
        selectedPlatforms={{}}
        onSelectionChange={vi.fn()}
        connectedPlatforms={[
          { platform: 'google', name: 'Google', connected: true },
          { platform: 'meta', name: 'Meta', connected: true },
        ]}
      />
    );
    expect(screen.getByTestId('platform-group-pending-meta')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Google platform group/i })).toBeInTheDocument();
  });

  it('flag off: Meta renders as a normal selectable group', () => {
    delete process.env[FLAG];
    const onSelectionChange = vi.fn();
    render(
      <HierarchicalPlatformSelector selectedPlatforms={{}} onSelectionChange={onSelectionChange} showAllPlatforms />
    );

    expect(screen.queryByTestId('platform-group-pending-meta')).not.toBeInTheDocument();
    expect(screen.queryByText('Pending Meta approval (coming soon)')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Toggle all Meta products/i }));
    expect(onSelectionChange).toHaveBeenCalledWith({ meta: ['meta_ads', 'meta_pages', 'instagram'] });
  });
});
