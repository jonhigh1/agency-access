import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import type { ComponentProps } from 'react';
import { UnifiedWizard } from '../unified-wizard';

function renderWizard(overrides: Partial<ComponentProps<typeof UnifiedWizard>> = {}) {
  const props: ComponentProps<typeof UnifiedWizard> = {
    children: <input aria-label="Client Name" />,
    currentStep: 1,
    totalSteps: 7,
    onNext: vi.fn(),
    onBack: vi.fn(),
    canGoNext: true,
    canGoBack: true,
    canSkip: false,
    onSkip: vi.fn(),
    loading: false,
    showClose: false,
    onClose: vi.fn(),
    ...overrides,
  };

  render(<UnifiedWizard {...props} />);
  return props;
}

describe('UnifiedWizard keyboard behavior', () => {
  it('does not navigate with arrow keys when focus is inside input elements', () => {
    const props = renderWizard();
    const input = screen.getByLabelText('Client Name');

    input.focus();
    fireEvent.keyDown(input, { key: 'ArrowRight' });
    fireEvent.keyDown(input, { key: 'ArrowLeft' });

    expect(props.onNext).not.toHaveBeenCalled();
    expect(props.onBack).not.toHaveBeenCalled();
  });

  it('does not show skip hint when skipping is disabled', () => {
    renderWizard({ canSkip: false });

    expect(screen.queryByText(/to skip/i)).not.toBeInTheDocument();
  });

  it('shows skip hint when skipping is enabled', () => {
    renderWizard({ canSkip: true });

    expect(screen.getByText(/to skip/i)).toBeInTheDocument();
  });

  it('leaves one completion action on final step and keeps progress below complete', () => {
    renderWizard({
      currentStep: 6,
      totalSteps: 7,
      canGoBack: false,
      children: <button type="button">Go to Dashboard</button>,
    });

    expect(screen.getByText('Step 7 of 7')).toBeInTheDocument();
    expect(screen.getByText('86% Complete')).toBeInTheDocument();
    expect(screen.getAllByRole('button')).toHaveLength(1);
    expect(screen.queryByRole('button', { name: /complete onboarding/i })).not.toBeInTheDocument();
  });
});
