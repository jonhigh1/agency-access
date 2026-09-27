import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PlatformWizardCard } from '../PlatformWizardCard';

vi.mock('@/components/ui/platform-icon', () => ({
  PlatformIcon: ({ platform }: { platform: string }) => <div>{platform}</div>,
}));

vi.mock('../PlatformStepProgress', () => ({
  PlatformStepProgress: () => <div>Progress</div>,
}));

describe('PlatformWizardCard', () => {
  it('does not render the active wizard card hidden on first paint', () => {
    const { container } = render(
      <PlatformWizardCard platform="google" platformName="Google" currentStep={1}>
        <div>Connect Google CTA</div>
      </PlatformWizardCard>
    );

    expect(screen.getByText('Connect Google CTA')).toBeInTheDocument();

    // U10: the wizard card is border-led — the invite stage card owns the
    // view's single brutalist shadow — but it must still paint fully on the
    // first frame (no opacity: 0 from the enter transition).
    const card = container.querySelector('.border-2');
    expect(card).not.toBeNull();
    expect(card?.getAttribute('style') || '').not.toContain('opacity: 0');
    expect(card).not.toHaveClass('shadow-brutalist');
  });

  it('can render without duplicate header chrome when a parent stage already provides context', () => {
    render(
      <PlatformWizardCard
        platform="google"
        platformName="Google"
        currentStep={1}
        chrome="minimal"
      >
        <div>Connect Google CTA</div>
      </PlatformWizardCard>
    );

    expect(screen.getByText('Connect Google CTA')).toBeInTheDocument();
    expect(screen.queryByText(/^Google$/)).not.toBeInTheDocument();
    expect(screen.queryByText('Progress')).not.toBeInTheDocument();
  });
});
