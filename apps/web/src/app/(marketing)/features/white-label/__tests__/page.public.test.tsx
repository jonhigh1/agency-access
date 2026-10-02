import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import WhiteLabelFeaturePage from '../page';

vi.mock('@/components/marketing/comparison-cta', () => ({
  ComparisonCTA: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

describe('white-label feature page', () => {
  it('renders title, plan gates, and AEO FAQs', () => {
    render(<WhiteLabelFeaturePage />);
    expect(
      screen.getByRole('heading', {
        name: /White-Label Client Access: Branded OAuth Links for Agencies/i,
      })
    ).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /Plans and white-label gates/i })).toBeInTheDocument();
    expect(screen.getAllByText(/AuthHub-branded client link/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/What is AuthHub white-label client access\?/i)).toBeInTheDocument();
    expect(screen.getAllByText(/not SOC2-certified/i).length).toBeGreaterThan(0);
  });
});
