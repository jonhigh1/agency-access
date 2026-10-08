import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { PlatformSelectorGrid } from '../platform-selector-grid';
import { PLATFORM_NAMES, SUPPORTED_CONNECTION_PLATFORMS } from '@agency-platform/shared';

describe('PlatformSelectorGrid', () => {
  it('renders LinkedIn as its own group label', () => {
    render(
      <PlatformSelectorGrid
        selectedPlatforms={[]}
        onSelectionChange={vi.fn()}
        showPreSelectedMessage={false}
      />
    );

    expect(screen.getAllByText('LinkedIn').length).toBeGreaterThan(0);
    expect(screen.queryByText('LinkedIn & TikTok')).not.toBeInTheDocument();
  });

  it('renders Google, Meta, and LinkedIn in a 3-column primary row', () => {
    render(
      <PlatformSelectorGrid
        selectedPlatforms={[]}
        onSelectionChange={vi.fn()}
        showPreSelectedMessage={false}
      />
    );

    const primaryGroups = screen.getByTestId('primary-platform-groups');
    expect(primaryGroups.className).toContain('md:grid-cols-3');
  });

  it('renders exactly the platforms supported on Connections page', () => {
    render(
      <PlatformSelectorGrid
        selectedPlatforms={[]}
        onSelectionChange={vi.fn()}
        showPreSelectedMessage={false}
      />
    );

    const platformButtons = screen.getAllByRole('button');
    expect(platformButtons).toHaveLength(SUPPORTED_CONNECTION_PLATFORMS.length);
    const buttonLabels = platformButtons.map((button) => button.textContent ?? '');

    for (const platform of SUPPORTED_CONNECTION_PLATFORMS) {
      expect(buttonLabels.some((label) => label.includes(PLATFORM_NAMES[platform]))).toBe(true);
    }
  });

  it('toggles a single-platform group when its heading is clicked, like the card', () => {
    const onSelectionChange = vi.fn();
    render(
      <PlatformSelectorGrid
        selectedPlatforms={['google']}
        onSelectionChange={onSelectionChange}
        showPreSelectedMessage={false}
      />
    );

    fireEvent.click(screen.getByTestId('platform-group-heading-meta'));
    expect(onSelectionChange).toHaveBeenLastCalledWith(['google', 'meta']);
  });

  it('keeps the last-platform guard when a heading is clicked', () => {
    const onSelectionChange = vi.fn();
    render(
      <PlatformSelectorGrid
        selectedPlatforms={['google']}
        onSelectionChange={onSelectionChange}
        showPreSelectedMessage={false}
      />
    );

    fireEvent.click(screen.getByTestId('platform-group-heading-google'));
    expect(onSelectionChange).not.toHaveBeenCalled();
  });

  it('exposes selection state on platform cards', () => {
    render(
      <PlatformSelectorGrid
        selectedPlatforms={['google']}
        onSelectionChange={vi.fn()}
        showPreSelectedMessage={false}
      />
    );

    expect(screen.getByRole('button', { name: /\bGoogle$/, pressed: true })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /\bMeta$/, pressed: false })).toBeInTheDocument();
  });
});

